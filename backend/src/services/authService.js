const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UsuarioModel = require('../models/usuarioModel');
const LegalModel = require('../models/legalModel');
const legales = require('../content/legales');
const { normalizarTelefono } = require('./providers/otpProvider');
const { ValidationError, NotFoundError, ConflictError, UnauthorizedError, ForbiddenError } = require('../utils/customErrors');

class AuthService {
  /**
   * Verifica el comprobante de OTP entregado por /auth/otp/verificar.
   * Hace falta porque, si no, cualquiera podría llamar al registro
   * diciendo "ya verifiqué" sin haber pasado nunca por la verificación.
   */
  static verificarComprobanteOtp(tokenVerificacion, telefonoEsperado) {
    if (!tokenVerificacion) {
      throw new ValidationError(
        'Primero tenés que verificar tu teléfono con el código que te enviamos.'
      );
    }

    let payload;
    try {
      payload = jwt.verify(
        tokenVerificacion,
        process.env.JWT_SECRET || 'switch_secreto_temporal'
      );
    } catch (_) {
      throw new ValidationError(
        'La verificación del teléfono venció o no es válida. Pedí un código nuevo.'
      );
    }

    if (payload.proposito !== 'OTP_VERIFICADO') {
      throw new ValidationError('El comprobante de verificación no corresponde a un OTP.');
    }

    if (normalizarTelefono(telefonoEsperado) !== payload.telefono) {
      throw new ValidationError(
        'El teléfono verificado no coincide con el que estás registrando.'
      );
    }

    return payload;
  }

  /**
   * Valida reglas de negocio y registra un nuevo usuario
   */
  static async registrarUsuario({
    dni,
    nombre,
    apellido,
    telefono,
    password,
    esMayorEdad,
    aceptoTerminos,
    aceptoPrivacidad,
    tokenVerificacion,
    ipOrigen,
    userAgent
  }) {
    if (!dni || !nombre || !apellido || !telefono || !password) {
      throw new ValidationError("Todos los campos (incluyendo la contraseña) son obligatorios.");
    }

    if (password.length < 6) {
      throw new ValidationError("La contraseña debe tener al menos 6 caracteres.");
    }

    if (esMayorEdad !== true) {
      throw new ValidationError("Es requisito obligatorio ser mayor de 18 años para registrarse en Switch.");
    }

    if (aceptoTerminos !== true) {
      throw new ValidationError("Es obligatorio aceptar los Términos y Condiciones.");
    }

    if (aceptoPrivacidad !== true) {
      throw new ValidationError("Es obligatorio aceptar la Política de Privacidad.");
    }

    // La cuenta no se crea sin verificar la titularidad del teléfono.
    AuthService.verificarComprobanteOtp(tokenVerificacion, telefono);

    const usuarioExistente = await UsuarioModel.buscarPorDniOTelefono(dni, telefono);

    if (usuarioExistente) {
      const existeDni = usuarioExistente.dni === dni;
      const existeTelefono = usuarioExistente.telefono === telefono;

      if (existeDni && existeTelefono) {
        throw new ConflictError("El DNI y el teléfono ingresados ya se encuentran registrados.");
      } else if (existeDni) {
        throw new ConflictError("El DNI ingresado ya pertenece a un usuario registrado en Switch.");
      } else {
        throw new ConflictError("El número de teléfono ya se encuentra registrado en Switch.");
      }
    }

    // Encriptado de contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Constancia de los textos legales aceptados, con la versión exacta
    // que se mostró antes de aceptar.
    const aceptaciones = [];
    for (const documento of ['terminos', 'privacidad']) {
      // eslint-disable-next-line no-await-in-loop
      const registro = await LegalModel.registrarAceptacion({
        documento: documento.toUpperCase(),
        version: legales.VERSION,
        hash: legales.hashDocumento(documento),
        ipOrigen,
        userAgent
      });
      aceptaciones.push(registro.id);
    }

    const nuevoUsuario = await UsuarioModel.crear({
      dni,
      nombre,
      apellido,
      telefono,
      esMayorEdad,
      password: hashedPassword
    });

    // Se completa el vínculo de las aceptaciones con la cuenta creada
    await LegalModel.vincularConUsuario(aceptaciones, nuevoUsuario.id);

    return {
      ...nuevoUsuario,
      documentosAceptados: aceptaciones.length,
      versionDocumentos: legales.VERSION
    };
  }

  /**
   * Autentica credenciales de ingreso
   */
  static async loginUsuario({ dni, password }) {
    if (!dni || !password) {
      throw new ValidationError("DNI y contraseña son requeridos para ingresar.");
    }

    const usuario = await UsuarioModel.buscarPorDni(dni);

    if (!usuario) {
      throw new NotFoundError("No encontramos ningún usuario registrado con ese DNI.");
    }

    if (usuario.activo === false) {
      throw new ForbiddenError("Tu cuenta fue bloqueada permanentemente por la administración de Switch. Comunicate con soporte.");
    }

    // Suspensión temporal: es una PENALIZACIÓN, no un bloqueo de acceso.
    // El usuario entra igual, pero en modo lectura (no puede escribir).
    // Si la suspensión ya venció se limpia automáticamente.
    let suspensionVigente = false;
    let suspendidoHasta = null;
    if (usuario.suspendido_hasta) {
      const fin = new Date(usuario.suspendido_hasta);
      if (fin > new Date()) {
        suspensionVigente = true;
        suspendidoHasta = `${String(fin.getDate()).padStart(2, '0')}/${String(fin.getMonth() + 1).padStart(2, '0')}/${fin.getFullYear()}`;
      } else {
        await UsuarioModel.levantarSuspension(usuario.id);
        usuario.suspendido_hasta = null;
      }
    }

    // Verificar la contraseña con bcrypt
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      throw new UnauthorizedError("Contraseña incorrecta. Por favor verificá tus datos.");
    }

    // Limpiamos el hash por seguridad antes de retornarlo
    delete usuario.password;
    delete usuario.activo;
    delete usuario.suspendido_hasta;

    // Token de sesión válido por 7 días
    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
      process.env.JWT_SECRET || 'switch_secreto_temporal',
      { expiresIn: '7d' }
    );

    return {
      ...usuario,
      token,
      // El frontend usa esto para avisar que la cuenta está en modo lectura
      habilitado: !suspensionVigente,
      suspensionVigente,
      ...(suspensionVigente ? { suspendidoHasta } : {})
    };
  }
}

module.exports = AuthService;