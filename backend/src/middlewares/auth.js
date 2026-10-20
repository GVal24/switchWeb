const jwt = require('jsonwebtoken');
const UsuarioModel = require('../models/usuarioModel');

/**
 * Verifica que la petición traiga un token de sesión válido.
 * Deja los datos del usuario en req.usuario = { id, rol }.
 *
 * Revalida la cuenta contra la base en cada petición, porque un token sigue
 * siendo criptográficamente válido hasta que expira (7 días) y sin este
 * control un usuario dado de baja podría seguir operando con un token viejo.
 *
 * Una SUSPENSIÓN no impide entrar: es una penalización, no un bloqueo de
 * acceso. El usuario suspendido entra y navega en modo lectura (REQ-PERFIL-09).
 * Lo que no puede es escribir, y eso lo bloquea requiereCuentaHabilitada.
 * El estado viaja en req.estadoCuenta para que los controladores decidan.
 */
async function requerirSesion(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      exito: false,
      codigoEstado: 401,
      mensaje: 'Necesitás iniciar sesión para hacer esta operación.'
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({
      exito: false,
      codigoEstado: 401,
      mensaje: 'Tu sesión expiró o no es válida. Iniciá sesión de nuevo.'
    });
  }

  try {
    // La baja lógica permanente sí cierra el acceso; la suspensión no.
    await UsuarioModel.exigirCuentaNoDadaDeBaja(payload.id);
    req.estadoCuenta = await UsuarioModel.obtenerEstadoHabilitacion(payload.id);
    req.usuario = payload;
    return next();
  } catch (e) {
    return res.status(e.codigoEstado || 403).json({
      exito: false,
      codigoEstado: e.codigoEstado || 403,
      mensaje: e.message
    });
  }
}

/**
 * Impide escribir (crear, modificar o borrar) a una cuenta suspendida o dada
 * de baja. Se usa en las rutas de escritura junto a requerirSesion, que sí
 * deja pasar a los suspendidos para que puedan seguir mirando la plataforma.
 * Los mensajes de error explican el motivo y hasta cuándo dura la penalización.
 */
async function requiereCuentaHabilitada(req, res, next) {
  const estado = req.estadoCuenta || (req.usuario
    ? await UsuarioModel.obtenerEstadoHabilitacion(req.usuario.id)
    : null);

  if (!estado) {
    return res.status(401).json({
      exito: false,
      codigoEstado: 401,
      mensaje: 'Necesitás iniciar sesión para hacer esta operación.'
    });
  }

  if (estado.deshabilitado) {
    return res.status(403).json({
      exito: false,
      codigoEstado: 403,
      mensaje: 'Tu cuenta fue dada de baja por la administración. No podés realizar esta operación.'
    });
  }

  if (estado.suspendido) {
    return res.status(403).json({
      exito: false,
      codigoEstado: 403,
      mensaje: `Tu cuenta está suspendida hasta el ${estado.suspendido_hasta_legible} por una penalización. ` +
               'Podés entrar y ver la plataforma, pero no podés realizar esta operación hasta que se levante la suspensión.'
    });
  }

  return next();
}

/**
 * Arma la sesión si la hay, pero no la exige.
 *
 * Para el buzón de contacto: cualquiera puede escribir, y hasta conviene que
 * pueda escribir una persona a la que le acaban de bloquear la cuenta, porque
 * es justo cuando necesita poder preguntar algo. Si viene un token válido se
 * guarda en req.usuario para poder completar el nombre, el DNI y el teléfono
 * del autor; si no viene, la petición sigue igual y el mensaje se guarda sin
 * datos identificatorios.
 *
 * Un token vencido o inválido NO es un error acá: se lo trata como visitante.
 */
async function requerirSesionOpcional(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
  } catch {
    req.usuario = undefined;
  }

  return next();
}

/**
 * Restringe el acceso a usuarios con rol ADMIN.
 * Debe usarse SIEMPRE después de requerirSesion.
 */
function requerirAdmin(req, res, next) {
  if (!req.usuario || req.usuario.rol !== 'ADMIN') {
    return res.status(403).json({
      exito: false,
      codigoEstado: 403,
      mensaje: 'Esta sección es exclusiva de la administración de Switch.'
    });
  }
  return next();
}

module.exports = {
  requerirSesion,
  requerirSesionOpcional,
  requiereCuentaHabilitada,
  requerirAdmin
};
