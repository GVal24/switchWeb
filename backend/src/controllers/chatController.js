const asyncWrapper = require('../middlewares/asyncWrapper');
const { ValidationError, ForbiddenError, NotFoundError } = require('../utils/customErrors');
const ChatModel = require('../models/chatModel');
const UsuarioModel = require('../models/usuarioModel');
const VoluntariadoModel = require('../models/voluntariadoModel');

/**
 * GET /api/mensajes?emisorId=..&receptorId=..
 * Devuelve la conversación entre dos participantes.
 */
const obtenerMensajes = asyncWrapper(async (req, res) => {
  // El emisor siempre es el usuario de la sesión (no se confía en el query)
  const emisorId = req.usuario.id;
  const receptorId = req.query.receptorId || req.query.receptor_id;

  if (!receptorId) {
    throw new ValidationError("Se requiere el parámetro 'receptorId'.");
  }

  const mensajes = await ChatModel.obtenerConversacion(emisorId, receptorId);

  res.status(200).json({
    exito: true,
    datos: mensajes,
    mensajes
  });
});

/**
 * POST /api/mensajes/enviar
 * Body: { emisorId, receptorId, receptorNombre?, texto }
 */
const enviarMensaje = asyncWrapper(async (req, res) => {
  // El emisor siempre es el usuario de la sesión (no se confía en el body)
  const emisorId = req.usuario.id;
  const receptorId = req.body.receptorId || req.body.receptor_id;
  const receptorNombre = req.body.receptorNombre || 'Contacto';
  const texto = req.body.texto || req.body.mensaje;

  if (!receptorId) {
    throw new ValidationError("Se requiere 'receptorId'.");
  }
  if (!texto || String(texto).trim() === '') {
    throw new ValidationError('El mensaje no puede estar vacío.');
  }

  // Leer el chat sigue permitido con la cuenta suspendida o el Nexo vencido
  // (punto de castigo: puede ver, no tocar). Escribir exige la habilitación
  // vigente, porque el chat sirve para coordinar los trueques del circuito.
  const tieneNexoActivo = await VoluntariadoModel.verificarNexoSocialActivo(emisorId);
  if (!tieneNexoActivo) {
    throw new ForbiddenError(
      'Tu habilitación está vencida o todavía no fue activada. ' +
      'Podés leer tus conversaciones, pero para escribir necesitás cubrir un cupo en una institución comunitaria.'
    );
  }

  // No se puede escribir a un usuario suspendido o dado de baja.
  // Los receptores institutionales ("inst_X") no se validan contra usuarios.
  if (!String(receptorId).startsWith('inst_')) {
    try {
      await UsuarioModel.exigirHabilitacion(
        Number(receptorId),
        'enviarle mensajes por chat, porque su cuenta está suspendida o dada de baja'
      );
    } catch (e) {
      if (e.codigoEstado === 404) throw e;
      throw new ForbiddenError('No podés enviarle mensajes por chat a este usuario.');
    }
  }

  const nuevoMensaje = await ChatModel.crearMensaje({
    emisorId,
    receptorId,
    texto: String(texto).trim()
  });

  // Respuesta automática simulada si el receptor es una institución ("inst_X")
  if (String(receptorId).startsWith('inst_')) {
    setTimeout(async () => {
      try {
        await ChatModel.crearMensaje({
          emisorId: receptorId,
          receptorId: emisorId,
          texto: `¡Hola! Gracias por comunicarte con ${receptorNombre}. Si querés, podés enviarnos tu disponibilidad y pronto nos pondremos en contacto para coordinar. ¡Gracias por tu interés en ayudarnos!`
        });
      } catch (e) {
        console.error('Error en la respuesta automática del chat:', e.message);
      }
    }, 1200);
  }

  res.status(201).json({
    exito: true,
    mensaje: nuevoMensaje
  });
});

/**
 * PUT /api/mensajes/:id/leido
 * Marca un mensaje de la conversación como leído.
 * El emisor o el receptor de la conversación pueden marcarlo como leído.
 */
const marcarMensajeLeido = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const mensajeId = Number(id);
  if (!Number.isInteger(mensajeId) || mensajeId < 1) {
    throw new ValidationError('El ID del mensaje no es válido.');
  }

  const mensaje = await ChatModel.obtenerPorId(mensajeId);
  if (!mensaje) {
    throw new NotFoundError('El mensaje no existe.');
  }

  const esEmisor = String(mensaje.emisor_id) === String(req.usuario.id);
  const esReceptor = String(mensaje.receptor_id) === String(req.usuario.id);
  if (!esEmisor && !esReceptor) {
    throw new ForbiddenError('No podés marcar como leído este mensaje.');
  }

  const actualizado = await ChatModel.marcarLeido(mensajeId);
  res.status(200).json({
    exito: true,
    datos: actualizado
  });
});

/**
 * GET /api/mensajes/no-leidos?receptorId=..
 * Devuelve los mensajes no leídos dirigidos a un receptor
 * (usuario "123" o institución "inst_1").
 */
const obtenerNoLeidos = asyncWrapper(async (req, res) => {
  const receptorId = req.query.receptorId || req.query.receptor_id;
  if (!receptorId) {
    throw new ValidationError("Se requiere el parámetro 'receptorId'.");
  }

  const noLeidos = await ChatModel.listarNoLeidos(receptorId);
  res.status(200).json({
    exito: true,
    datos: noLeidos,
    mensajes: noLeidos,
    receptorId
  });
});

module.exports = {
  obtenerMensajes,
  enviarMensaje,
  marcarMensajeLeido,
  obtenerNoLeidos
};
