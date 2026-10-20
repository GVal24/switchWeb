const { Pool } = require('pg');
require('dotenv').config();

// SSL: las bases administradas (Neon, Supabase, Render, etc.) exigen
// conexión cifrada. En desarrollo local (PostgreSQL en la misma máquina)
// no hace falta. Se activa con DB_SSL=true, o se detecta solo por el host.
const usarSsl =
  String(process.env.DB_SSL || '').toLowerCase() === 'true' ||
  /neon\.tech|supabase|render\.com|amazonaws\.com/i.test(process.env.DB_HOST || '');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'switch_db',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
  ...(usarSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error al conectar con PostgreSQL:', err.stack);
  } else {
    console.log('🟢 Conexión exitosa a PostgreSQL (switch_db)');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};