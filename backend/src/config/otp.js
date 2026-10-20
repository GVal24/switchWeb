/**
 * Configuración de la verificación por código de un solo uso (OTP).
 *
 * Proveedor: hoy es MOCK (no sale ningún SMS real). La interfaz queda
 * preparada para enchufar un proveedor real (Twilio, Vonage, WhatsApp
 * Business API) sin tocar el resto del flujo.
 *
 * IMPORTANTE: el código solo puede devolverse en la respuesta cuando el
 * proveedor es mock. Con un proveedor real, jamás se expone por la API.
 */

const esProduccion = process.env.NODE_ENV === 'production';

const config = {

  // El HMAC del código necesita una clave propia y estable. En producción
  // es obligatoria: sin ella, quien tenga acceso a la base de datos
  // podría recalcular los códigos, porque un código de 6 dígitos tiene
  // muy poca entropía.
  hmacSecret:
    process.env.OTP_HMAC_SECRET ||
    (esProduccion ? null : 'switch_otp_hmac_desarrollo_no_publicar'),

  // Vigencia y intentos
  longitudCodigo: 6,
  minutosValidez: Number(process.env.OTP_MINUTOS_VALIDEZ || 10),
  maxIntentos: 5,

  // Freno de abuso
  segundosEntreEnvios: 60,          // no se reenvía antes de esto
  maxEnviosPorHora: 5,              // tope por teléfono y propósito
  maxEnviosPorIpHora: 15,           // tope por IP

  // Canales, en orden de preferencia. SMS primero porque no requiere
  // conversación previa; WhatsApp queda como respaldo.
  canales: ['SMS', 'WHATSAPP'],

  // Modo mock
  mockHabilitado: process.env.OTP_MOCK_HABILITADO !== 'false',
  esProduccion,
};

if (esProduccion && !config.hmacSecret) {
  throw new Error(
    'Falta OTP_HMAC_SECRET en producción. Es obligatorio para verificar los códigos.'
  );
}

module.exports = config;
