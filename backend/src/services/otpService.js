const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const config = require('../config/otp');
const OtpModel = require('../models/otpModel');
const {
  normalizarTelefono,
  esTelefonoValido,
  obtenerCadenaDeProveedores,
} = require('./providers/otpProvider');
const { ValidationError, ForbiddenError, TooManyRequestsError } = require('../utils/customErrors');

const PROPOSITO_REGISTRO = 'REGISTRO';

class OtpService {
  /**
   * Genera un código numérico criptográficamente seguro.
   * randomInt evita el sesgo de Math.random(), que en principio lo hace predecible.
   */
  static generarCodigo() {
    const max = 10 ** config.longitudCodigo;
    return String(crypto.randomInt(0, max)).padStart(config.longitudCodigo, '0');
  }

  /**
   * HMAC-SHA256 del código. Se guarda esto, no el código.
   * Un código de 6 dígitos tiene 1 millón de combinaciones: con bcrypt
   * el atacante podría probarlos todos fuera de línea. Con HMAC y clave
   * del servidor, sin esa clave no hay forma de calcular el valor.
   */
  static hashearCodigo(telefono, proposito, codigo) {
    return crypto
      .createHmac('sha256', config.hmacSecret)
      .update(`${telefono}|${proposito}|${codigo}`)
      .digest('hex');
  }

  /**
   * Compara en tiempo constante para no filtrar información por el tiempo
   * que tarda la respuesta.
   */
  static compararCodigo(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Solicita un código de verificación.
   * Recorre los canales en orden: primero SMS, si el proveedor falla,
   * cae a WhatsApp.
   */
  static async solicitar({ telefono, proposito, ipOrigen, canalPreferido }) {
    const propositoNormalizado = (proposito || PROPOSITO_REGISTRO).toUpperCase();

    if (propositoNormalizado !== PROPOSITO_REGISTRO) {
      throw new ValidationError(`Propósito de verificación desconocido: ${proposito}.`);
    }

    if (!esTelefonoValido(telefono)) {
      throw new ValidationError('Ingresá un número de celular válido.');
    }

    const tel = normalizarTelefono(telefono);

    // Freno de abuso por teléfono
    const enviadosHora = await OtpModel.contarEnviosRecientes({
      telefono: tel,
      proposito: PROPOSITO_REGISTRO,
      minutos: 60,
    });

    if (enviadosHora >= config.maxEnviosPorHora) {
      throw new TooManyRequestsError(
        'Demasiadas solicitudes de código para este número. Probá de nuevo en una hora.'
      );
    }

    // Freno de abuse por origen
    if (ipOrigen) {
      const enviadosIp = await OtpModel.contarEnviosPorIp({ ip: ipOrigen, minutos: 60 });
      if (enviadosIp >= config.maxEnviosPorIpHora) {
        throw new TooManyRequestsError(
          'Demasiadas solicitudes de código desde este dispositivo. Probá más tarde.'
        );
      }
    }

    // Enfriamiento: no emitir un código nuevo mientras el anterior sigue vivo
    const activo = await OtpModel.obtenerActivo({
      telefono: tel,
      proposito: PROPOSITO_REGISTRO,
    });

    if (activo) {
      const segundosRestantes = Math.ceil(
        (new Date(activo.expira_en).getTime() - Date.now()) / 1000
      );
      throw new TooManyRequestsError(
        `Ya pediste un código hace poco. Esperá ${segundosRestantes} segundos para pedir otro.`,
        { segundosRestantes }
      );    }

    // Sólo queda un código válido a la vez
    await OtpModel.invalidarPendientes({
      telefono: tel,
      proposito: PROPOSITO_REGISTRO,
    });

    const codigo = OtpService.generarCodigo();
    const codigoHash = OtpService.hashearCodigo(tel, PROPOSITO_REGISTRO, codigo);
    const expiraEn = new Date(Date.now() + config.minutosValidez * 60 * 1000);

    // Cadena de proveedores configurada, en orden de preferencia.
    // SMS queda primero salvo que la persona pida explícitamente WhatsApp.
    const { cadena, problemas, usandoMock } = obtenerCadenaDeProveedores();

    for (const aviso of problemas) {
      // eslint-disable-next-line no-console
      console.warn(`[OTP] ${aviso}`);
    }

    if (cadena.length === 0) {
      throw new ForbiddenError(
        'El servicio de verificación por mensaje no está disponible en este ' +
          'momento. Intentá más tarde.'
      );
    }

    let cadenaOrdenada = cadena.slice();
    if (canalPreferido) {
      const preferido = canalPreferido.toUpperCase();
      const candidatos = cadenaOrdenada.filter((p) => p.canal === preferido);
      if (candidatos.length > 0) {
        cadenaOrdenada = [
          ...candidatos,
          ...cadenaOrdenada.filter((p) => p.canal !== preferido),
        ];
      }
    }

    // Se intenta cada proveedor en orden hasta que uno entregue el mensaje.
    // Así, si el SMS falla, sale por WhatsApp sin molestar a la persona.
    let proveedorUsado = null;
    let canalUsado = null;
    const errores = [];

    for (const proveedor of cadenaOrdenada) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const resultado = await proveedor.enviar({
          telefono: tel,
          canal: proveedor.canal,
          codigo,
          minutosValidez: config.minutosValidez,
        });

        if (resultado && resultado.entregado) {
          proveedorUsado = proveedor;
          canalUsado = proveedor.canal;
          break;
        }
        errores.push(`${proveedor.nombre}: no entregado (${resultado?.detalle || 'sin detalle'})`);
      } catch (err) {
        errores.push(`${proveedor.nombre}: ${err.message}`);
      }
    }

    if (!canalUsado) {
      // Se registra el detalle del fallo sólo en el servidor: el mensaje para
      // la persona no debe filtrar nombres de proveedores ni credenciales.
      // eslint-disable-next-line no-console
      console.error(`[OTP] Fallaron todos los proveedores: ${errores.join(' | ')}`);

      throw new ForbiddenError(
        'No pudimos enviar el código por ningún canal. Intentá más tarde.'
      );
    }

    // eslint-disable-next-line no-await-in-loop
    const registro = await OtpModel.crear({
      telefono: tel,
      proposito: PROPOSITO_REGISTRO,
      canal: canalUsado,
      codigoHash,
      ipOrigen,
      expiraEn,
      maxIntentos: config.maxIntentos,
    });

    return {
      registroId: registro.id,
      canalEnviado: canalUsado,
      proveedorEnviado: proveedorUsado.nombre,
      expiraEn: registro.expira_en,
      minutosValidez: config.minutosValidez,
      maxIntentos: registro.max_intentos,
      // El código sólo vuelve al cliente en modo mock. Con un proveedor
      // real, este campo nunca se completa: el código sale sólo por el
      // teléfono de la persona.
      ...(usandoMock && config.mockHabilitado
        ? { codigoMock: codigo, esMock: true }
        : {}),
    };
  }

  /**
   * Verifica el código ingrado por la persona usuaria.
   * Distingue tres situaciones: no hay código, el código falló, o el código
   * venció / se agotaron los intentos.
   */
  static async verificar({ telefono, proposito, codigo, ipOrigen }) {
    const propositoNormalizado = (proposito || PROPOSITO_REGISTRO).toUpperCase();

    if (!esTelefonoValido(telefono)) {
      throw new ValidationError('Ingresá un número de celular válido.');
    }

    if (!codigo || !/^\d+$/.test(String(codigo))) {
      throw new ValidationError('El código debe ser numérico.');
    }

    const tel = normalizarTelefono(telefono);
    const registro = await OtpModel.obtenerActivo({
      telefono: tel,
      proposito: PROPOSITO_REGISTRO,
    });

    if (!registro) {
      throw new ValidationError(
        'No hay ningún código vigente para ese número. Pedí uno nuevo.'
      );
    }

    const esperado = registro.codigo_hash;
    const recibido = OtpService.hashearCodigo(tel, PROPOSITO_REGISTRO, String(codigo));

    if (!OtpService.compararCodigo(esperado, recibido)) {
      const actualizado = await OtpModel.sumarIntento(registro.id);
      const restantes = actualizado
        ? Math.max(0, actualizado.max_intentos - actualizado.intentos)
        : 0;

      if (restantes === 0) {
        throw new ValidationError(
          'Agotaste los intentos disponibles. Pedí un código nuevo.'
        );
      }

      throw new ValidationError(
        `El código no coincide. Te quedan ${restantes} ${restantes === 1 ? 'intento' : 'intentos'}.`
      );
    }

    // Código correcto: se consume y no puede reutilizarse
    const consumido = await OtpModel.marcarConsumido(registro.id);

    // Se emite un comprobante firmado de que el teléfono fue verificado.
    // El registro en /auth/registro lo exige, así que no alcanza con
    // decir "ya verifiqué": hay que presentar este token.
    const tokenVerificacion = jwt.sign(
      {
        proposito: 'OTP_VERIFICADO',
        telefono: tel,
        otpId: consumido.id,
        canal: consumido.canal,
      },
      process.env.JWT_SECRET || 'switch_secreto_temporal',
      { expiresIn: '30m' }
    );

    return {
      verificado: true,
      telefono: tel,
      canalUtilizado: consumido.canal,
      tokenVerificacion,
    };
  }
}

module.exports = OtpService;
module.exports.PROPOSITO_REGISTRO = PROPOSITO_REGISTRO;
