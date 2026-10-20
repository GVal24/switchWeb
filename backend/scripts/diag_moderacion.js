require('dotenv').config();
const db = require('../src/config/db');

(async () => {
  const t = await db.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE column_name = 'id'
      AND table_name IN ('usuarios', 'publicaciones_p2p', 'moderacion_imagenes')
    ORDER BY table_name;
  `);
  console.log('Tipos de id:');
  t.rows.forEach((r) => console.log(`  ${r.table_name}.${r.column_name} = ${r.data_type}`));

  const u = await db.query('SELECT id, dni FROM usuarios ORDER BY id LIMIT 3');
  console.log('\nEjemplos de usuarios.id:', u.rows);

  const M = require('../src/models/moderacionModel');
  try {
    const r = await M.registrar({
      usuarioId: u.rows[0].id,
      nombreArchivo: 'diagnostico_temporal.png',
      mimeDetectado: 'image/png',
      pesoBytes: 12345,
      evaluacion: { filtroEstado: 'APROBADA_TECNICAMENTE', puntaje: 0, motivos: [] },
    });
    console.log('\nregistrar() OK ->', r.id);
    await db.query('DELETE FROM moderacion_imagenes WHERE nombre_archivo = $1', ['diagnostico_temporal.png']);
    console.log('Fila de diagnóstico borrada.');
  } catch (e) {
    console.log('\nregistrar() FALLA:');
    console.log('  code    =', e.code);
    console.log('  message =', e.message);
    console.log('  detalle =', e.detail);
    console.log('  where   =', e.where);
  }

  await db.pool.end();
})();
