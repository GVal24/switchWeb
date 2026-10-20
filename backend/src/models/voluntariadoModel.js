const db = require('../config/db');
const UsuarioModel = require('./usuarioModel');
const { clasificarEsfuerzo } = require('../utils/clasificadorEsfuerzo');

// Vigencia base del Nexo Social según la prioridad que la institución
// declaró sobre la necesidad cubierta. La urgencia la define quien conoce
// a su población, no la plataforma.
const VIGENCIA_POR_PRIORIDAD = {
  GENERAL: 45,
  PRIORITARIA: 75,
  URGENTE: 105
};

// Bonus por el esfuerzo real que implica la necesidad (clasificación automática)
const BONUS_POR_ESFUERZO = {
  SIMPLE: 0,
  MEDIO: 15,
  ALTO: 30
};

class VoluntariadoModel {
  /**
   * Obtiene los cupos de necesidad abiertos para una institución específica.
   */
  static async obtenerCuposPorInstitucion(institucionId) {
    const query = `
      SELECT 
        id, 
        institucion_id, 
        titulo, 
        descripcion, 
        cupo_maximo, 
        cupo_actual, 
        activo,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM cupos_necesidad 
      WHERE institucion_id = $1 AND activo = true
      ORDER BY creado_en DESC;
    `;
    const result = await db.query(query, [institucionId]);
    return result.rows;
  }

  /**
   * Registra la validación por QR + GPS e inserta un nuevo Nexo Social en nexos_sociales.
   */
  static async registrarNexoSocial({ usuarioId, cupoNecesidadId, institucionId, latitudUsuario, longitudUsuario }) {
    // La vigencia depende de la prioridad que la institución declaró sobre la
    // necesidad cubierta y del esfuerzo que implica (clasificación automática).
    let diasBase = 60; // Visita general sin necesidad específica
    let prioridadAplicada = null;
    let esfuerzoAplicado = null;

    if (cupoNecesidadId) {
      const resCupo = await db.query(
        'SELECT titulo, descripcion, prioridad FROM cupos_necesidad WHERE id = $1',
        [cupoNecesidadId]
      );
      const cupo = resCupo.rows[0];
      if (cupo) {
        prioridadAplicada = cupo.prioridad;
        diasBase = VIGENCIA_POR_PRIORIDAD[cupo.prioridad] || VIGENCIA_POR_PRIORIDAD.GENERAL;
        const esfuerzo = clasificarEsfuerzo(cupo.titulo, cupo.descripcion);
        esfuerzoAplicado = esfuerzo;
        diasBase += BONUS_POR_ESFUERZO[esfuerzo] || 0;
      }
    }

    // Recompensa por nivel de impacto comunitario: los vecinos más activos
    // obtienen días extra de Nexo Social con una sola colaboración.
    let bonusNivel = 0;
    try {
      const perfil = await UsuarioModel.obtenerPerfilConEstadisticas(usuarioId);
      const nivel = perfil?.impacto?.nivel?.numero || 1;
      if (nivel >= 5) bonusNivel = 120;
      else if (nivel === 4) bonusNivel = 60;
      else if (nivel === 3) bonusNivel = 30;
    } catch (_) {
      // Si falla el cálculo, se otorga la vigencia base sin bonus
    }
    const diasTotales = diasBase + bonusNivel;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const queryNexo = `
        INSERT INTO nexos_sociales (
          usuario_id, 
          cupo_necesidad_id, 
          institucion_id, 
          metodo_validacion, 
          latitud_usuario, 
          longitud_usuario, 
          estado, 
          fecha_expiracion
        )
        VALUES (
          $1, $2, $3, 'QR_GPS', $4, $5, 'ACTIVO', 
          CURRENT_TIMESTAMP + ($6 || ' days')::INTERVAL
        )
        RETURNING 
          id, 
          estado, 
          TO_CHAR(fecha_activacion AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS fecha_activacion,
          TO_CHAR(fecha_expiracion AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') AS fecha_expiracion;
      `;

      const values = [usuarioId, cupoNecesidadId || null, institucionId, latitudUsuario || null, longitudUsuario || null, diasTotales];
      const resNexo = await client.query(queryNexo, values);

      if (cupoNecesidadId) {
        // Guarda cupo_actual < cupo_maximo para no violar la restricción de la BD
        const queryUpdateCupo = `
          UPDATE cupos_necesidad
          SET cupo_actual = cupo_actual + 1,
              activo = CASE WHEN cupo_actual + 1 >= cupo_maximo THEN false ELSE true END
          WHERE id = $1 AND cupo_actual < cupo_maximo
          RETURNING titulo, cupo_actual, cupo_maximo, (cupo_actual >= cupo_maximo) AS completo;
        `;
        const resCupo = await client.query(queryUpdateCupo, [cupoNecesidadId]);
        if (resCupo.rowCount > 0) {
          var cupoActualizado = resCupo.rows[0];
        }
      }

      await client.query('COMMIT');

      return { ...resNexo.rows[0], cupo_actualizado: cupoActualizado || null, bonus_nivel: bonusNivel, prioridad_aplicada: prioridadAplicada, esfuerzo_aplicado: esfuerzoAplicado };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verifica si el usuario posee al menos un Nexo Social ACTIVO y no expirado.
   */
  static async verificarNexoSocialActivo(usuarioId) {
    const query = `
      SELECT id 
      FROM nexos_sociales 
      WHERE usuario_id = $1 
        AND estado = 'ACTIVO' 
        AND (fecha_expiracion IS NULL OR fecha_expiracion > CURRENT_TIMESTAMP)
      LIMIT 1;
    `;
    const result = await db.query(query, [usuarioId]);
    return result.rows.length > 0;
  }
}

module.exports = VoluntariadoModel;