/**
 * Aplica a switch_db las tablas nuevas del esquema:
 *   - verificaciones_otp
 *   - aceptaciones_legales
 *
 * Es idempotente: se puede volver a ejecutar sin romper nada.
 * Ejecutar con: node backend/scripts/migrar_otp_legales.js
 */
require('dotenv').config();
const db = require('../src/config/db');

const TABLAS = {
  verificaciones_otp: `
    CREATE TABLE IF NOT EXISTS verificaciones_otp (
        id SERIAL PRIMARY KEY,
        telefono VARCHAR(20) NOT NULL,
        proposito VARCHAR(30) NOT NULL,
        canal VARCHAR(10) NOT NULL,
        codigo_hash VARCHAR(64) NOT NULL,
        ip_origen VARCHAR(45) NULL,
        intentos INT NOT NULL DEFAULT 0,
        max_intentos INT NOT NULL DEFAULT 5,
        expira_en TIMESTAMP NOT NULL,
        consumido_en TIMESTAMP NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT chk_otp_proposito CHECK (proposito IN ('REGISTRO')),
        CONSTRAINT chk_otp_canal CHECK (canal IN ('SMS', 'WHATSAPP'))
    )`,

  aceptaciones_legales: `
    CREATE TABLE IF NOT EXISTS aceptaciones_legales (
        id SERIAL PRIMARY KEY,
        usuario_id INT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        documento VARCHAR(20) NOT NULL,
        version VARCHAR(20) NOT NULL,
        hash_documento VARCHAR(64) NOT NULL,
        ip_origen VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        aceptado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT chk_doc_aceptado CHECK (documento IN ('TERMINOS', 'PRIVACIDAD'))
    )`,
};

(async () => {
  try {
    for (const [nombre, sql] of Object.entries(TABLAS)) {
      // eslint-disable-next-line no-await-in-loop
      await db.query(sql);
      // eslint-disable-next-line no-await-in-loop
      const existe = await db.query(
        `SELECT COUNT(*)::int AS n FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [nombre]
      );
      console.log(`${existe.rows[0].n > 0 ? 'OK' : 'FALLO'}  ${nombre}`);
    }

    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_otp_telefono_proposito
         ON verificaciones_otp (telefono, proposito, creado_en DESC)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_otp_expira_en
         ON verificaciones_otp (expira_en)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_aceptaciones_usuario
         ON aceptaciones_legales (usuario_id)`
    );
    console.log('OK  índices');

    const c1 = await db.query('SELECT COUNT(*)::int AS n FROM verificaciones_otp');
    const c2 = await db.query('SELECT COUNT(*)::int AS n FROM aceptaciones_legales');
    console.log(`\nverificaciones_otp: ${c1.rows[0].n} filas`);
    console.log(`aceptaciones_legales: ${c2.rows[0].n} filas`);

    process.exit(0);
  } catch (err) {
    console.error('Error en la migración:', err.message);
    process.exit(1);
  }
})();
