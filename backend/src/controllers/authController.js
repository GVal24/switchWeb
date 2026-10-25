const asyncWrapper = require('../middlewares/asyncWrapper');
const AuthService = require('../services/authService');
const OtpService = require('../services/otpService');
const UsuarioModel = require('../models/usuarioModel');
const { ValidationError } = require('../utils/customErrors');

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

const solicitarResetPassword = asyncWrapper(async (req, res) => {
  const dni = String(req.body.dni || '').replace(/\D/g, '');
  if (dni.length !== 8) {
    throw new ValidationError('El DNI es obligatorio.');
  }

  const telefono = await UsuarioModel.obtenerTelefonoParaReset(dni);
  let codigoMock;
  if (telefono) {
    const resultado = await OtpService.solicitar({
      telefono,
      proposito: 'RESTABLECIMIENTO',
      ipOrigen: req.ip || req.connection?.remoteAddress || null,
    });
    codigoMock = resultado.codigoMock;
  }

  res.status(200).json({
    exito: true,
    mensaje: 'Si el DNI está registrado, enviamos un código al teléfono asociado.',
    datos: codigoMock ? { codigoMock } : {},
  });
});

const verificarCodigoResetPassword = asyncWrapper(async (req, res) => {
  const dni = String(req.body.dni || '').replace(/\D/g, '');
  const codigo = String(req.body.codigo || '').trim();
  if (dni.length !== 8 || !codigo) {
    throw new ValidationError('Ingresá el DNI y el código recibido.');
  }

  const telefono = await UsuarioModel.obtenerTelefonoParaReset(dni);
  if (!telefono) {
    throw new ValidationError('El código no es válido o venció. Pedí uno nuevo.');
  }

  await OtpService.verificar({
    telefono,
    codigo,
    proposito: 'RESTABLECIMIENTO',
  });
  const reset = await UsuarioModel.crearTokenReset({
    dni,
    telefono,
  });
  if (!reset) {
    throw new ValidationError('No pudimos validar la solicitud. Pedí un código nuevo.');
  }

  res.status(200).json({
    exito: true,
    datos: { token: reset.token },
  });
});

const confirmarResetPassword = asyncWrapper(async (req, res) => {
  const { token, nuevaPassword } = req.body;
  if (!token || typeof nuevaPassword !== 'string' || nuevaPassword.length < 6) {
    throw new ValidationError('La contraseña debe tener al menos 6 caracteres.');
  }
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
  verificarCodigoResetPassword,
  confirmarResetPassword
};