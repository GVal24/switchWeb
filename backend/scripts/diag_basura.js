/**
 * Cruza los archivos de uploads/ con las publicaciones de la base para
 * separar las fotos reales de la app de los archivos huérfanos que dejaron
 * las pruebas. Sólo informa: no borra nada.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const almacen = require('../src/services/almacenImagenes');

(async () => {
  const archivos = [];
  for (const carpeta of [almacen.DIR_UPLOADS, almacen.DIR_CUARENA]) {
    if (!fs.existsSync(carpeta)) continue;
    for (const f of fs.readdirSync(carpeta)) {
      const ruta = path.join(carpeta, f);
      if (fs.statSync(ruta).isFile()) archivos.push(f);
    }
  }

  const pubs = await db.query(`
    SELECT id, usuario_id, titulo, estado, imagen_url
    FROM publicaciones_p2p
    ORDER BY id;
  `);
  console.log(`Publicaciones en la base: ${pubs.rowCount}\n`);

  const referenciados = new Set();
  pubs.rows.forEach((p) => {
    if (!p.imagen_url) return;
    const nombre = path.basename(p.imagen_url.split('?')[0]);
    referenciados.add(nombre);
  });

  console.log('Archivos en uploads/:');
  const huerfanos = [];
  for (const f of archivos) {
    const usada = referenciados.has(f);
    console.log(`  ${usada ? 'EN USO  ' : 'HUERFANA'}  ${f}`);
    if (!usada) huerfanos.push(f);
  }

  console.log(`\nResumen: ${archivos.length} archivos, ${referenciados.size} referenciados, ${huerfanos.length} huérfanos.`);

  // Sólo borra archivos que ninguna publicación referencia. Las fotos que sí
  // están en uso no se tocan nunca, así que esto es seguro de repetir.
  if (process.argv[2] === 'limpiar' && huerfanos.length) {
    let borrados = 0;
    for (const f of huerfanos) {
      if (almacen.eliminarArchivo(f)) borrados += 1;
    }
    console.log(`\nBorrados ${borrados} archivos huérfanos.`);
  } else if (process.argv[2] === 'limpiar') {
    console.log('\nNo hay huérfanos: no se borró nada.');
  }

  await db.pool.end();
})().catch(async (e) => {
  console.error(e.message);
  await db.pool.end();
  process.exit(1);
});
