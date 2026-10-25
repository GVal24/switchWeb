const asyncWrapper = require('../middlewares/asyncWrapper');
const ModeracionModel = require('../models/moderacionModel');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/customErrors');

/**
 * GET /api/admin/moderacion/:id/imagen
 *
 * Entrega el archivo a la persona que modera. Es la excepción controlada al
 * hecho de que las imágenes en cuarentena no sean públicas: sin poder mirar
 * la foto, la revisión sería a ciegas.
 *
 * La ruta exige sesión y rol ADMIN en el enrutador, así que sólo un
 * administrador con cuenta habilitada llega acá.
 */
const verImagen = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador de la moderación no es válido.');
  }

  const registro = await ModeracionModel.obtenerImagenRevision(id);
  if (!registro) {
    throw new NotFoundError('No encontramos esa imagen en la cola de moderación.');
  }

  if (!registro.datos_imagen) {
    throw new NotFoundError('Los datos de la imagen ya no están disponibles.');
  }

  res.setHeader('Content-Type', registro.mime_detectado || 'application/octet-stream');
  // Sin caché: la moderadora tiene que ver el archivo tal como está.
  res.setHeader('Cache-Control', 'no-store');
  // El nombre original no se usa en la cabecera para no filtrar nada.
  res.setHeader('Content-Disposition', 'inline');

  res.send(registro.datos_imagen);
});

/**
 * Cola de moderación: imágenes esperando decisión.
 *
 * El filtro automático ya corrió; lo que falta es el juicio de una persona,
 * que es el único control que puede detectar de verdad a un menor.
 */
const listarPendientes = asyncWrapper(async (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 50, 200);
  const pendientes = await ModeracionModel.listarPendientes({ limite });

  // La imagen se enlaza al endpoint de moderación, no a /uploads: así sigue
  // en cuarentena y sólo se abre para quien tiene el rol de administrador.
  // Las publicaciones sin imagen no tienen archivo, así que no llevan URL.
  const conUrl = pendientes.map((p) => ({
    ...p,
    url_para_moderar: p.tipo_revision === 'IMAGEN'
      ? `/api/admin/moderacion/${p.id}/imagen`
      : null,
  }));

  res.status(200).json({
    exito: true,
    mensaje:
      'Cada imagen debe revisarse una por una. Sólo una persona puede detectar ' +
      'de forma confiable si en la foto hay un menor de edad.',
    datos: {
      pendientes: conUrl,
      total: conUrl.length,
    },
  });
});

/** Números de la cola para el panel. */
const obtenerEstadisticas = asyncWrapper(async (req, res) => {
  const stats = await ModeracionModel.estadisticas();
  res.status(200).json({ exito: true, datos: stats });
});

/** Aprueba una imagen: la publicación pasa a estar visible en el catálogo. */
const aprobarImagen = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador de la moderación no es válido.');
  }

  const imagen = await ModeracionModel.obtenerPendiente(id);
  if (!imagen?.imagen_disponible) {
    throw new NotFoundError('Los datos de la imagen ya no están disponibles.');
  }

  const resultado = await ModeracionModel.decidir({
    moderacionId: id,
    revisadoPor: req.usuario.id,
    decision: 'APROBADA',
  });

  if (resultado.yaDecidida) {
    throw new ConflictError('Esta imagen ya había sido revisada.');
  }

  res.status(200).json({
    exito: true,
    mensaje: 'Imagen aprobada. La publicación ya está visible en el catálogo.',
    datos: resultado.fila,
  });
});

/**
 * Rechaza una imagen por incumplimiento de las normas de la plataforma.
 * Los bytes de la imagen se borran de Neon.
 */
const rechazarImagen = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador de la moderación no es válido.');
  }

  const motivo = (req.body?.motivoRechazo || req.body?.motivo_rechazo || '').trim();
  if (!motivo) {
    throw new ValidationError('Indicá el motivo del rechazo.');
  }

  const archivo = await ModeracionModel.obtenerPendiente(id);
  if (!archivo) {
    throw new NotFoundError('No encontramos esa imagen en la cola de moderación.');
  }

  const resultado = await ModeracionModel.decidir({
    moderacionId: id,
    revisadoPor: req.usuario.id,
    decision: 'RECHAZADA',
    motivoRechazo: motivo.slice(0, 200),
    contieneMenor: false,
  });

  if (resultado.yaDecidida) {
    throw new ConflictError('Esta imagen ya había sido revisada.');
  }

  const eliminado = await ModeracionModel.eliminarImagen(id);
  await ModeracionModel.agregarMotivo(id, 'ARCHIVO_ELIMINADO');

  res.status(200).json({
    exito: true,
    mensaje: 'Imagen rechazada y eliminada.',
    datos: { ...resultado.fila, archivoEliminado: eliminado },
  });
});

/**
 * Rechaza una imagen porque representa a un menor de edad.
 *
 * Además de quitar la publicación, suspende la cuenta por un año de forma
 * automática: la Ley 26.061 obliga a actuar de inmediato y a preservar el
 * material para que las autoridades puedan actuar.
 */
const rechazarPorMenorDeEdad = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador de la moderación no es válido.');
  }

  const archivo = await ModeracionModel.obtenerPendiente(id);
  if (!archivo) {
    throw new NotFoundError('No encontramos esa imagen en la cola de moderación.');
  }

  const resultado = await ModeracionModel.decidir({
    moderacionId: id,
    revisadoPor: req.usuario.id,
    decision: 'RECHAZADA',
    motivoRechazo: 'Representación de persona menor de edad (Ley 26.061).',
    contieneMenor: true,
  });

  if (resultado.yaDecidida) {
    throw new ConflictError('Esta imagen ya había sido revisada.');
  }

  // En este caso el archivo NO se borra de inmediato: se conserva para que
  // las autoridades competentes puedan actuar, y queda registrado quién lo
  // detectó y cuándo.
  res.status(200).json({
    exito: true,
    mensaje:
      'Imagen rechazada y cuenta suspendida por un año. El material quedó ' +
      'reservado para su remisión a la autoridad competente.',
    datos: {
      ...resultado.fila,
      archivoRetenido: true,
      usuarioSuspendido: resultado.usuarioSuspendido,
      proximosPasos:
        'Comunicar el hallazgo a la autoridad competente en materia de ' +
        'protección de las infancias.',
    },
  });
});

/**
 * Publicaciones que no tienen imagen: la revisión es sobre el texto.
 * Sin esto, una publicación sin foto quedaría esperando para siempre.
 */
const aprobarPublicacionSinImagen = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador de la publicación no es válido.');
  }

  const resultado = await ModeracionModel.decidirPublicacionSinImagen({
    publicacionId: id,
    decision: 'APROBADA',
  });

  if (resultado.yaDecidida) {
    throw new ConflictError('Esta publicación ya había sido revisada.');
  }

  res.status(200).json({
    exito: true,
    mensaje: 'Publicación aprobada. Ya está visible en el catálogo.',
    datos: resultado.fila,
  });
});

const rechazarPublicacionSinImagen = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador de la publicación no es válido.');
  }

  const motivo = (req.body?.motivoRechazo || req.body?.motivo_rechazo || '').trim();
  if (!motivo) {
    throw new ValidationError('Indicá el motivo del rechazo.');
  }

  const resultado = await ModeracionModel.decidirPublicacionSinImagen({
    publicacionId: id,
    decision: 'RECHAZADA',
    motivoRechazo: motivo.slice(0, 200),
  });

  if (resultado.yaDecidida) {
    throw new ConflictError('Esta publicación ya había sido revisada.');
  }

  res.status(200).json({
    exito: true,
    mensaje: 'Publicación rechazada.',
    datos: resultado.fila,
  });
});

const marcarPublicacionComoMenor = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ValidationError('El identificador de la publicación no es válido.');
  }

  const fila = await ModeracionModel.marcarPublicacionComoMenor({ publicacionId: id });
  if (!fila) {
    throw new NotFoundError('No encontramos esa publicación.');
  }

  res.status(200).json({
    exito: true,
    mensaje:
      'Publicación rechazada y cuenta suspendida por un año. El hallazgo ' +
      'queda registrado para su comunicación a la autoridad competente.',
    datos: { ...fila, usuarioSuspendido: true },
  });
});

module.exports = {
  listarPendientes,
  obtenerEstadisticas,
  verImagen,
  aprobarImagen,
  rechazarImagen,
  rechazarPorMenorDeEdad,
  aprobarPublicacionSinImagen,
  rechazarPublicacionSinImagen,
  marcarPublicacionComoMenor,
};
