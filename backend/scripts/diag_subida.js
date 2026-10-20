/**
 * Diagnóstico: reproduce la subida de imagen y muestra el SQL que falla.
 * Uso: node scripts/diag_subida.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const db = require('../src/config/db');
const { generarArchivos } = require('./generarImagenesPrueba');

// Instrumentamos db.query para ver la consulta que revienta.
const queryOriginal = db.query.bind(db);
db.query = async (texto, params) => {
  try {
    return await queryOriginal(texto, params);
  } catch (e) {
    console.log('\n--- CONSULTA QUE FALLÓ ---');
    console.log(texto.replace(/\s+/g, ' ').trim().slice(0, 400));
    console.log('params =', JSON.stringify(params));
    console.log('code   =', e.code, '| message =', e.message);
    throw e;
  }
};

(async () => {
  const app = require('../src/index');
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  const url = `http://127.0.0.1:${servidor.address().port}`;

  const hash = await bcrypt.hash('clave123', 10);
  const dni = '80999990001';
  const nuevo = await db.query(
    `INSERT INTO usuarios (dni, nombre, apellido, telefono, password, validado_mayor_edad, rol)
     VALUES ($1, 'Diag', 'Subida', '11900090001', $2, TRUE, 'VECINO')
     ON CONFLICT (dni) DO UPDATE SET password = EXCLUDED.password
     RETURNING id`,
    [dni, hash]
  );
  const userId = nuevo.rows[0].id;
  const token = jwt.sign(
    { id: userId, rol: 'VECINO' },
    process.env.JWT_SECRET || 'switch_secreto_temporal',
    { expiresIn: '1h' }
  );

  const archivos = generarArchivos();
  const datos = fs.readFileSync(archivos.pngGrande);
  const form = new FormData();
  form.append('imagen', new Blob([datos], { type: 'image/png' }), 'prueba_mod_grande.png');

  const res = await fetch(`${url}/api/catalogo/imagen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  console.log('\nHTTP', res.status);
  console.log(await res.text());

  // limpieza
  await db.query('DELETE FROM moderacion_imagenes WHERE usuario_id = $1', [userId]);
  await db.query('DELETE FROM usuarios WHERE id = $1', [userId]);
  Object.values(archivos).forEach((r) => {
    try {
      if (fs.existsSync(r)) fs.unlinkSync(r);
    } catch (_) {}
  });

  servidor.close();
  await db.pool.end();
  process.exit(0);
})().catch(async (e) => {
  console.error('\nFatal:', e.message);
  await db.pool.end();
  process.exit(1);
});
void path;
