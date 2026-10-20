const asyncWrapper = require('../middlewares/asyncWrapper');
const { NotFoundError } = require('../utils/customErrors');
const UsuarioModel = require('../models/usuarioModel');

/**
 * GET /api/usuarios/perfil
 * Datos + estadísticas reales del usuario logueado (viene del token).
 */
const obtenerMiPerfil = asyncWrapper(async (req, res) => {
  const perfil = await UsuarioModel.obtenerPerfilConEstadisticas(req.usuario.id);

  if (!perfil) {
    throw new NotFoundError('No se encontró tu usuario o fue dado de baja.');
  }

  res.status(200).json({
    exito: true,
    mensaje: 'Perfil obtenido correctamente.',
    datos: perfil
  });
});

module.exports = {
  obtenerMiPerfil
};
