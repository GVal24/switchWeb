const asyncWrapper = require('../middlewares/asyncWrapper');
const { ValidationError, ForbiddenError, NotFoundError } = require('../utils/customErrors');
const ChatModel = require('../models/chatModel');
const UsuarioModel = require('../models/usuarioModel');
const VoluntariadoModel = require('../models/voluntariadoModel');
const InstitucionModel = require('../models/institucionModel');

/**
 * Devuelve el ID numérico de una institución a partir del canal "inst_<id>".
 * Si el canal no es institucional, devuelve null.
 */
function idInstitucionDeCanal(canal) {
  const coincidencia = /^inst_(\d+)$/.exec(String(canal || ''));
  if (!coincidencia) return null;
  const id = Number(coincidencia[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Autoriza el acceso a una bandeja:
 * - cada persona sólo puede ver la suya (receptorId = su propio ID);
 * - los canales "inst_<id>" sólo se abren con una membresía activa.
 */
async function exigirAccesoABandeja(usuarioId, receptorId) {
  const institucionId = idInstitucionDeCanal(receptorId);
  if (institucionId) {
    const membresia = await InstitucionModel.obtenerMembresiaActiva(institucionId, usuarioId);
    if (!membresia) {
      throw new ForbiddenError('No tenés acceso a los mensajes de esta institución.');
    }
    return;
  }

  if (!/^\d+$/.test(String(receptorId)) || String(receptorId) !== String(usuarioId)) {
    throw new ForbiddenError('Sólo podés consultar tus propios mensajes.');
  }
}

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
 * Marca un mensaje como leído. Sólo puede hacerlo quien lo recibió:
 * el emisor no puede ocultarle una notificación a la otra persona.
 * En canales institucionales hace falta una membresía activa.
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

  const receptorId = String(mensaje.receptor_id || '');
  const institucionId = idInstitucionDeCanal(receptorId);
  if (institucionId) {
    const membresia = await InstitucionModel.obtenerMembresiaActiva(
      institucionId,
      req.usuario.id
    );
    if (!membresia) {
      throw new ForbiddenError('No podés marcar como leído este mensaje.');
    }
  } else if (receptorId !== String(req.usuario.id)) {
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

  await exigirAccesoABandeja(req.usuario.id, receptorId);

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
