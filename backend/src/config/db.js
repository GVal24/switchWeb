const { Pool } = require('pg');
const { esRender } = require('./environment');

const connectionString = process.env.DATABASE_URL;
const host = process.env.DB_HOST || (esRender ? '' : 'localhost');
const usaSsl =
  String(process.env.DB_SSL || '').toLowerCase() === 'true' ||
  /neon\.tech|supabase|render\.com|amazonaws\.com/i.test(
    `${host} ${connectionString || ''}`
  );

if (
  esRender &&
  !connectionString &&
  (!host || !process.env.DB_USER || !process.env.DB_NAME || !process.env.DB_PASSWORD)
) {
  throw new Error(
    'Falta la configuración de PostgreSQL en Render. Configurá DATABASE_URL o DB_HOST, DB_USER, DB_NAME y DB_PASSWORD con las credenciales de Neon.'
  );
}

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ...(usaSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host,
        database: process.env.DB_NAME || 'switch_db',
        ...(process.env.DB_PASSWORD ? { password: process.env.DB_PASSWORD } : {}),
        port: process.env.DB_PORT || 5432,
        ...(usaSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      }
);

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error al conectar con PostgreSQL:', err.stack);
  } else {
    console.log('🟢 Conexión exitosa a PostgreSQL');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};