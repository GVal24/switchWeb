const db = require('../config/db');

class IntercambioModel {
  /**
   * Registra una propuesta de trueque (Switch) con múltiples items ofrecidos.
   */
  static async crear({ publicacionDeseadaId, tituloDeseado, duenoId, ofertanteId, ofertanteNombre, itemsOfrecidos }) {
    const query = `
      INSERT INTO intercambios (
        publicacion_deseada_id, 
        titulo_deseado, 
        dueno_id, 
        ofertante_id, 
        ofertante_nombre, 
        items_ofrecidos
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING 
        id,
        publicacion_deseada_id,
        titulo_deseado,
        dueno_id,
        ofertante_id,
        ofertante_nombre,
        items_ofrecidos,
        estado,
        confirmacion_dueno,
        confirmacion_ofertante,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en;
    `;
    const values = [
      publicacionDeseadaId,
      tituloDeseado || '',
      duenoId,
      ofertanteId,
      ofertanteNombre || '',
      JSON.stringify(itemsOfrecidos || [])
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Lista las propuestas enviadas y recibidas de un usuario.
   */
  static async listarPorUsuario(usuarioId) {
    const base = `
      SELECT 
        i.id,
        i.publicacion_deseada_id,
        i.titulo_deseado,
        i.dueno_id,
        i.ofertante_id,
        i.ofertante_nombre,
        u.nombre || ' ' || u.apellido AS dueno_nombre,
        i.items_ofrecidos,
        i.estado,
        i.confirmacion_dueno,
        i.confirmacion_ofertante,
        TO_CHAR(i.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM intercambios i
      JOIN usuarios u ON u.id = i.dueno_id
    `;

    const queryEnviadas = `${base} WHERE i.ofertante_id = $1 ORDER BY i.creado_en DESC;`;
    const queryRecibidas = `${base} WHERE i.dueno_id = $1 ORDER BY i.creado_en DESC;`;

    const [resEnviadas, resRecibidas] = await Promise.all([
      db.query(queryEnviadas, [usuarioId]),
      db.query(queryRecibidas, [usuarioId])
    ]);

    return {
      enviadas: resEnviadas.rows,
      recibidas: resRecibidas.rows
    };
  }

  /**
   * Obtiene un intercambio por su ID.
   */
  static async obtenerPorId(id) {
    const result = await db.query(`SELECT * FROM intercambios WHERE id = $1;`, [id]);
    return result.rows[0] || null;
  }

  /**
   * El dueño acepta o rechaza una propuesta pendiente.
   * Si acepta, las demás propuestas pendientes sobre la misma publicación pasan a RECHAZADA.
   */
  static async responder(intercambioId, estado) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const update = `
        UPDATE intercambios
        SET estado = $2
        WHERE id = $1 AND estado = 'PENDIENTE'
        RETURNING id, estado;
      `;
      const resUpdate = await client.query(update, [intercambioId, estado]);

      if (resUpdate.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      if (estado === 'ACEPTADA') {
        const fila = await this.obtenerPorId(intercambioId);
        await client.query(
          `UPDATE intercambios SET estado = 'RECHAZADA' 
           WHERE publicacion_deseada_id = $1 AND id <> $2 AND estado = 'PENDIENTE';`,
          [fila.publicacion_deseada_id, intercambioId]
        );
        await client.query(
          `UPDATE publicaciones_p2p SET estado = 'Completado' WHERE id = $1;`,
          [fila.publicacion_deseada_id]
        );
      }

      await client.query('COMMIT');
      return resUpdate.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Registra la confirmación de una parte. Cuando ambas confirman,
   * el trueque pasa a COMPLETADO.
   */
  static async confirmar(intercambioId, usuarioId) {
    const fila = await this.obtenerPorId(intercambioId);
    if (!fila) return { noExiste: true };

    const esDueno = Number(fila.dueno_id) === Number(usuarioId);
    const esOfertante = Number(fila.ofertante_id) === Number(usuarioId);

    if (!esDueno && !esOfertante) return { sinPermiso: true };

    // Se pasan los flags nuevos por parámetro para que el CASE no dependa
    // de los valores viejos de la fila.
    const query = `
      UPDATE intercambios
      SET confirmacion_dueno = confirmacion_dueno OR $2::boolean,
          confirmacion_ofertante = confirmacion_ofertante OR $3::boolean,
          estado = CASE
            WHEN (confirmacion_dueno OR $2::boolean) AND (confirmacion_ofertante OR $3::boolean) THEN 'COMPLETADO'
            ELSE estado
          END
      WHERE id = $1 AND estado IN ('ACEPTADA', 'COMPLETADO')
      RETURNING id, estado, confirmacion_dueno, confirmacion_ofertante;
    `;

    const result = await db.query(query, [intercambioId, esDueno, esOfertante]);
    if (result.rowCount === 0) return { estadoInvalido: true };

    return { datos: result.rows[0] };
  }
}

module.exports = IntercambioModel;
