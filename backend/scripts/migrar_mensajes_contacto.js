/**
 * Migracion: crea la tabla `mensajes_contacto`.
 *
 * Por que: es el buzon donde cualquier persona le escribe a la administracion
 * (preguntas, comentarios o un simple "necesito ayuda"). Sin esta tabla no
 * hay donde guardar el mensaje ni como avisarle al administrador que hay algo
 * nuevo para contestar.
 *
 * El script lee el bloque de la tabla desde schema.sql para que las dos cosas
 * no se puedan separar. Es idempotente: si la tabla ya existe, no hace nada.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

/**
 * Extrae del schema.sql el bloque CREATE TABLE mensajes_contacto.
 *
 * Corta en el primer ';' que esté fuera de paréntesis y fuera de un
 * comentario, así que un ';' escrito dentro de una nota no trunca la
 * sentencia a la mitad.
 */
function definicionDesdeSchema() {
  const rutaSchema = path.join(__dirname, '..', '..', 'schema.sql');
  const schema = fs.readFileSync(rutaSchema, 'utf8');
  const inicio = schema.indexOf('CREATE TABLE mensajes_contacto');
  if (inicio === -1) {
    throw new Error('No se encontro "CREATE TABLE mensajes_contacto" en schema.sql.');
  }

  let profundidad = 0;
  for (let i = inicio; i < schema.length; i++) {
    const caracter = schema[i];
    const anterior = i > 0 ? schema[i - 1] : '';

    if (caracter === '-' && schema.slice(i, i + 2) === '--') {
      const finLinea = schema.indexOf('\n', i);
      i = finLinea === -1 ? schema.length : finLinea;
      continue;
    }
    if (caracter === "'") {
      // salta la cadena para no contar paréntesis ni ';' dentro de un valor
      i++;
      while (i < schema.length && schema[i] !== "'") i++;
      continue;
    }
    if (caracter === '(') profundidad++;
    if (caracter === ')') profundidad--;
    if (caracter === ';' && profundidad === 0) {
      return schema.slice(inicio, i + 1);
    }
    if (anterior === undefined) break;
  }

  throw new Error('No se pudo cerrar el bloque de mensajes_contacto en schema.sql.');
}

(async () => {
  try {
    const existe = await db.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_name = 'mensajes_contacto'`
    );

    if (existe.rowCount > 0) {
      console.log('La tabla mensajes_contacto ya existe. Nada que hacer.');
    } else {
      await db.query(definicionDesdeSchema());
      console.log('Tabla mensajes_contacto creada.');

      const yaExisteIndice = await db.query(
        `SELECT 1 FROM pg_indexes WHERE indexname = 'idx_mensajes_contacto_pendientes'`
      );
      if (yaExisteIndice.rowCount === 0) {
        await db.query(
          `CREATE INDEX idx_mensajes_contacto_pendientes
             ON mensajes_contacto (leido, creado_en DESC)`
        );
        await db.query(
          `CREATE INDEX idx_mensajes_contacto_usuario
             ON mensajes_contacto (usuario_id)`
        );
        console.log('Indices de la bandeja de mensajes creados.');
      }
    }

    const cols = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'mensajes_contacto' ORDER BY ordinal_position`
    );
    console.log('Columnas actuales:', cols.rows.map((c) => c.column_name).join(', '));
    console.log('Migracion completada.');
  } catch (err) {
    console.error('Fallo la migracion:', err.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();
