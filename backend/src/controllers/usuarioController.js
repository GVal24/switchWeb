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

const obtenerPerfilPublico = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  // Require authentication: only logged-in users can view public profiles
  if (!req.usuario) {
    throw new Error('Necesitás iniciar sesión para ver perfiles públicos.');
  }

  const perfil = await UsuarioModel.obtenerPerfilPublico(id);

  if (!perfil) {
    throw new NotFoundError('No se encontró el perfil del usuario.');
  }

  // SECURITY: Only allow the authenticated user to view their OWN profile.
  // Prevent IDOR (Insecure Direct Object Reference) by verifying ownership.
  if (String(perfil.id) !== String(req.usuario.id)) {
    // Return unauthorized error instead of generic data
    throw new Error('No está autorizado a ver este perfil. Redirigiendo a su perfil...');
  }

  res.status(200).json({
    exito: true,
    mensaje: 'Perfil público obtenido correctamente.',
    datos: perfil
  });

});

module.exports = {
  obtenerMiPerfil,
  obtenerPerfilPublico
};
