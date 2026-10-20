const asyncWrapper = require('../middlewares/asyncWrapper');
const { ValidationError, NotFoundError } = require('../utils/customErrors');
const MensajeContactoModel = require('../models/mensajeContactoModel');
const UsuarioModel = require('../models/usuarioModel');

// Límite del campo de texto. 2000 caracteres alcanzan para explicar un
// problema y cortan el abuse de escribirWall de texto en cada request.
const MAXIMO_MENSAJE = 2000;

const ETIQUETAS_ASUNTO = {
  PREGUNTA: 'Pregunta',
  COMENTARIO: 'Comentario',
  CONTACTO: 'Contacto'
};

/**
 * POST /api/contacto
 *
 * Cualquier persona con cuenta puede escribir. Se acepta también sin sesión
 * (por si alguien está justo por blokearse): en ese caso no se guarda ningún
 * dato identificatorio más allá del nombre que la persona escribe.
 */
const crearMensaje = asyncWrapper(async (req, res) => {
  const { asunto, mensaje } = req.body || {};

  const texto = typeof mensaje === 'string' ? mensaje.trim() : '';
  if (texto === '') {
    throw new ValidationError('Escribí tu consulta antes de enviarla.');
  }
  if (texto.length > MAXIMO_MENSAJE) {
    throw new ValidationError(`El mensaje puede tener hasta ${MAXIMO_MENSAJE} caracteres.`);
  }

  const tipo = String(asunto || 'CONTACTO').toUpperCase();
  if (!MensajeContactoModel.ASUNTOS_VALIDOS.includes(tipo)) {
    throw new ValidationError('El tipo de mensaje no es válido.');
  }

  // Si hay sesión, el autor es el usuario de la sesión: no se confía en el
  // nombre que mande en el body, para que nadie firme como otro.
  //
  // El token sólo lleva { id, rol }, así que el nombre, el DNI y el teléfono
  // se leen de la base.
  let identidad = null;
  if (req.usuario?.id) {
    identidad = await UsuarioModel.obtenerIdentidadPorId(req.usuario.id);
  }

  const autorNombre = identidad
    ? `${identidad.nombre} ${identidad.apellido}`.trim()
    : String(req.body?.nombre || 'Visitante').trim().slice(0, 101);

  const nuevo = await MensajeContactoModel.crear({
    usuarioId: identidad?.id ?? null,
    autorNombre: autorNombre || 'Visitante',
    autorDni: identidad?.dni ?? null,
    autorTelefono: identidad?.telefono ?? null,
    asunto: tipo,
    mensaje: texto,
    ipOrigen: req.ip || req.connection?.remoteAddress || null
  });

  res.status(201).json({
    exito: true,
    mensaje: 'Mensaje enviado. Te vamos a responder por este medio.',
    datos: {
      id: nuevo.id,
      asunto: nuevo.asunto,
      asunto_legible: ETIQUETAS_ASUNTO[nuevo.asunto],
      creado_en: nuevo.creado_en
    }
  });
});

/** GET /api/admin/contacto?pendientes=1 - bandeja del panel. */
const listarMensajes = asyncWrapper(async (req, res) => {
  const soloPendientes = String(req.query.pendientes || '') === '1';
  const mensajes = await MensajeContactoModel.listar({ pendientes: soloPendientes });
  const pendientes = await MensajeContactoModel.contarPendientes();

  res.status(200).json({
    exito: true,
    mensaje: mensajes.length > 0
      ? `${mensajes.length} mensaje(s) para revisar.`
      : 'Todavía no hay mensajes en la bandeja.',
    datos: {
      mensajes,
      pendientes,
      total: mensajes.length
    }
  });
});

/** GET /api/admin/contacto/pendientes - sólo el número, para el badge. */
const contarMensajesPendientes = asyncWrapper(async (req, res) => {
  const pendientes = await MensajeContactoModel.contarPendientes();

  res.status(200).json({
    exito: true,
    mensaje: pendientes > 0
      ? `Hay ${pendientes} mensaje(s) sin responder.`
      : 'No hay mensajes sin responder.',
    datos: { pendientes }
  });
});

/** GET /api/admin/contacto/:id - abrir un mensaje puntual. */
const obtenerMensaje = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador del mensaje no es válido.');
  }

  const mensaje = await MensajeContactoModel.obtenerPorId(id);
  if (!mensaje) {
    throw new NotFoundError('El mensaje no existe.');
  }

  res.status(200).json({
    exito: true,
    mensaje: 'Mensaje encontrado.',
    datos: mensaje
  });
});

/** POST /api/admin/contacto/:id/responder */
const responderMensaje = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador del mensaje no es válido.');
  }

  const respuesta = typeof req.body?.respuesta === 'string' ? req.body.respuesta.trim() : '';
  if (respuesta === '') {
    throw new ValidationError('Escribí la respuesta antes de guardarla.');
  }
  if (respuesta.length > MAXIMO_MENSAJE) {
    throw new ValidationError(`La respuesta puede tener hasta ${MAXIMO_MENSAJE} caracteres.`);
  }

  const actualizado = await MensajeContactoModel.responder(id, respuesta, req.usuario.id);
  if (!actualizado) {
    throw new NotFoundError('El mensaje no existe.');
  }

  const pendientes = await MensajeContactoModel.contarPendientes();

  res.status(200).json({
    exito: true,
    mensaje: 'Respuesta guardada.',
    datos: { ...actualizado, pendientes }
  });
});

/** POST /api/admin/contacto/:id/leer */
const marcarLeido = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador del mensaje no es válido.');
  }

  const actualizado = await MensajeContactoModel.marcarLeido(id);
  if (!actualizado) {
    throw new NotFoundError('El mensaje no existe.');
  }

  res.status(200).json({
    exito: true,
    mensaje: 'Mensaje marcado como leído.',
    datos: actualizado
  });
});

/** DELETE /api/admin/contacto/:id */
const eliminarMensaje = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador del mensaje no es válido.');
  }

  const borrado = await MensajeContactoModel.eliminar(id);
  if (!borrado) {
    throw new NotFoundError('El mensaje no existe.');
  }

  res.status(200).json({
    exito: true,
    mensaje: 'Mensaje eliminado.',
    datos: { id: borrado.id }
  });
});

module.exports = {
  crearMensaje,
  listarMensajes,
  contarMensajesPendientes,
  obtenerMensaje,
  responderMensaje,
  marcarLeido,
  eliminarMensaje
};
