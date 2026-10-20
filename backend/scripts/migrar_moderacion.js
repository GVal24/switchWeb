/**
 * Aplica a switch_db los cambios de esta tanda:
 *   - moderacion_imagenes (cola de revisión de imágenes)
 *   - estados nuevos de publicaciones_p2p (PENDIENTE_REVISION, Rechazada)
 *   - filtro_motivos como JSONB
 *
 * Es idempotente. Ejecutar con: node backend/scripts/migrar_moderacion.js
 */
require('dotenv').config();
const db = require('../src/config/db');

(async () => {
  try {
    // 1. Estados de publicación
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_estado_publicacion'
        ) THEN
          ALTER TABLE publicaciones_p2p
            DROP CONSTRAINT IF EXISTS chk_estado_publicacion,
            ADD CONSTRAINT chk_estado_publicacion
              CHECK (estado IN ('PENDIENTE_REVISION','Activo','Pausado','Completado','Rechazada'));
        END IF;
      END $$;`);
    console.log('OK  estados de publicaciones_p2p');

    // 2. Tabla de moderación
    await db.query(`
      CREATE TABLE IF NOT EXISTS moderacion_imagenes (
        id SERIAL PRIMARY KEY,
        publicacion_id INT NULL REFERENCES publicaciones_p2p(id) ON DELETE CASCADE,
        usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre_archivo VARCHAR(255) NOT NULL,
        mime_detectado VARCHAR(30) NULL,
        peso_bytes INT NULL,
        filtro_estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
        filtro_puntaje INT NOT NULL DEFAULT 0,
        filtro_motivos JSONB NULL,
        revisado_por INT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
        revisado_en TIMESTAMP NULL,
        decision VARCHAR(20) NULL,
        motivo_rechazo VARCHAR(200) NULL,
        contiene_menor BOOLEAN NOT NULL DEFAULT FALSE,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT chk_filtro_estado
          CHECK (filtro_estado IN ('PENDIENTE','APROBADA_TECNICAMENTE','RECHAZADA_TECNICAMENTE','ERROR')),
        CONSTRAINT chk_decision_moderacion
          CHECK (decision IS NULL OR decision IN ('APROBADA','RECHAZADA'))
      );`);
    console.log('OK  moderacion_imagenes');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_moderacion_pendientes
        ON moderacion_imagenes (filtro_estado, creado_en) WHERE decision IS NULL`);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_moderacion_publicacion
        ON moderacion_imagenes (publicacion_id)`);
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_moderacion_archivo_unico
        ON moderacion_imagenes (nombre_archivo)`);
    console.log('OK  índices de moderación');

    // 3. Defaults alineados con el flujo nuevo
    await db.query(`
      ALTER TABLE publicaciones_p2p
        ALTER COLUMN estado SET DEFAULT 'PENDIENTE_REVISION'`);
    console.log('OK  estado por defecto = PENDIENTE_REVISION');

    const cols = await db.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'moderacion_imagenes' ORDER BY ordinal_position`);
    console.log('\nColumnas de moderacion_imagenes:');
    cols.rows.forEach((c) => console.log(`  ${c.column_name} (${c.data_type})`));

    const n = await db.query('SELECT COUNT(*)::int AS n FROM moderacion_imagenes');
    console.log(`\nmoderacion_imagenes: ${n.rows[0].n} filas`);
    console.log('\nLas 13 publicaciones existentes siguen como estaban: no se');
    console.log('tocan solas. Para mandarlas a revisión, ver el paso 4 de la');
    console.log('respuesta (script opcional y reversible).');

    process.exit(0);
  } catch (err) {
    console.error('Error en la migración:', err.message);
    process.exit(1);
  }
})();
