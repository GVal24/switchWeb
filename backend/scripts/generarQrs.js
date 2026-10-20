/**
 * Genera imágenes PNG de los QR de todas las instituciones registradas,
 * listas para imprimir y pegar en la entrada de cada institución.
 *
 * Uso:  node scripts/generarQrs.js
 * Salida: backend/qrs_instituciones/<nombre>.png
 */
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const db = require('../src/config/db');

async function main() {
  const res = await db.query(
    'SELECT nombre, qr_codigo_hash FROM instituciones ORDER BY nombre ASC'
  );

  if (res.rowCount === 0) {
    console.log('No hay instituciones registradas todavía.');
    return;
  }

  const dir = path.join(__dirname, '..', 'qrs_instituciones');
  fs.mkdirSync(dir, { recursive: true });

  for (const inst of res.rows) {
    const nombreArchivo =
      inst.nombre.replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '.png';
    const archivo = path.join(dir, nombreArchivo);
    await QRCode.toFile(archivo, inst.qr_codigo_hash, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: 'M'
    });
    console.log(`QR generado: ${archivo}`);
    console.log(`   -> contenido: ${inst.qr_codigo_hash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error generando QRs:', err);
    process.exit(1);
  });
