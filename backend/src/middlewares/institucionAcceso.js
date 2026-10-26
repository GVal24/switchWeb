const { ForbiddenError } = require('../utils/customErrors');
const InstitucionModel = require('../models/institucionModel');

async function requerirMembresiaInstitucion(req, res, next) {
  try {
    const institucionId = Number(req.params.institucionId);
    if (!Number.isInteger(institucionId) || institucionId < 1) {
      throw new ForbiddenError('La institución indicada no es válida.');
    }

    const membresia = await InstitucionModel.obtenerMembresiaActiva(
      institucionId,
      req.usuario.id
    );
    if (!membresia) {
      throw new ForbiddenError('No tenés acceso de gestión a esta institución.');
    }
    req.membresiaInstitucion = membresia;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requerirResponsableInstitucion(req, res, next) {
  if (req.membresiaInstitucion?.rol !== 'RESPONSABLE') {
    return next(new ForbiddenError('Solo la persona responsable puede administrar delegados.'));
  }
  return next();
}

module.exports = {
  requerirMembresiaInstitucion,
  requerirResponsableInstitucion
};
