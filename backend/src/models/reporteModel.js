const db = require('../config/db');

class ReporteModel {
  /**
   * Registra una nueva denuncia / reporte de la comunidad.
   */
  static async crear({ reportanteId, reportadoId, reportadoNombre, motivo }) {
    const query = `
      INSERT INTO reportes (reportante_id, reportante_nombre, reportado_id, reportado_nombre, motivo)
      SELECT
        u.id::text,
        BTRIM(CONCAT_WS(' ', u.nombre, u.apellido)),
        $2,
        $3,
        $4
      FROM usuarios u
      WHERE u.id = $1
      RETURNING 
        id,
        reportante_id,
        reportante_nombre,
        reportado_id,
        reportado_nombre,
        motivo,
        estado,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en;
    `;
    const values = [
      reportanteId,
      reportadoId != null && reportadoId !== '' ? String(reportadoId) : null,
      reportadoNombre || '',
      motivo,
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Lista los reportes para el panel de administración (pendientes primero).
   */
  static async obtenerTodos() {
    const query = `
      SELECT 
        r.id,
        r.reportante_id,
        COALESCE(
          NULLIF(BTRIM(r.reportante_nombre), ''),
          NULLIF(BTRIM(CONCAT_WS(' ', u.nombre, u.apellido)), ''),
          'Alguien de la comunidad'
        ) AS reportante_nombre,
        r.reportado_id,
        r.reportado_nombre,
        r.motivo,
        r.estado,
        TO_CHAR(r.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM reportes r
      LEFT JOIN usuarios u ON u.id::text = r.reportante_id
      ORDER BY 
        CASE WHEN r.estado = 'PENDIENTE' THEN 0 ELSE 1 END ASC,
        r.creado_en DESC;
    `;
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Actualiza el estado de un reporte ('DESESTIMADO', 'RESUELTO_BAN', etc).
   */
  static async actualizarEstado(reporteId, estado) {
    const query = `
      UPDATE reportes
      SET estado = $2
      WHERE id = $1
      RETURNING id, estado;
    `;
    const result = await db.query(query, [reporteId, estado]);
    return result.rows[0] || null;
  }
}

module.exports = ReporteModel;
