const asyncWrapper = require('../middlewares/asyncWrapper');
const { ValidationError, NotFoundError } = require('../utils/customErrors');
const SugerenciaModel = require('../models/sugerenciaModel');
const P2PModel = require('../models/p2pModel');

/**
 * POST /api/catalogo/:publicacionId/sugerir-esfuerzo
 * Body: { nivelSugerido: 'SIMPLE' | 'MEDIO' | 'ALTO' }
 * Un usuario marca que el esfuerzo de una publicación está mal clasificado.
 */
const sugerirEsfuerzo = asyncWrapper(async (req, res) => {
  const { publicacionId } = req.params;
  const { nivelSugerido } = req.body;
  const usuarioId = req.usuario.id;

  if (!['SIMPLE', 'MEDIO', 'ALTO'].includes(nivelSugerido)) {
    throw new ValidationError('El nivel sugerido debe ser SIMPLE, MEDIO o ALTO.');
  }

  const publicaciones = await P2PModel.obtenerPorIds([Number(publicacionId)]);
  if (publicaciones.length === 0) {
    throw new NotFoundError('La publicación no existe.');
  }

  if (publicaciones[0].nivel_esfuerzo === nivelSugerido) {
    throw new ValidationError('Esa publicación ya está clasificada con ese nivel.');
  }

  await SugerenciaModel.sugerir({
    publicacionId: Number(publicacionId),
    usuarioId,
    nivelSugerido
  });

  res.status(201).json({
    exito: true,
    mensaje: '¡Gracias! El equipo va a revisar la clasificación.'
  });
});

/**
 * GET /api/admin/sugerencias-esfuerzo
 * Sugerencias pendientes de revisión.
 */
const listarSugerencias = asyncWrapper(async (req, res) => {
  const sugerencias = await SugerenciaModel.listarPendientes();

  res.status(200).json({
    exito: true,
    datos: sugerencias
  });
});

/**
 * POST /api/admin/sugerencias-esfuerzo/:id/aplicar
 * Cambia el nivel de esfuerzo de la publicación por el sugerido.
 */
const aplicarSugerencia = asyncWrapper(async (req, res) => {
  const resultado = await SugerenciaModel.aplicar(Number(req.params.id));

  if (!resultado) {
    throw new NotFoundError('La sugerencia no existe o ya fue revisada.');
  }

  res.status(200).json({
    exito: true,
    mensaje: `Nivel actualizado a ${resultado.publicacion.nivel_esfuerzo} en "${resultado.publicacion.titulo}".`,
    datos: resultado.publicacion
  });
});

/**
 * POST /api/admin/sugerencias-esfuerzo/:id/descartar
 */
const descartarSugerencia = asyncWrapper(async (req, res) => {
  const resultado = await SugerenciaModel.descartar(Number(req.params.id));

  if (!resultado) {
    throw new NotFoundError('La sugerencia no existe o ya fue revisada.');
  }

  res.status(200).json({
    exito: true,
    mensaje: 'Sugerencia descartada.'
  });
});

module.exports = {
  sugerirEsfuerzo,
  listarSugerencias,
  aplicarSugerencia,
  descartarSugerencia
};
