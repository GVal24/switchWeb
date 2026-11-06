const asyncWrapper = require('../middlewares/asyncWrapper');
const { NotFoundError } = require('../utils/customErrors');
const UsuarioModel = require('../models/usuarioModel');
const VoluntariadoModel = require('../models/voluntariadoModel');

/**
 * GET /api/usuarios/perfil
 * Datos + estadísticas reales del usuario logueado (viene del token).
 * Incluye si tiene Nexo Social activo: el frontend lo usa para explicar por
 * qué puede mirar el catálogo pero todavía no publicar ni intercambiar.
 */
const obtenerMiPerfil = asyncWrapper(async (req, res) => {
  const perfil = await UsuarioModel.obtenerPerfilConEstadisticas(req.usuario.id);

  if (!perfil) {
    throw new NotFoundError('No se encontró tu usuario o fue dado de baja.');
  }

  const nexoActivo = await VoluntariadoModel.verificarNexoSocialActivo(req.usuario.id);

  res.status(200).json({
    exito: true,
    mensaje: 'Perfil obtenido correctamente.',
    datos: { ...perfil, nexoActivo }
  });
});

module.exports = {
  obtenerMiPerfil
};
