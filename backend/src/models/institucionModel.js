const db = require('../config/db');

class InstitucionModel {
  /**
   * Obtiene la lista completa de instituciones de la comunidad.
   */
  static async obtenerTodas() {
    const query = `
      SELECT
        id,
        nombre,
        tipo,
        direccion,
        latitud,
        longitud,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM instituciones
      ORDER BY nombre ASC;
    `;
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Obtiene una institución por su ID (UUID).
   */
  static async obtenerPorId(id) {
    const query = `
      SELECT id, nombre, tipo, direccion, latitud, longitud, qr_codigo_hash
      FROM instituciones
      WHERE id = $1;
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Busca una institución comparando el hash de su código QR físico.
   * La comparación es tolerante: ignora mayúsculas/minúsculas y cualquier
   * espacio en blanco o carácter invisible que el lector del celular pueda
   * agregar al escanear.
   */
  static async obtenerPorQrHash(qrCodigoHash) {
    const normalizado = String(qrCodigoHash || '')
      .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
      .toUpperCase();
    if (!normalizado) return null;

    const query = `
      SELECT id, nombre, tipo, direccion, latitud, longitud
      FROM instituciones
      WHERE UPPER(REGEXP_REPLACE(qr_codigo_hash, '\\s', '', 'g')) = $1
      LIMIT 1;
    `;
    const result = await db.query(query, [normalizado]);
    return result.rows[0] || null;
  }

  /**
   * Registra una institución nueva junto con sus necesidades iniciales.
   * Genera automáticamente el hash de QR que la institución imprimirá.
   */
  static async crearConNecesidades({ nombre, tipo, direccion, telefono, descripcion, necesidades }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const qrHash = `QR_${Date.now()}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

      const resInst = await client.query(
        `
        INSERT INTO instituciones (nombre, tipo, direccion, telefono, descripcion, latitud, longitud, qr_codigo_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, nombre, tipo, direccion, telefono, qr_codigo_hash;
        `,
        [
          nombre,
          tipo,
          direccion,
          telefono || null,
          descripcion || null,
          -36.7771 + (Math.random() - 0.5) * 0.02, // Centro geografico con leve variación
          -59.8586 + (Math.random() - 0.5) * 0.02,
          qrHash
        ]
      );

      const institucion = resInst.rows[0];

      for (const n of (necesidades || [])) {
        if (!n.titulo || !String(n.titulo).trim()) continue;
        const prioridad = ['GENERAL', 'PRIORITARIA', 'URGENTE'].includes(String(n.prioridad || '').toUpperCase())
          ? String(n.prioridad).toUpperCase()
          : 'GENERAL';
        await client.query(
          `
          INSERT INTO cupos_necesidad (institucion_id, titulo, descripcion, prioridad, cupo_maximo)
          VALUES ($1, $2, $3, $4, $5);
          `,
          [institucion.id, String(n.titulo).trim(), String(n.descripcion || '').trim(), prioridad, Math.max(1, Number(n.cupoMaximo) || 1)]
        );
      }

      await client.query('COMMIT');
      return institucion;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = InstitucionModel;