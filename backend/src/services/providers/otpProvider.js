/**
 * Proveedores de envío de códigos OTP por SMS y WhatsApp.
 *
 * SMS primero, WhatsApp de respaldo: si el SMS no se entrega, el flujo
 * intenta el siguiente canal sin pedirle nada a la persona usuaria.
 *
 * ── Cómo se activa uno real ──────────────────────────────────────────
 * Sin configurar nada, el sistema usa MOCK (imprime el código en la
 * consola). Para salir de verdad al teléfono, poné en el .env del backend:
 *
 *   OTP_PROVEEDOR=TWILIO_SMS
 *   TWILIO_ACCOUNT_SID=ACxxxx
 *   TWILIO_AUTH_TOKEN=xxxx
 *   TWILIO_FROM=+15551234567
 *
 * O, para WhatsApp por la API oficial de Meta:
 *   OTP_PROVEEDOR=WHATSAPP_CLOUD
 *   WHATSAPP_TOKEN=xxxx
 *   WHATSAPP_PHONE_ID_ID=123456
 *   WHATSAPP_FROM=15551234567
 *
 * También se puede activar más de uno para tener el respaldo:
 *   OTP_PROVEEDOR=TWILIO_SMS,WHATSAPP_CLOUD
 *
 * En producción el código NUNCA vuelve en la respuesta de la API: sólo se
 * lo ve en los registros del proveedor.
 */

const https = require('https');
const querystring = require('querystring');

/** Post JSON contra un endpoint HTTPS. */
function postJson(url, { headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const datos = JSON.stringify(body);
    const objetivo = new URL(url);

    const req = https.request(
      {
        method: 'POST',
        hostname: objetivo.hostname,
        path: `${objetivo.pathname}${objetivo.search}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(datos),
          ...headers,
        },
        timeout: 15000,
      },
      (res) => {
        let crudo = '';
        res.on('data', (c) => {
          crudo += c;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(crudo);
          } catch (_) {
            json = null;
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, json, crudo });
          } else {
            reject(
              new Error(
                `HTTP ${res.statusCode}: ${crudo ? crudo.slice(0, 200) : 'sin cuerpo'}`
              )
            );
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Tiempo de espera agotado con el proveedor.'));
    });
    req.write(datos);
    req.end();
  });
}

/** Post form-urlencoded (formato de la API de Twilio). */
function postForm(url, { headers = {}, form }) {
  return new Promise((resolve, reject) => {
    const datos = querystring.stringify(form);
    const objetivo = new URL(url);

    const req = https.request(
      {
        method: 'POST',
        hostname: objetivo.hostname,
        path: `${objetivo.pathname}${objetivo.search}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(datos),
          ...headers,
        },
        timeout: 15000,
      },
      (res) => {
        let crudo = '';
        res.on('data', (c) => {
          crudo += c;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, crudo });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${crudo.slice(0, 200)}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Tiempo de espera agotado con el proveedor.'));
    });
    req.write(datos);
    req.end();
  });
}

const mensajeDe = (codigo, minutosValidez) =>
  `Switch: tu código de verificación es ${codigo}. Vence en ${minutosValidez} minutos. No lo compartas con nadie.`;

// ==========================================
// SMS
// ==========================================

const twilioSms = {
  nombre: 'TWILIO_SMS',
  canal: 'SMS',
  disponible: () =>
    Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM
    ),
  credencialesFaltantes: () =>
    'Faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o TWILIO_FROM en el .env',

  async enviar({ telefono, codigo, minutosValidez }) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const res = await postForm(url, {
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString('base64'),
      },
      form: {
        To: telefono,
        From: process.env.TWILIO_FROM,
        Body: mensajeDe(codigo, minutosValidez),
      },
    });
    return { entregado: true, detalle: 'SMS enviado por Twilio', id: res.crudo.slice(0, 80) };
  },
};

const vonageSms = {
  nombre: 'VONAGE_SMS',
  canal: 'SMS',
  disponible: () =>
    Boolean(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET && process.env.VONAGE_FROM),
  credencialesFaltantes: () =>
    'Faltan VONAGE_API_KEY, VONAGE_API_SECRET o VONAGE_FROM en el .env',

  async enviar({ telefono, codigo, minutosValidez }) {
    const url = 'https://rest.nexmo.com/sms/json';
    const res = await postForm(url, {
      form: {
        api_key: process.env.VONAGE_API_KEY,
        api_secret: process.env.VONAGE_API_SECRET,
        to: telefono.replace(/^\+/, ''),
        from: process.env.VONAGE_FROM,
        text: mensajeDe(codigo, minutosValidez),
      },
    });
    return { entregado: true, detalle: 'SMS enviado por Vonage', id: res.crudo.slice(0, 80) };
  },
};

// ==========================================
// WhatsApp
// ==========================================

const whatsappCloud = {
  nombre: 'WHATSAPP_CLOUD',
  canal: 'WHATSAPP',
  disponible: () =>
    Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  credencialesFaltantes: () =>
    'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en el .env',

  async enviar({ telefono, codigo, minutosValidez }) {
    const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const res = await postJson(url, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      body: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: telefono.replace(/^\+/, ''),
        type: 'text',
        text: { body: mensajeDe(codigo, minutosValidez) },
      },
    });
    return {
      entregado: true,
      detalle: 'WhatsApp enviado por la API de Meta',
      id: res.json?.messages?.[0]?.id || null,
    };
  },
};

const twilioWhatsapp = {
  nombre: 'TWILIO_WHATSAPP',
  canal: 'WHATSAPP',
  disponible: () =>
    Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM
    ),
  credencialesFaltantes: () =>
    'Faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o TWILIO_WHATSAPP_FROM en el .env',

  async enviar({ telefono, codigo, minutosValidez }) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const res = await postForm(url, {
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString('base64'),
      },
      form: {
        To: `whatsapp:${telefono.replace(/^\+/, '')}`,
        From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM.replace(/^\+/, '')}`,
        Body: mensajeDe(codigo, minutosValidez),
      },
    });
    return { entregado: true, detalle: 'WhatsApp enviado por Twilio', id: res.crudo.slice(0, 80) };
  },
};

// ==========================================
// Proveedor simulado
// ==========================================

const proveedorMock = {
  nombre: 'MOCK',
  canal: 'SMS',
  disponible: () => true,
  credencialesFaltantes: () => null,

  async enviar({ canal, codigo, minutosValidez }) {
    // eslint-disable-next-line no-console
    console.log(
      `[OTP MOCK] Canal ${canal} | Su código de Switch es ${codigo}. ` +
        `Vence en ${minutosValidez} minutos. No lo comparta con nadie.`
    );
    return { entregado: true, detalle: `Enviado por mock (${canal})` };
  },
};

// ==========================================
// Normalización del teléfono
// ==========================================

/**
 * Normaliza el teléfono a formato internacional, para que el mismo número
 * no se registre dos veces por escribirlo distinto.
 *
 * Argentina: se acepta 10 dígitos (se asume Buenos Aires, prefijo 11),
 * 11 dígitos con el 15 adelante, o 13 con el 549.
 */
function normalizarTelefono(telefono) {
  if (telefono === null || telefono === undefined) return null;

  let digitos = String(telefono).replace(/\D/g, '');
  if (!digitos) return null;

  // 549 15 XXXXX-XXXX -> 549 XXXXX-XXXX
  if (digitos.length === 13 && digitos.startsWith('54915')) {
    digitos = `54${digitos.slice(4)}`;
  } else if (digitos.length === 11 && digitos.startsWith('15')) {
    digitos = `54${digitos.slice(2)}`;
  } else if (digitos.length === 10) {
    digitos = `54911${digitos}`;
  }

  return digitos;
}

function esTelefonoValido(telefono) {
  const n = normalizarTelefono(telefono);
  if (!n) return false;
  return /^\d{8,15}$/.test(n);
}

// ==========================================
// Selección de proveedor
// ==========================================

const REGISTRO_PROVEEDORES = {
  MOCK: proveedorMock,
  TWILIO_SMS: twilioSms,
  TWILIO_WHATSAPP: twilioWhatsapp,
  VONAGE_SMS: vonageSms,
  WHATSAPP_CLOUD: whatsappCloud,
};

/**
 * Devuelve la lista de proveedores a intentar, en orden de preferencia.
 *
 * Si OTP_PROVEEDOR no está definido se elige MOCK. Si está definido pero
 * alguno de los nombrados no tiene credenciales, se avisa con precisión en
 * vez de caer silenciosamente al mock: mandar un código a la consola
 * creyendo que salió al teléfono sería un error grave en producción.
 */
function obtenerCadenaDeProveedores() {
  const configurado = (process.env.OTP_PROVEEDOR || 'MOCK')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const cadena = [];
  const problemas = [];

  for (const nombre of configurado) {
    const proveedor = REGISTRO_PROVEEDORES[nombre];
    if (!proveedor) {
      problemas.push(`"${nombre}" no es un proveedor conocido.`);
      continue;
    }
    if (!proveedor.disponible()) {
      problemas.push(`${nombre}: ${proveedor.credencialesFaltantes()}`);
      continue;
    }
    // Un mismo proveedor no se repite.
    if (!cadena.some((p) => p.nombre === nombre)) cadena.push(proveedor);
  }

  if (cadena.length === 0) {
    if (configurado.includes('MOCK')) {
      return { cadena: [proveedorMock], problemas, usandoMock: true };
    }
    // Se pidió un proveedor real pero no sirve: no se degrada al mock en
    // silencio, se informa para que nadie crea que el SMS salió.
    return {
      cadena: [],
      problemas: [
        ...problemas,
        'Ningún proveedor está configurado. Definí OTP_PROVEEDOR=MOCK para ' +
          'desarrollar, o completá las credenciales de un proveedor real.',
      ],
      usandoMock: false,
    };
  }

  return { cadena, problemas, usandoMock: cadena[0].nombre === 'MOCK' };
}

module.exports = {
  normalizarTelefono,
  esTelefonoValido,
  obtenerCadenaDeProveedores,
  REGISTRO_PROVEEDORES,
};
