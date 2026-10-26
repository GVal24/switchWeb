const asyncWrapper = require('../middlewares/asyncWrapper');
const { ValidationError, NotFoundError } = require('../utils/customErrors');
const InstitucionModel = require('../models/institucionModel');

const listarInstituciones = asyncWrapper(async (req, res) => {
  const instituciones = await InstitucionModel.listarParaAdministracion();
  res.status(200).json({
    exito: true,
    datos: instituciones
  });
});

const asignarResponsable = asyncWrapper(async (req, res) => {
  const institucionId = Number(req.params.institucionId);
  const dni = String(req.body?.dni || '').replace(/\D/g, '');

  if (!Number.isInteger(institucionId) || institucionId < 1) {
    throw new ValidationError('El ID de la institución no es válido.');
  }
  if (!/^\d{8}$/.test(dni)) {
    throw new ValidationError('Ingresá el DNI de 8 dígitos de una cuenta ya registrada.');
  }

  const asignacion = await InstitucionModel.asignarResponsable(
    institucionId,
    dni,
    req.usuario.id
  );
  res.status(200).json({
    exito: true,
    mensaje: `${asignacion.usuario.nombre} ${asignacion.usuario.apellido} ahora es responsable de ${asignacion.institucion.nombre}.`,
    datos: asignacion
  });
});

const obtenerPerfilPublico = asyncWrapper(async (req, res) => {
  const institucionId = Number(req.params.institucionId);
  if (!Number.isInteger(institucionId) || institucionId < 1) {
    throw new ValidationError('El ID de la institución no es válido.');
  }
  const perfil = await InstitucionModel.obtenerPerfilPublico(institucionId);
  if (!perfil) throw new NotFoundError('No encontramos la institución indicada.');
  res.status(200).json({ exito: true, datos: perfil });
});

const obtenerMiPanel = asyncWrapper(async (req, res) => {
  const instituciones = await InstitucionModel.obtenerPanelUsuario(req.usuario.id);
  const panel = await Promise.all(instituciones.map(async (institucion) => ({
    ...institucion,
    necesidades: await InstitucionModel.listarNecesidadesGestion(institucion.id),
    delegados: institucion.rol_membresia === 'RESPONSABLE'
      ? await InstitucionModel.listarDelegados(institucion.id)
      : []
  })));
  res.status(200).json({ exito: true, datos: panel });
});

const crearNecesidad = asyncWrapper(async (req, res) => {
  const necesidad = validarNecesidad(req.body);
  const creada = await InstitucionModel.crearNecesidad(req.params.institucionId, necesidad);
  res.status(201).json({ exito: true, mensaje: 'Necesidad creada correctamente.', datos: creada });
});

const actualizarNecesidad = asyncWrapper(async (req, res) => {
  const necesidadId = Number(req.params.necesidadId);
  if (!Number.isInteger(necesidadId) || necesidadId < 1) {
    throw new ValidationError('El ID de la necesidad no es válido.');
  }
  const necesidad = validarNecesidad(req.body);
  const actualizada = await InstitucionModel.actualizarNecesidad(
    req.params.institucionId,
    necesidadId,
    necesidad
  );
  if (!actualizada) {
    throw new ValidationError('La necesidad no existe o el cupo máximo no puede ser menor a las colaboraciones ya registradas.');
  }
  res.status(200).json({ exito: true, mensaje: 'Necesidad actualizada correctamente.', datos: actualizada });
});

const cambiarPausaNecesidad = asyncWrapper(async (req, res) => {
  const necesidadId = Number(req.params.necesidadId);
  const pausada = req.body.pausada;
  if (!Number.isInteger(necesidadId) || necesidadId < 1 || typeof pausada !== 'boolean') {
    throw new ValidationError('Indicá una necesidad válida y si debe quedar pausada.');
  }
  const actualizada = await InstitucionModel.cambiarPausaNecesidad(
    req.params.institucionId,
    necesidadId,
    pausada
  );
  if (!actualizada) throw new NotFoundError('No encontramos esa necesidad para esta institución.');
  res.status(200).json({
    exito: true,
    mensaje: pausada ? 'Necesidad pausada.' : 'Necesidad reactivada.',
    datos: actualizada
  });
});

const agregarDelegado = asyncWrapper(async (req, res) => {
  const dni = String(req.body?.dni || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(dni)) {
    throw new ValidationError('Ingresá el DNI de 8 dígitos de una cuenta ya registrada.');
  }
  const resultado = await InstitucionModel.agregarDelegado(
    req.params.institucionId,
    dni,
    req.usuario.id
  );
  res.status(201).json({
    exito: true,
    mensaje: `${resultado.usuario.nombre} ${resultado.usuario.apellido} fue agregado/a como delegado/a.`,
    datos: resultado.membresia
  });
});

const quitarDelegado = asyncWrapper(async (req, res) => {
  const membresiaId = Number(req.params.membresiaId);
  if (!Number.isInteger(membresiaId) || membresiaId < 1) {
    throw new ValidationError('El ID de membresía no es válido.');
  }
  const quitado = await InstitucionModel.quitarDelegado(req.params.institucionId, membresiaId);
  if (!quitado) throw new NotFoundError('No encontramos un delegado activo con ese ID.');
  res.status(200).json({ exito: true, mensaje: 'Se revocó el acceso del delegado.' });
});

function validarNecesidad(body) {
  const datos = body && typeof body === 'object' ? body : {};
  const titulo = String(datos.titulo || '').trim();
  const descripcion = String(datos.descripcion || '').trim();
  const prioridad = String(datos.prioridad || 'GENERAL').toUpperCase();
  const cupoMaximo = Number(datos.cupoMaximo);
  if (!titulo || titulo.length > 100) {
    throw new ValidationError('El título es obligatorio y debe tener como máximo 100 caracteres.');
  }
  if (descripcion.length > 500) {
    throw new ValidationError('La descripción debe tener como máximo 500 caracteres.');
  }
  if (!['GENERAL', 'PRIORITARIA', 'URGENTE'].includes(prioridad)) {
    throw new ValidationError('La prioridad indicada no es válida.');
  }
  if (!Number.isInteger(cupoMaximo) || cupoMaximo < 1 || cupoMaximo > 999) {
    throw new ValidationError('El cupo debe ser un número entero entre 1 y 999.');
  }
  return { titulo, descripcion, prioridad, cupoMaximo };
}

module.exports = {
  listarInstituciones,
  asignarResponsable,
  obtenerPerfilPublico,
  obtenerMiPanel,
  crearNecesidad,
  actualizarNecesidad,
  cambiarPausaNecesidad,
  agregarDelegado,
  quitarDelegado,
  validarNecesidad
};
