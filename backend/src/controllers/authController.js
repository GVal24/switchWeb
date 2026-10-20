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

module.exports = {
  registrarUsuario,
  loginUsuario
};