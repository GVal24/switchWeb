const asyncWrapper = require('../middlewares/asyncWrapper');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/customErrors');
const IntercambioModel = require('../models/intercambioModel');
const ResenaModel = require('../models/resenaModel');
const P2PModel = require('../models/p2pModel');
const UsuarioModel = require('../models/usuarioModel');
const VoluntariadoModel = require('../models/voluntariadoModel');

/**
 * El Nexo Social es la habilitación para intercambiar: se obtiene cubriendo un
 * cupo de una institución comunitaria y vence pasado el plazo establecido.
 * Mientras está vencido el usuario puede ver la plataforma, pero no proponer,
 * aceptar ni rechazar trueques: el circuito de retribución se sostiene sobre
 * colaborar con las instituciones.
 */
async function exigirNexoSocialVigente(usuarioId) {
  const tieneNexoActivo = await VoluntariadoModel.verificarNexoSocialActivo(usuarioId);
  if (!tieneNexoActivo) {
    throw new ForbiddenError(
      'Tu habilitación para intercambiar está vencida o todavía no fue activada. ' +
      'Tenés que cubrir un cupo en una institución comunitaria para renewarla antes de proponer, aceptar o rechazar trueques.'
    );
  }
}

/**
 * POST /api/intercambios/proponer
 * Body: { publicacionDeseadaId, itemsOfrecidos: [ids de publicaciones propias] }
 *
 * El switch SOLO puede armarse con publicaciones publicadas en la plataforma:
 * - La publicación deseada debe existir, estar Activa y pertenecer a otro usuario.
 * - Cada ítem ofrecido debe ser una publicación Activa del propio oferente.
 * Todo se valida contra la base; el dueño, el título y los detalles de los
 * ítems se toman de la base de datos (no se confía en el body).
 */
const proponerIntercambio = asyncWrapper(async (req, res) => {
  const ofertanteId = req.usuario.id;
  const { publicacionDeseadaId } = req.body;

  // Acepta ids como números, strings u objetos {id} que vengan del frontend
  let itemsIds = (Array.isArray(req.body.itemsOfrecidos) ? req.body.itemsOfrecidos : [])
    .map((item) => {
      const valor = typeof item === 'object' && item !== null ? (item.id ?? item.publicacionId) : item;
      return Number(valor);
    })
    .filter((n) => Number.isInteger(n) && n > 0);
  itemsIds = [...new Set(itemsIds)];

  if (!publicacionDeseadaId || itemsIds.length === 0) {
    throw new ValidationError('Necesitás seleccionar al menos una publicación tuya para ofrecer.');
  }

  // 0. Habilitación vigente para intercambiar (Nexo Social no vencido)
  await exigirNexoSocialVigente(ofertanteId);

  // 1. La publicación deseada debe existir y estar activa
  const deseadas = await P2PModel.obtenerPorIds([Number(publicacionDeseadaId)]);
  const deseada = deseadas[0];
  if (!deseada || deseada.estado !== 'Activo') {
    throw new NotFoundError('La publicación que querés pedir ya no está disponible.');
  }

  // 2. No puede ser propia
  if (Number(deseada.usuario_id) === Number(ofertanteId)) {
    throw new ValidationError('No podés proponer un trueque sobre tu propia publicación.');
  }

  // 3. No se propone sobre publicaciones de usuarios suspendidos o dados de baja
  await UsuarioModel.exigirHabilitacion(
    Number(deseada.usuario_id),
    'intercambiar con esta publicación, porque su dueño está suspendido o dado de baja'
  );

  // 3. No vale ofrecer la misma publicación que se pide
  if (itemsIds.includes(Number(publicacionDeseadaId))) {
    throw new ValidationError('No podés ofrecer la misma publicación que estás pidiendo.');
  }

  // 4. Todos los ofrecidos deben existir, ser propios y estar activos
  const ofrecidas = await P2PModel.obtenerPorIds(itemsIds);
  if (ofrecidas.length !== itemsIds.length) {
    throw new NotFoundError('Una de las publicaciones ofrecidas no existe.');
  }

  const ajena = ofrecidas.find((p) => Number(p.usuario_id) !== Number(ofertanteId));
  if (ajena) {
    throw new ForbiddenError(`"${ajena.titulo}" no es tuya. Solo podés ofrecer publicaciones de tu propio catálogo.`);
  }

  const inactiva = ofrecidas.find((p) => p.estado !== 'Activo');
  if (inactiva) {
    throw new ValidationError(`"${inactiva.titulo}" ya no está activa. Elegí otra publicación para ofrecer.`);
  }

  // Snapshot oficial tomado de la base de datos
  const itemsOfrecidos = ofrecidas.map((p) => ({
    id: p.id,
    titulo: p.titulo,
    descripcion: p.descripcion
  }));

  const ofertanteNombre = await UsuarioModel.obtenerNombrePorId(ofertanteId);

  const nuevaPropuesta = await IntercambioModel.crear({
    publicacionDeseadaId: deseada.id,
    tituloDeseado: deseada.titulo,
    duenoId: deseada.usuario_id,
    ofertanteId,
    ofertanteNombre,
    itemsOfrecidos
  });

  res.status(201).json({
    exito: true,
    mensaje: '¡Propuesta enviada! El dueño la va a revisar.',
    datos: nuevaPropuesta
  });
});

/**
 * GET /api/intercambios/mis-propuestas
 * Devuelve las propuestas enviadas y recibidas del usuario logueado.
 */
const listarMisPropuestas = asyncWrapper(async (req, res) => {
  const datos = await IntercambioModel.listarPorUsuario(req.usuario.id);

  res.status(200).json({
    exito: true,
    mensaje: 'Propuestas obtenidas correctamente.',
    datos
  });
});

/**
 * POST /api/intercambios/:id/responder
 * Body: { estado: 'ACEPTADA' | 'RECHAZADA' }
 * Solo el dueño de la publicación puede responder una propuesta PENDIENTE.
 */
const responderPropuesta = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!['ACEPTADA', 'RECHAZADA'].includes(estado)) {
    throw new ValidationError('El estado debe ser ACEPTADA o RECHAZADA.');
  }

  const propuesta = await IntercambioModel.obtenerPorId(id);
  if (!propuesta) {
    throw new NotFoundError('La propuesta no existe.');
  }

  if (Number(propuesta.dueno_id) !== Number(req.usuario.id)) {
    throw new ForbiddenError('Solo quien publicó el artículo puede responder esta propuesta.');
  }

  // Habilitación vigente: con el Nexo Social vencido no se acepta ni se rechaza
  await exigirNexoSocialVigente(req.usuario.id);
  // La contraparte también tiene que estar habilitada
  await UsuarioModel.exigirHabilitacion(
    Number(propuesta.ofertante_id),
    'responder esta propuesta, porque quien la envió está suspendido o dado de baja'
  );

  const resultado = await IntercambioModel.responder(id, estado);
  if (!resultado) {
    throw new ValidationError('Esta propuesta ya fue respondida.');
  }

  res.status(200).json({
    exito: true,
    mensaje: estado === 'ACEPTADA'
      ? '¡Trueque aceptado! Ya pueden coordinar la entrega por chat.'
      : 'La propuesta fue rechazada.',
    datos: resultado
  });
});

/**
 * POST /api/intercambios/:id/confirmar
 * Body opcional: { puntaje?: 1-5, comentario? }
 * Ambas partes confirman la concreción del trueque. Al confirmar ambas,
 * pasa a COMPLETADO. Si envía puntaje, se registra la reseña.
 */
const confirmarTrueque = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { puntaje, comentario } = req.body;
  const usuarioId = req.usuario.id;

  const propuesta = await IntercambioModel.obtenerPorId(id);
  if (!propuesta) {
    throw new NotFoundError('La propuesta no existe.');
  }
  if (propuesta.estado === 'PENDIENTE') {
    throw new ValidationError('Primero el dueño debe aceptar la propuesta.');
  }
  if (propuesta.estado === 'RECHAZADA') {
    throw new ValidationError('Esta propuesta fue rechazada.');
  }

  // Habilitación vigente también para cerrar el trueque
  await exigirNexoSocialVigente(usuarioId);
  await UsuarioModel.exigirHabilitacion(
    Number(propuesta.dueno_id) === Number(usuarioId) ? Number(propuesta.ofertante_id) : Number(propuesta.dueno_id),
    'confirmar este trueque, porque la otra parte está suspendida o dada de baja'
  );

  const resultado = await IntercambioModel.confirmar(id, usuarioId);
  if (resultado.noExiste) throw new NotFoundError('La propuesta no existe.');
  if (resultado.sinPermiso) throw new ForbiddenError('Solo participan de este trueque quien publicó y quien ofreció.');
  if (resultado.estadoInvalido) throw new ValidationError('Este trueque ya no admite confirmaciones.');

  let resenaCreada = false;
  if (puntaje != null) {
    if (!Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) {
      throw new ValidationError('La calificación debe ser un número entre 1 y 5.');
    }
    await ResenaModel.crear({
      intercambioId: Number(id),
      autorId: usuarioId,
      destinoId: Number(propuesta.dueno_id) === Number(usuarioId)
        ? Number(propuesta.ofertante_id)
        : Number(propuesta.dueno_id),
      puntaje,
      comentario: comentario || null
    });
    resenaCreada = true;
  }

  const completado = resultado.datos.estado === 'COMPLETADO';

  res.status(200).json({
    exito: true,
    mensaje: completado
      ? '¡Trueque completado por ambas partes! Gracias por confiar en Switch.'
      : 'Confirmación registrada. Falta que la otra parte confirme.',
    datos: { ...resultado.datos, resenaCreada }
  });
});

module.exports = {
  proponerIntercambio,
  listarMisPropuestas,
  responderPropuesta,
  confirmarTrueque
};
