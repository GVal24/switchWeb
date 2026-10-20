/**
 * Estado real de la moderación ahora mismo.
 * Uso: node scripts/diag_estado_moderacion.js
 */
require('dotenv').config();
const db = require('../src/config/db');

(async () => {
  const pubs = await db.query(`
    SELECT estado, COUNT(*)::int AS n
    FROM publicaciones_p2p GROUP BY estado ORDER BY estado;
  `);
  console.log('Publicaciones por estado:');
  console.table(pubs.rows);

  const detail = await db.query(`
    SELECT p.id, p.titulo, p.estado, p.imagen_url,
           (SELECT estado FROM moderacion_imagenes m WHERE m.publicacion_id = p.id) AS moderacion
    FROM publicaciones_p2p p ORDER BY p.id;
  `);
  console.log('\nDetalle:');
  console.table(detail.rows);

  const mod = await db.query(`
    SELECT decision, COUNT(*)::int AS n FROM moderacion_imagenes
    GROUP BY decision;
  `);
  console.log('Registros de moderacion_imagenes por decisión:');
  console.log(mod.rowCount ? mod.rows : '  (ninguno)');

  const cola = await db.query(`
    SELECT p.id, p.titulo, p.estado
    FROM publicaciones_p2p p
    WHERE p.estado = 'PENDIENTE_REVISION'
    ORDER BY p.id;
  `);
  console.log(`\nPublicaciones esperando revisión: ${cola.rowCount}`);
  if (cola.rowCount) console.table(cola.rows);

  await db.pool.end();
})().catch(async (e) => {
  console.error(e.message);
  await db.pool.end();
  process.exit(1);
});
