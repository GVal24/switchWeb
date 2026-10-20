const db = require('../config/db');

class AdminModel {
  /**
   * Consulta las métricas globales para el Dashboard de Admin.
   * Todas las métricas se calculan en vivo desde la base de datos.
   */
  static async obtenerMetricasGlobales() {
    const queryUsuariosActivos = `
      SELECT COUNT(*)::int AS total 
      FROM usuarios 
      WHERE activo = TRUE;
    `;

    const queryTruequesMes = `
      SELECT COUNT(*)::int AS total 
      FROM intercambios 
      WHERE creado_en >= date_trunc('month', CURRENT_TIMESTAMP);
    `;

    const queryVoluntariadosQr = `
      SELECT COUNT(*)::int AS total 
      FROM nexos_sociales;
    `;

    const queryReportesPendientes = `
      SELECT COUNT(*)::int AS total 
      FROM reportes 
      WHERE estado = 'PENDIENTE';
    `;

    // Serie mensual de los últimos 6 meses de actividad (trueques propuestos)
    const queryMensual = `
      SELECT 
        TO_CHAR(m.mes, 'Mon') AS mes,
        TO_CHAR(m.mes, 'MM') AS mes_num,
        COUNT(i.id)::int AS total
      FROM generate_series(
        date_trunc('month', CURRENT_TIMESTAMP) - INTERVAL '5 months',
        date_trunc('month', CURRENT_TIMESTAMP),
        INTERVAL '1 month'
      ) AS m(mes)
      LEFT JOIN intercambios i ON date_trunc('month', i.creado_en) = m.mes
      GROUP BY m.mes
      ORDER BY m.mes ASC;
    `;

    // Porcentaje de propuestas aceptadas o completadas sobre el total (efectividad del trueque)
    const queryTasaEfectividad = `
      SELECT 
        COALESCE(
          ROUND(100.0 * SUM(CASE WHEN estado IN ('ACEPTADA', 'COMPLETADO') THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)),
          0
        )::int AS tasa
      FROM intercambios;
    `;

    // Distribución porcentual de publicaciones por nivel de esfuerzo
    const queryEsfuerzo = `
      SELECT 
        p.nivel_esfuerzo,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)::float AS porcentaje
      FROM publicaciones_p2p p
      GROUP BY p.nivel_esfuerzo;
    `;

    const [
      resUsuarios,
      resTruequesMes,
      resQrs,
      resReportes,
      resMensual,
      resTasa,
      resEsfuerzo
    ] = await Promise.all([
      db.query(queryUsuariosActivos),
      db.query(queryTruequesMes),
      db.query(queryVoluntariadosQr),
      db.query(queryReportesPendientes),
      db.query(queryMensual),
      db.query(queryTasaEfectividad),
      db.query(queryEsfuerzo)
    ]);

    const esfuerzoDistribucion = {};
    for (const fila of resEsfuerzo.rows) {
      esfuerzoDistribucion[fila.nivel_esfuerzo] = fila.porcentaje ?? 0;
    }

    return {
      usuariosActivos: resUsuarios.rows[0]?.total || 0,
      truequesMes: resTruequesMes.rows[0]?.total || 0,
      voluntariadosQr: resQrs.rows[0]?.total || 0,
      reportesPendientes: resReportes.rows[0]?.total || 0,
      tasaEfectividad: `${resTasa.rows[0]?.tasa || 0}%`,
      meses: resMensual.rows.map(r => r.mes.trim()),
      actividadMensual: resMensual.rows.map(r => r.total),
      esfuerzoDistribucion
    };
  }
}

module.exports = AdminModel;
