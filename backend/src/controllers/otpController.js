const asyncWrapper = require('../middlewares/asyncWrapper');
const OtpService = require('../services/otpService');

/**
 * Extrae la IP real del cliente para el freno de abuso.
 * Sólo se mira X-Forwarded-For si hay un proxy configurado (trust proxy),
 * de lo contrario, cualquiera podría mandar ese encabezado y evadir el límite.
 */
function obtenerIp(req) {
  const ip = req.ip || req.connection?.remoteAddress || null;
  return ip ? String(ip).slice(0, 45) : null;
}

/**
 * POST /api/auth/otp/solicitar
 * Body: { telefono, proposito?, canalPreferido? }
 * Público: se llama antes de tener cuenta.
 */
const solicitarCodigo = asyncWrapper(async (req, res) => {
  const { telefono, proposito, canalPreferido } = req.body;

  const resultado = await OtpService.solicitar({
    telefono,
    proposito,
    ipOrigen: obtenerIp(req),
    canalPreferido,
  });

  res.status(200).json({
    exito: true,
    mensaje: `Te enviamos un código de verificación por ${resultado.canalEnviado}.`,
    datos: resultado,
  });
});

/**
 * POST /api/auth/otp/verificar
 * Body: { telefono, codigo, proposito? }
 * Si el código es correcto, devuelve un comprobante firmado
 * (tokenVerificacion) que exige luego /api/auth/registro.
 */
const verificarCodigo = asyncWrapper(async (req, res) => {
  const { telefono, codigo, proposito } = req.body;

  const resultado = await OtpService.verificar({
    telefono,
    codigo,
    proposito,
  });

  res.status(200).json({
    exito: true,
    mensaje: 'Teléfono verificado correctamente.',
    datos: resultado,
  });
});

module.exports = {
  solicitarCodigo,
  verificarCodigo,
};
