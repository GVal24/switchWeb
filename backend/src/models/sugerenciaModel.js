const db = require('../config/db');

class SugerenciaModel {
  /**
   * Registra (o actualiza) la sugerencia de nivel de esfuerzo de un usuario
   * para una publicación. Si ya había sugerido, se reemplaza por la nueva.
   */
  static async sugerir({ publicacionId, usuarioId, nivelSugerido }) {
    const query = `
      INSERT INTO sugerencias_esfuerzo (publicacion_id, usuario_id, nivel_sugerido)
      VALUES ($1, $2, $3)
      ON CONFLICT (publicacion_id, usuario_id) DO UPDATE SET
        nivel_sugerido = EXCLUDED.nivel_sugerido,
        estado = 'PENDIENTE',
        creado_en = CURRENT_TIMESTAMP
      RETURNING id, publicacion_id, usuario_id, nivel_sugerido, estado;
    `;
    const result = await db.query(query, [publicacionId, usuarioId, nivelSugerido]);
    return result.rows[0];
  }

  /**
   * Lista las sugerencias pendientes con datos de la publicación y de quien sugirió.
   */
  static async listarPendientes() {
    const query = `
      SELECT 
        s.id,
        s.publicacion_id,
        p.titulo AS publicacion_titulo,
        p.nivel_esfuerzo AS nivel_actual,
        p.tipo_item,
        s.nivel_sugerido,
        u.nombre || ' ' || u.apellido AS sugerido_por,
        TO_CHAR(s.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM sugerencias_esfuerzo s
      JOIN publicaciones_p2p p ON p.id = s.publicacion_id
      JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.estado = 'PENDIENTE'
      ORDER BY s.creado_en DESC;
    `;
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Aplica una sugerencia: cambia el nivel de la publicación y marca la sugerencia.
   */
  static async aplicar(sugerenciaId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const resSug = await client.query(
        `UPDATE sugerencias_esfuerzo SET estado = 'APLICADA'
         WHERE id = $1 AND estado = 'PENDIENTE'
         RETURNING id, publicacion_id, nivel_sugerido;`,
        [sugerenciaId]
      );

      if (resSug.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const sug = resSug.rows[0];
      const resPub = await client.query(
        `UPDATE publicaciones_p2p SET nivel_esfuerzo = $2
         WHERE id = $1
         RETURNING id, titulo, nivel_esfuerzo;`,
        [sug.publicacion_id, sug.nivel_sugerido]
      );

      await client.query('COMMIT');
      return { sugerencia: sug, publicacion: resPub.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Descarta una sugerencia pendiente.
   */
  static async descartar(sugerenciaId) {
    const result = await db.query(
      `UPDATE sugerencias_esfuerzo SET estado = 'DESCARTADA'
       WHERE id = $1 AND estado = 'PENDIENTE'
       RETURNING id;`,
      [sugerenciaId]
    );
    return result.rows[0] || null;
  }
}

module.exports = SugerenciaModel;
