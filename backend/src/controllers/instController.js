const asyncWrapper = require('../middlewares/asyncWrapper');
const { ValidationError, NotFoundError } = require('../utils/customErrors');
const InstitucionModel = require('../models/institucionModel');
const VoluntariadoModel = require('../models/voluntariadoModel');
const geoUtils = require('../utils/geoUtils');

const RADIO_MAXIMO_METROS = 200;

/**
 * Obtener listado de instituciones comunitarias de la zona
 */
const listarInstituciones = asyncWrapper(async (req, res) => {
  const instituciones = await InstitucionModel.obtenerTodas();

  res.status(200).json({
    exito: true,
    datos: instituciones
  });
});

/**
 * Obtener cupos de necesidad abiertos para una institución
 */
const obtenerCuposAbiertos = asyncWrapper(async (req, res) => {
  const { institucionId } = req.params;

  if (!institucionId) {
    throw new ValidationError("El ID de la institución es obligatorio.");
  }

  const cupos = await VoluntariadoModel.obtenerCuposPorInstitucion(institucionId);

  res.status(200).json({
    exito: true,
    datos: cupos
  });
});

/**
 * Validar presencia mediante escaneo de QR + GPS (Activa el Nexo Social)
 */
const validarPresenciaQR = asyncWrapper(async (req, res) => {
  const { qrCodigoHash, latitudUsuario, longitudUsuario, cupoNecesidadId } = req.body;
  // El usuario siempre es el de la sesión (no se confía en el body)
  const usuarioId = req.usuario.id;

  if (!qrCodigoHash) {
    throw new ValidationError("El código QR no es válido.");
  }

  const institucion = await InstitucionModel.obtenerPorQrHash(qrCodigoHash);

  if (!institucion) {
    throw new NotFoundError("El código QR escaneado no corresponde a ninguna institución registrada en Switch.");
  }

  // Validación de distancia real (opcional, se activa con GPS_VALIDACION_ACTIVA=true en .env)
  const gpsActivo = (process.env.GPS_VALIDACION_ACTIVA || 'false').toLowerCase() === 'true';
  if (gpsActivo && latitudUsuario != null && longitudUsuario != null
      && institucion.latitud != null && institucion.longitud != null) {
    const distancia = geoUtils.calcularDistanciaMetros(
      Number(latitudUsuario), Number(longitudUsuario),
      Number(institucion.latitud), Number(institucion.longitud)
    );
    if (distancia > RADIO_MAXIMO_METROS) {
      throw new ValidationError(
        `Te encontrás a ${Math.round(distancia)} metros de ${institucion.nombre}. ` +
        `Acercate hasta el lugar (máximo ${RADIO_MAXIMO_METROS} m) para validar tu presencia.`
      );
    }
  }

  const nexoSocial = await VoluntariadoModel.registrarNexoSocial({
    usuarioId,
    cupoNecesidadId,
    institucionId: institucion.id,
    latitudUsuario,
    longitudUsuario
  });

  // Si la ayuda apunta a una necesidad concreta, se descuenta del cupo
  let mensajeCupo = '';
  const cupo = nexoSocial.cupo_actualizado;
  if (cupo) {
    mensajeCupo = cupo.completo
      ? ` ¡La necesidad "${cupo.titulo}" quedó cubierta, gracias a tu ayuda!`
      : ` Tu ayuda quedó registrada en "${cupo.titulo}" (${cupo.cupo_actual}/${cupo.cupo_maximo}).`;
  }
  delete nexoSocial.cupo_actualizado;

  // Recompensa por nivel: días extra de Nexo Social
  let mensajeBonus = '';
  if (nexoSocial.bonus_nivel > 0) {
    mensajeBonus = ` Bonus de tu nivel ${nexoSocial.bonus_nivel >= 120 ? 5 : nexoSocial.bonus_nivel >= 60 ? 4 : 3}: +${nexoSocial.bonus_nivel} días extra de Nexo.`;
  }
  delete nexoSocial.bonus_nivel;

  // Transparencia: se explica cómo se calculó la vigencia
  let mensajeDetalle = '';
  if (nexoSocial.prioridad_aplicada) {
    const etiquetaEsfuerzo = nexoSocial.esfuerzo_aplicado && nexoSocial.esfuerzo_aplicado !== 'SIMPLE'
      ? ` y esfuerzo ${String(nexoSocial.esfuerzo_aplicado).toLowerCase()}`
      : '';
    mensajeDetalle = ` Necesidad ${String(nexoSocial.prioridad_aplicada).toLowerCase()}${etiquetaEsfuerzo}.`;
  }
  delete nexoSocial.prioridad_aplicada;
  delete nexoSocial.esfuerzo_aplicado;

  res.status(201).json({
    exito: true,
    mensaje: `¡Nexo Social activado exitosamente por colaborar con ${institucion.nombre}! Vence el ${nexoSocial.fecha_expiracion}.${mensajeDetalle}${mensajeCupo}${mensajeBonus}`,
    datos: nexoSocial
  });
});

/**
 * POST /api/instituciones/registro (público)
 * Formulario exclusivo para instituciones que quieren participar en Switch.
 * Body: { nombre, tipo, direccion, telefono?, descripcion?, necesidades: [{titulo, descripcion?, cupoMaximo}] }
 */
const registrarInstitucion = asyncWrapper(async (req, res) => {
  const { nombre, tipo, direccion, telefono, descripcion, necesidades } = req.body;

  if (!nombre || !String(nombre).trim() || !tipo || !direccion || !String(direccion).trim()) {
    throw new ValidationError('Se requieren el nombre, el tipo y la dirección de la institución.');
  }

  if (!Array.isArray(necesidades) || necesidades.length === 0) {
    throw new ValidationError('Cargá al menos una necesidad de voluntariado para que los vecinos puedan ayudarte.');
  }

  const institucion = await InstitucionModel.crearConNecesidades({
    nombre: String(nombre).trim(),
    tipo,
    direccion: String(direccion).trim(),
    telefono,
    descripcion,
    necesidades
  });

  res.status(201).json({
    exito: true,
    mensaje: `¡${institucion.nombre} ya forma parte de Switch! Tus necesidades ya son visibles para la comunidad.`,
    datos: institucion
  });
});

module.exports = {
  listarInstituciones,
  obtenerCuposAbiertos,
  validarPresenciaQR,
  registrarInstitucion
};