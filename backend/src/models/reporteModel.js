const db = require('../config/db');

class ReporteModel {
  /**
   * Registra una nueva denuncia / reporte de la comunidad.
   */
  static async crear({ reportanteId, reportanteNombre, reportadoId, reportadoNombre, motivo }) {
    const query = `
      INSERT INTO reportes (reportante_id, reportante_nombre, reportado_id, reportado_nombre, motivo)
      VALUES ($1, $2, $3, $4, $5)
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
      String(reportanteId),
      reportanteNombre || '',
      reportadoId != null && reportadoId !== '' ? String(reportadoId) : null,
      reportadoNombre || '',
      motivo
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
        id,
        reportante_id,
        reportante_nombre,
        reportado_id,
        reportado_nombre,
        motivo,
        estado,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM reportes
      ORDER BY 
        CASE WHEN estado = 'PENDIENTE' THEN 0 ELSE 1 END ASC,
        creado_en DESC;
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
