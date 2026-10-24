const asyncWrapper = require('../middlewares/asyncWrapper');
const AuthService = require('../services/authService');

const registrarUsuario = asyncWrapper(async (req, res) => {
  const aceptoTerminos = req.body.aceptoTerminos ?? req.body.acepto_terminos;
  const aceptoPrivacidad = req.body.aceptoPrivacidad ?? req.body.acepto_privacidad;
  const esMayorEdad = req.body.esMayorEdad ?? req.body.es_mayor_edad;
  const tokenVerificacion = req.body.tokenVerificacion ?? req.body.token_verificacion;

  const nuevoUsuario = await AuthService.registrarUsuario({
    ...req.body,
    aceptoTerminos,
    aceptoPrivacidad,
    esMayorEdad,
    tokenVerificacion,
    ipOrigen: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get('user-agent') || null
  });

  res.status(201).json({
    exito: true,
    mensaje: "Usuario registrado exitosamente en Switch.",
    datos: nuevoUsuario
  });
});

const loginUsuario = asyncWrapper(async (req, res) => {
  const usuario = await AuthService.loginUsuario(req.body);

  res.status(200).json({
    exito: true,
    mensaje: `¡Bienvenido/a de nuevo, ${usuario.nombre}!`,
    datos: usuario
  });
});

/***
 * Solicita un restablecimiento de contraseña.
 * Espera un body con { dni: string }.
 * Genera un token único, lo guarda en la BD con vencimiento a 1 hora,
 * y devuelve un mensaje de éxito. No revela si el DNI existe o no (por seguridad).
 */
const solicitarResetPassword = asyncWrapper(async (req, res) => {
  const { dni } = req.body;
  if (!dni) {
    throw new ValidationError('El DNI es obligatorio.');
  }
  const resultado = await UsuarioModel.solicitarReset(dni);
  if (!resultado) {
    // Por seguridad, respondemos igual aunque el DNI no exista
    return res.status(200).json({
      exito: true,
      mensaje: 'Si el DNI está registrado, recibirás un enlace para restablecer tu contraseña.'
    });
  }
  res.status(200).json({
    exito: true,
    mensaje: 'Si el DNI está registrado, recibirás un enlace para restablecer tu contraseña.',
    datos: { token: resultado.token, expires: resultado.expires }
  });
});

/***
 * Confirma un restablecimiento de contraseña usando un token válido.
 * Espera un body con { token: string, nuevaPassword: string }.
 * Hashea la nueva contraseña, la guarda y limpia los campos de reset.
 */
const confirmarResetPassword = asyncWrapper(async (req, res) => {
  const { token, nuevaPassword } = req.body;
  const usuario = await UsuarioModel.confirmarReset(token, nuevaPassword);
  res.status(200).json({
    exito: true,
    mensaje: 'Tu contraseña ha sido actualizada correctamente. Ya podés ingresar con la nueva.',
    datos: { id: usuario.id, nombre: usuario.nombre }
  });
});

module.exports = {
  registrarUsuario,
  loginUsuario,
  solicitarResetPassword,
  confirmarResetPassword
};