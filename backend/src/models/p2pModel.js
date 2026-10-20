const db = require('../config/db');
const { calcularImpacto } = require('../utils/gamificacion');

class P2PModel {
  /**
   * Obtiene todas las publicaciones disponibles del Catálogo P2P con filtrado opcional.
   * Incluye estadísticas del autor para mostrar su nivel de impacto comunitario.
   */
  static async obtenerCatalogoDisponible({ tipoItem, nivelEsfuerzo, busqueda } = {}) {
    let query = `
      SELECT 
        p.id, 
        p.usuario_id,
        p.titulo, 
        p.descripcion, 
        p.nivel_esfuerzo,
        p.tipo_item,
        p.imagen_url, 
        p.estado,
        u.nombre AS oferente_nombre,
        (SELECT COUNT(*) FROM intercambios 
          WHERE estado = 'COMPLETADO' AND (dueno_id = u.id OR ofertante_id = u.id)) AS oferente_trueques,
        (SELECT COUNT(*) FROM nexos_sociales WHERE usuario_id = u.id) AS oferente_voluntariados,
        (SELECT COALESCE(ROUND(AVG(puntaje)::numeric, 1), 0) FROM resenas WHERE destino_id = u.id) AS oferente_calificacion,
        (SELECT COUNT(*) FROM resenas WHERE destino_id = u.id) AS oferente_resenas,
        TO_CHAR(p.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM publicaciones_p2p p
      JOIN usuarios u ON p.usuario_id = u.id
        AND u.activo = TRUE
        AND (u.suspendido_hasta IS NULL OR u.suspendido_hasta <= CURRENT_TIMESTAMP)
      WHERE p.estado = 'Activo'
    `;

    const values = [];
    let paramIndex = 1;

    if (tipoItem && tipoItem !== 'TODOS') {
      query += ` AND p.tipo_item = $${paramIndex}`;
      values.push(tipoItem);
      paramIndex++;
    }

    if (nivelEsfuerzo) {
      query += ` AND p.nivel_esfuerzo = $${paramIndex}`;
      values.push(nivelEsfuerzo);
      paramIndex++;
    }

    if (busqueda) {
      query += ` AND (p.titulo ILIKE $${paramIndex} OR p.descripcion ILIKE $${paramIndex})`;
      values.push(`%${busqueda}%`);
      paramIndex++;
    }

    query += ` ORDER BY p.creado_en DESC;`;

    const result = await db.query(query, values);
    const publicaciones = result.rows.map((fila) => ({
      ...fila,
      oferente_trueques: Number(fila.oferente_trueques),
      oferente_voluntariados: Number(fila.oferente_voluntariados),
      oferente_calificacion: parseFloat(fila.oferente_calificacion),
      oferente_resenas: Number(fila.oferente_resenas),
      autor_impacto: calcularImpacto({
        truequesCompletados: fila.oferente_trueques,
        voluntariados: fila.oferente_voluntariados,
        calificacionPromedio: fila.oferente_calificacion,
        cantidadResenas: fila.oferente_resenas
      })
    }));

    // Recompensa de visibilidad: las publicaciones de vecinos con nivel 4+
    // (Motor Solidario / Pilar de la Comunidad) flotan primero en el catálogo.
    // El resto conserva el orden por fecha. Sort estable en Node >= 11.
    return publicaciones.sort((a, b) =>
      Number(b.autor_impacto?.nivel?.numero >= 4) - Number(a.autor_impacto?.nivel?.numero >= 4)
    );
  }

  /**
   * Publicaciones activas de un usuario (para ofrecer en un trueque).
   */
  static async obtenerPublicacionesDeUsuario(usuarioId) {
    const query = `
      SELECT 
        p.id, 
        p.usuario_id,
        p.titulo, 
        p.descripcion, 
        p.nivel_esfuerzo,
        p.tipo_item,
        p.imagen_url, 
        p.estado,
        TO_CHAR(p.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM publicaciones_p2p p
      WHERE p.usuario_id = $1 AND p.estado = 'Activo'
      ORDER BY p.creado_en DESC;
    `;
    const result = await db.query(query, [usuarioId]);
    return result.rows;
  }

  /**
   * Busca publicaciones por lista de ids (para validar propuestas de trueque
   * y sugerencias de esfuerzo).
   */
  static async obtenerPorIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const query = `
      SELECT id, usuario_id, titulo, descripcion, nivel_esfuerzo, estado
      FROM publicaciones_p2p
      WHERE id = ANY($1::int[]);
    `;
    const result = await db.query(query, [ids]);
    return result.rows;
  }

  /**
   * Crea una nueva publicación P2P en la base de datos.
   * El nivel de esfuerzo se calcula automáticamente en el controller.
   */
  static async crearPublicacion({ usuarioId, titulo, descripcion, nivelEsfuerzo, tipoItem, imagenUrl, nombreArchivoImagen }) {
    // Se inserta directamente en PENDIENTE_REVISION: ninguna publicación
    // puede nacer visible. Recién la moderación la activa.
    const query = `
      INSERT INTO publicaciones_p2p (usuario_id, titulo, descripcion, nivel_esfuerzo, tipo_item, imagen_url, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE_REVISION')
      RETURNING
        id,
        usuario_id,
        titulo,
        descripcion,
        nivel_esfuerzo,
        tipo_item,
        imagen_url,
        estado,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en;
    `;
    const values = [usuarioId, titulo, descripcion, nivelEsfuerzo, tipoItem, imagenUrl || null];
    const result = await db.query(query, values);
    const nueva = result.rows[0];

    // Se vincula la imagen subida con la publicación para que la cola de
    // moderación pueda juzgarla con su contexto.
    if (nombreArchivoImagen) {
      await db.query(
        `UPDATE moderacion_imagenes
         SET publicacion_id = $1
         WHERE nombre_archivo = $2 AND publicacion_id IS NULL`,
        [nueva.id, nombreArchivoImagen]
      );
    }

    return nueva;
  }
}

module.exports = P2PModel;
