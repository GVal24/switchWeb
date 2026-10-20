const db = require('../config/db');

class ModeracionModel {
  /**
   * Registra la imagen subida y el resultado del filtrado técnico.
   * La imagen queda siempre esperando decisión humana: `decision` NULL.
   */
  static async registrar({ usuarioId, publicacionId = null, nombreArchivo, mimeDetectado, pesoBytes, evaluacion }) {
    const query = `
      INSERT INTO moderacion_imagenes
        (publicacion_id, usuario_id, nombre_archivo, mime_detectado, peso_bytes,
         filtro_estado, filtro_puntaje, filtro_motivos)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (nombre_archivo) DO UPDATE
        SET publicacion_id = EXCLUDED.publicacion_id,
            filtro_estado  = EXCLUDED.filtro_estado,
            filtro_puntaje = EXCLUDED.filtro_puntaje,
            filtro_motivos = EXCLUDED.filtro_motivos
      RETURNING *;
    `;
    const result = await db.query(query, [
      publicacionId,
      usuarioId,
      nombreArchivo,
      mimeDetectado || null,
      pesoBytes || null,
      evaluacion.filtroEstado,
      evaluacion.puntaje || 0,
      // La columna es JSONB: hay que enviar el texto del JSON. Si se pasa el
      // arreglo directamente, node-postgres lo arma como literal de array de
      // PostgreSQL ({...}) y Postgres lo rechaza.
      JSON.stringify(evaluacion.motivos || []),
    ]);
    return result.rows[0];
  }

  /**
   * Cola de moderación: imágenes sin decisión, primero las más viejas.
   * Cada fila viene con la publicación y el autor para poder juzgarlas
   * con el contexto completo.
   */
  static async listarPendientes({ limite = 50 } = {}) {
    const query = `
      SELECT
        m.id, m.nombre_archivo, m.mime_detectado, m.peso_bytes,
        m.filtro_estado, m.filtro_puntaje, m.filtro_motivos, m.creado_en,
        m.contiene_menor,
        m.publicacion_id, m.usuario_id,
        p.titulo, p.descripcion, p.tipo_item, p.estado AS publicacion_estado,
        u.nombre AS autor_nombre, u.apellido AS autor_apellido, u.dni AS autor_dni,
        TO_CHAR(m.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_legible
      FROM moderacion_imagenes m
      LEFT JOIN publicaciones_p2p p ON p.id = m.publicacion_id
      LEFT JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.decision IS NULL
        AND m.publicacion_id IS NOT NULL
      ORDER BY m.creado_en ASC
      LIMIT $1;
    `;
    const [imagenes, textos] = await Promise.all([
      db.query(query, [limite]),
      this.listarPendientesSinImagen({ limite }),
    ]);

    const filasImagen = imagenes.rows.map((r) => ({
      ...r,
      tipo_revision: 'IMAGEN',
      filtro_motivos: parseMotivos(r.filtro_motivos),
    }));

    return [...filasImagen, ...textos].sort((a, b) => {
      const fa = new Date(a.creado_en).getTime() || 0;
      const fb = new Date(b.creado_en).getTime() || 0;
      return fa - fb;
    });
  }

  /**
   * Publicaciones que esperan revisión y NO tienen imagen.
   *
   * Hace falta porque toda publicación nace en PENDIENTE_REVISION: si la
   * cola mirara sólo imágenes, estas quedarían esperando para siempre, sin
   * forma de que nadie las apruebe o las rechace.
   *
   * El texto también se revisa: el título y la descripción pueden llegar a
   * contenido que las normas prohíben, aunque no haya foto.
   */
  static async listarPendientesSinImagen({ limite = 50 } = {}) {
    const query = `
      SELECT
        NULL::int          AS id,
        NULL::varchar      AS nombre_archivo,
        NULL::varchar      AS mime_detectado,
        NULL::int          AS peso_bytes,
        'SIN_IMAGEN'::varchar AS filtro_estado,
        0                 AS filtro_puntaje,
        NULL::jsonb        AS filtro_motivos,
        p.creado_en,
        FALSE              AS contiene_menor,
        p.id               AS publicacion_id,
        p.usuario_id,
        p.titulo, p.descripcion, p.tipo_item, p.estado AS publicacion_estado,
        u.nombre AS autor_nombre, u.apellido AS autor_apellido, u.dni AS autor_dni,
        TO_CHAR(p.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_legible
      FROM publicaciones_p2p p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.estado = 'PENDIENTE_REVISION'
        AND NOT EXISTS (
          SELECT 1 FROM moderacion_imagenes m
          WHERE m.publicacion_id = p.id AND m.decision IS NULL
        )
      ORDER BY p.creado_en ASC
      LIMIT $1;
    `;
    const result = await db.query(query, [limite]);
    return result.rows.map((r) => ({ ...r, tipo_revision: 'TEXTO' }));
  }

  /**
   * Aprueba o rechaza una publicación que no tiene imagen. Para estas, la
   * decisión es sobre el texto: no hay archivo que sacar de la cuarentena.
   */
  static async decidirPublicacionSinImagen({ publicacionId, decision, motivoRechazo = null }) {
    const estado = decision === 'APROBADA' ? 'Activo' : 'Rechazada';

    const result = await db.query(
      `UPDATE publicaciones_p2p
       SET estado = $2
       WHERE id = $1 AND estado = 'PENDIENTE_REVISION'
       RETURNING *;`,
      [publicacionId, estado]
    );

    return { fila: result.rows[0] || null, yaDecidida: result.rowCount === 0 };
  }

  /** Marca como menor una publicación sin imagen y suspende a su autor. */
  static async marcarPublicacionComoMenor({ publicacionId, dias = 365 }) {
    const result = await db.query(
      `UPDATE publicaciones_p2p SET estado = 'Rechazada' WHERE id = $1 RETURNING *;`,
      [publicacionId]
    );
    const fila = result.rows[0];
    if (!fila) return null;

    await db.query(
      `UPDATE usuarios
       SET suspendido_hasta = GREATEST(
             COALESCE(suspendido_hasta, CURRENT_TIMESTAMP),
             CURRENT_TIMESTAMP + ($2 || ' days')::interval
         ),
         motivo_suspension = COALESCE(motivo_suspension, $3)
       WHERE id = $1;`,
      [fila.usuario_id, String(dias), 'Publicación con posible imagen de menor de edad']
    );

    return fila;
  }

  static async obtenerPorId(id) {
    const query = `
      SELECT m.*, p.titulo, p.estado AS publicacion_estado
      FROM moderacion_imagenes m
      LEFT JOIN publicaciones_p2p p ON p.id = m.publicacion_id
      WHERE m.id = $1;
    `;
    const result = await db.query(query, [id]);
    const fila = result.rows[0];
    if (fila) fila.filtro_motivos = parseMotivos(fila.filtro_motivos);
    return fila || null;
  }

  /**
   * Busca una imagen por nombre comprobando que sea de esa persona.
   * Se usa al crear la publicación: sin esto, cualquiera podría colgar en su
   * publicación una imagen subida por otro (o inventarse un nombre).
   */
  static async obtenerPorNombreYUsuario({ nombreArchivo, usuarioId }) {
    const query = `
      SELECT id, publicacion_id, usuario_id, decision, filtro_estado, contiene_menor
      FROM moderacion_imagenes
      WHERE nombre_archivo = $1 AND usuario_id = $2;
    `;
    const result = await db.query(query, [nombreArchivo, usuarioId]);
    return result.rows[0] || null;
  }

  /**
   * Registra la decisión de la persona que revisó.
   *
   * Si se marca contiene_menor, además de rechazar la publicación se suspende
   * la cuenta: la Ley 26.061 obliga a actuar de inmediato ante la
   * representación de un menor.
   */
  static async decidir({
    moderacionId,
    revisadoPor,
    decision,
    motivoRechazo = null,
    contieneMenor = false,
  }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const upd = await client.query(
        `UPDATE moderacion_imagenes
         SET revisado_por = $1,
             revisado_en = CURRENT_TIMESTAMP,
             decision = $2,
             motivo_rechazo = $3,
             contiene_menor = $4
         WHERE id = $5 AND decision IS NULL
         RETURNING *;`,
        [revisadoPor, decision, motivoRechazo, contieneMenor, moderacionId]
      );

      const fila = upd.rows[0];
      if (!fila) {
        await client.query('ROLLBACK');
        return { yaDecidida: true, fila: null };
      }

      // La publicación sigue el mismo destino que la imagen.
      if (fila.publicacion_id) {
        const nuevoEstado = decision === 'APROBADA' ? 'Activo' : 'Rechazada';
        await client.query(
          'UPDATE publicaciones_p2p SET estado = $1 WHERE id = $2',
          [nuevoEstado, fila.publicacion_id]
        );
      }

      // Si la imagen muestra a un menor, la cuenta se suspende de inmediato.
      let usuarioSuspendido = null;
      if (contieneMenor && fila.usuario_id) {
        const susp = await client.query(
          `UPDATE usuarios
           SET suspendido_hasta = CURRENT_TIMESTAMP + INTERVAL '365 days'
           WHERE id = $1
           RETURNING id, nombre, apellido`,
          [fila.usuario_id]
        );
        usuarioSuspendido = susp.rows[0] || null;
      }

      await client.query('COMMIT');

      return {
        yaDecidida: false,
        fila: { ...fila, filtro_motivos: parseMotivos(fila.filtro_motivos) },
        usuarioSuspendido,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Estadísticas para el panel de administración.
   *
   * `pendientes` cuenta las dos cosas que hay que revisar: las imágenes sin
   * decidir y las publicaciones sin imagen (que sólo viven en
   * publicaciones_p2p). Si se contara sólo la tabla de imágenes, el cartel
   * del panel mostraría cero mientras hay textos esperando.
   */
  static async estadisticas() {
    const query = `
      SELECT
        (
          COUNT(*) FILTER (WHERE m.decision IS NULL)::int
          + (
            SELECT COUNT(*)::int FROM publicaciones_p2p p
            WHERE p.estado = 'PENDIENTE_REVISION'
              AND NOT EXISTS (
                SELECT 1 FROM moderacion_imagenes m2
                WHERE m2.publicacion_id = p.id AND m2.decision IS NULL
              )
          )
        ) AS pendientes,
        COUNT(*) FILTER (WHERE m.decision = 'APROBADA')::int AS aprobadas,
        COUNT(*) FILTER (WHERE m.decision = 'RECHAZADA')::int AS rechazadas,
        COUNT(*) FILTER (WHERE m.contiene_menor = TRUE)::int AS con_menores,
        COUNT(*) FILTER (WHERE m.filtro_estado = 'RECHAZADA_TECNICAMENTE')::int AS marcadas_tecnicamente
      FROM moderacion_imagenes m;
    `;
    const result = await db.query(query);
    return result.rows[0];
  }

  /**
   * Devuelve el nombre del archivo en disco de una imagen, para poder
   * borrarlo cuando la persona moderadora la rechaza.
   */
  static async obtenerArchivo(moderacionId) {
    const result = await db.query(
      'SELECT nombre_archivo FROM moderacion_imagenes WHERE id = $1',
      [moderacionId]
    );
    return result.rows[0]?.nombre_archivo || null;
  }

  /**
   * Deja una decisión sin aplicar, para poder corregir un error sin dejar el
   * registro en un estado que no ocurrió. Se usa cuando la base ya dijo
   * "aprobada" pero el archivo no llegó a la carpeta pública.
   */
  static async reabrir(moderacionId) {
    await db.query(
      `UPDATE moderacion_imagenes
       SET decision = NULL, revisado_por = NULL, revisado_en = NULL
       WHERE id = $1`,
      [moderacionId]
    );
    await db.query(
      `UPDATE publicaciones_p2p
       SET estado = 'PENDIENTE_REVISION'
       WHERE id = (SELECT publicacion_id FROM moderacion_imagenes WHERE id = $1)`,
      [moderacionId]
    );
  }

  /**
   * Cuando la imagen se aprueba, la publicación pasa a apuntar a la URL real
   * (la que ya no está en cuarentena). Antes guardaba la URL de espera, que
   * deliberadamente no abre nada.
   */
  static async actualizarUrlPublicacion({ publicacionId, nombreArchivo }) {
    if (!publicacionId) return;
    await db.query(
      `UPDATE publicaciones_p2p
       SET imagen_url = REPLACE(imagen_url, '/_cuarena/', '/')
       WHERE id = $1 AND imagen_url LIKE '%/_cuarena/%'`,
      [publicacionId]
    );
  }

  /**
   * Agrega un motivo a la lista de la imagen, para dejar constancia de que
   * el archivo fue eliminado del servidor.
   */
  static async agregarMotivo(moderacionId, motivo) {
    const query = `
      UPDATE moderacion_imagenes
      SET filtro_motivos = COALESCE(filtro_motivos, '[]'::jsonb) || to_jsonb($2::text)
      WHERE id = $1;
    `;
    await db.query(query, [moderacionId, motivo]);
  }
}

function parseMotivos(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  try {
    const parsed = typeof valor === 'string' ? JSON.parse(valor) : valor;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (_) {
    return [String(valor)];
  }
}

module.exports = ModeracionModel;
