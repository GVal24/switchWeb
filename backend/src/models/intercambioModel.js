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
   * Al aceptar, las publicaciones involucradas se pausan hasta confirmar el intercambio.
   */
  static async responder(intercambioId, estado) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const filaResult = await client.query(
        `SELECT * FROM intercambios WHERE id = $1 FOR UPDATE;`,
        [intercambioId]
      );
      const fila = filaResult.rows[0];
      if (!fila || fila.estado !== 'PENDIENTE') {
        await client.query('ROLLBACK');
        return null;
      }

      let publicacionesIds = [];
      if (estado === 'ACEPTADA') {
        const itemsOfrecidos = Array.isArray(fila.items_ofrecidos) ? fila.items_ofrecidos : [];
        publicacionesIds = [
          Number(fila.publicacion_deseada_id),
          ...itemsOfrecidos.map((item) => Number(item?.id ?? item?.publicacionId)),
        ].filter((id, index, ids) => Number.isInteger(id) && id > 0 && ids.indexOf(id) === index);

        const publicaciones = await client.query(
          `SELECT id, estado
           FROM publicaciones_p2p
           WHERE id = ANY($1::int[])
           ORDER BY id
           FOR UPDATE;`,
          [publicacionesIds]
        );
        if (
          publicaciones.rows.length !== publicacionesIds.length ||
          publicaciones.rows.some((publicacion) => publicacion.estado !== 'Activo')
        ) {
          await client.query('ROLLBACK');
          return { publicacionesNoDisponibles: true };
        }
      }

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
        await client.query(
          `UPDATE intercambios SET estado = 'RECHAZADA' 
           WHERE publicacion_deseada_id = ANY($1::int[]) AND id <> $2 AND estado = 'PENDIENTE';`,
          [publicacionesIds, intercambioId]
        );
        await client.query(
          `UPDATE publicaciones_p2p SET estado = 'Pausado' WHERE id = ANY($1::int[]);`,
          [publicacionesIds]
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
   * el trueque y las publicaciones involucradas pasan a COMPLETADO.
   */
  static async confirmar(intercambioId, usuarioId, puntaje, comentario) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const filaResult = await client.query(
        `SELECT * FROM intercambios WHERE id = $1 FOR UPDATE;`,
        [intercambioId]
      );
      const fila = filaResult.rows[0];
      if (!fila) {
        await client.query('ROLLBACK');
        return { noExiste: true };
      }

      const esDueno = Number(fila.dueno_id) === Number(usuarioId);
      const esOfertante = Number(fila.ofertante_id) === Number(usuarioId);
      if (!esDueno && !esOfertante) {
        await client.query('ROLLBACK');
        return { sinPermiso: true };
      }
      if (!['ACEPTADA', 'COMPLETADO'].includes(fila.estado)) {
        await client.query('ROLLBACK');
        return { estadoInvalido: true };
      }

      const destinoId = esDueno ? fila.ofertante_id : fila.dueno_id;
      await client.query(
        `INSERT INTO resenas (intercambio_id, autor_id, destino_id, puntaje, comentario)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (intercambio_id, autor_id) DO UPDATE
           SET puntaje = EXCLUDED.puntaje,
               comentario = EXCLUDED.comentario;`,
        [intercambioId, usuarioId, destinoId, puntaje, comentario || null]
      );

      const result = await client.query(
        `UPDATE intercambios
         SET confirmacion_dueno = confirmacion_dueno OR $2::boolean,
             confirmacion_ofertante = confirmacion_ofertante OR $3::boolean,
             estado = CASE
               WHEN (confirmacion_dueno OR $2::boolean) AND (confirmacion_ofertante OR $3::boolean) THEN 'COMPLETADO'
               ELSE estado
             END
         WHERE id = $1
         RETURNING id, estado, confirmacion_dueno, confirmacion_ofertante;`,
        [intercambioId, esDueno, esOfertante]
      );

      if (result.rows[0].estado === 'COMPLETADO') {
        const itemsOfrecidos = Array.isArray(fila.items_ofrecidos) ? fila.items_ofrecidos : [];
        const publicacionesIds = [
          Number(fila.publicacion_deseada_id),
          ...itemsOfrecidos.map((item) => Number(item?.id ?? item?.publicacionId)),
        ].filter((id, index, ids) => Number.isInteger(id) && id > 0 && ids.indexOf(id) === index);
        await client.query(
          `UPDATE publicaciones_p2p SET estado = 'Completado' WHERE id = ANY($1::int[]);`,
          [publicacionesIds]
        );
      }

      await client.query('COMMIT');
      return { datos: result.rows[0], resenaCreada: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = IntercambioModel;
