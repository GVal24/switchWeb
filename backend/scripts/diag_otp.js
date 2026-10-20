/**
 * Diagnóstico del cooldown de OTP.
 */
require('dotenv').config();
const db = require('../src/config/db');

(async () => {
  const r = await db.query(`
    SELECT telefono, proposito, canal, creado_en, expira_en, consumido_en
    FROM verificaciones_otp
    WHERE telefono IN ('1155550001', '5491155550001')
    ORDER BY creado_en DESC
    LIMIT 10;
  `);
  console.log('Filas OTP del número de prueba:');
  console.table(r.rows);

  const recientes = await db.query(
    `SELECT COUNT(*)::int AS n FROM verificaciones_otp
     WHERE creado_en > CURRENT_TIMESTAMP - INTERVAL '15 minutes'`
  );
  console.log('OTP creados en los últimos 15 minutos (todo):', recientes.rows[0].n);

  const ip = await db.query(
    `SELECT ip_origen, COUNT(*)::int AS n FROM verificaciones_otp
     WHERE creado_en > CURRENT_TIMESTAMP - INTERVAL '1 hour'
     GROUP BY ip_origen ORDER BY n DESC LIMIT 5;
  `);
  console.log('Por IP en la última hora:');
  console.table(ip.rows);

  await db.pool.end();
})();
