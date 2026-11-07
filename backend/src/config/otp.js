/**
 * Configuración de la verificación por código de un solo uso (OTP).
 *
 * Proveedor: hoy es MOCK (no sale ningún SMS real). La interfaz queda
 * preparada para enchufar un proveedor real (Twilio, Vonage, WhatsApp
 * Business API) sin tocar el resto del flujo.
 *
 */

const esProduccion =
  process.env.NODE_ENV === 'production' ||
  String(process.env.RENDER || '').toLowerCase() === 'true' ||
  Boolean(process.env.RENDER_SERVICE_ID);

const config = {

  // El HMAC del código necesita una clave propia y estable. En producción
  // es obligatoria: sin ella, quien tenga acceso a la base de datos
  // podría recalcular los códigos.
  hmacSecret:
    process.env.OTP_HMAC_SECRET ||
    (esProduccion ? null : 'switch_otp_hmac_desarrollo_no_publicar'),

  // Vigencia y intentos
  longitudCodigo: 6,
  minutosValidez: Number(process.env.OTP_MINUTOS_VALIDEZ || 10),
  maxIntentos: 5,

  // Freno de abuso
  segundosEntreEnvios: 60,         
  maxEnviosPorHora: 5,             
  maxEnviosPorIpHora: 15,          

  // Canales, en orden de preferencia.
  canales: ['SMS', 'WHATSAPP'],

  // Modo mock
  mockHabilitado: process.env.OTP_MOCK_HABILITADO !== 'false',
  esProduccion,

  // Modo mock en producción. Está apagado por defecto porque el código
  // vuelve en la respuesta de la API: cualquiera podría verificar cualquier
  // teléfono. Se enciende sólo para demos controladas con
  // OTP_PERMITIR_MOCK_PRODUCCION=true.
  permitirMockProduccion:
    String(process.env.OTP_PERMITIR_MOCK_PRODUCCION || '').toLowerCase() === 'true',

  // Allowlist opcional para el mock en producción. Si está vacía, el mock
  // acepta cualquier teléfono (siempre que el permiso anterior esté activo).
  // Se comparan los dígitos: sirve tanto el número completo como los últimos
  // 10 dígitos.
  telefonosMockProduccion: String(process.env.OTP_MOCK_TELEFONOS || '')
    .split(',')
    .map((t) => t.replace(/\D/g, ''))
    .filter(Boolean),
};

if (esProduccion && !config.hmacSecret) {
  throw new Error(
    'Falta OTP_HMAC_SECRET en producción. Es obligatorio para verificar los códigos.'
  );
}

if (esProduccion && config.permitirMockProduccion) {
  // eslint-disable-next-line no-console
  console.warn(
    '[OTP] ATENCIÓN: el modo MOCK está habilitado en producción. ' +
      'El código de verificación se devuelve en la respuesta de la API. ' +
      'Usalo sólo para una demo controlada y apagalo después.'
  );
}

module.exports = config;
