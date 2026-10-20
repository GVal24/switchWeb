const db = require('../config/db');
const { calcularImpacto } = require('../utils/gamificacion');

class UsuarioModel {
  /**
   * Busca un usuario por DNI incluyendo su contraseña encriptada (para Login)
   */
  static async buscarPorDni(dni) {
    const query = `
      SELECT 
        id, 
        dni, 
        nombre, 
        apellido, 
        telefono, 
        password,
        validado_mayor_edad, 
        rol, 
        activo,
        suspendido_hasta,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM usuarios 
      WHERE dni = $1 
      LIMIT 1;
    `;
    const result = await db.query(query, [dni]);
    return result.rows[0] || null;
  }

  /**
   * Busca un usuario por DNI o Teléfono para verificar duplicados
   */
  static async buscarPorDniOTelefono(dni, telefono) {
    const query = `
      SELECT id, dni, telefono 
      FROM usuarios 
      WHERE dni = $1 OR telefono = $2 
      LIMIT 1;
    `;
    const result = await db.query(query, [dni, telefono]);
    return result.rows[0] || null;
  }

  /**
   * Inserta un nuevo usuario guardando el hash de la contraseña
   */
  static async crear({ dni, nombre, apellido, telefono, esMayorEdad, password }) {
    const query = `
      INSERT INTO usuarios (dni, nombre, apellido, telefono, validado_mayor_edad, password)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, dni, nombre, apellido, telefono, validado_mayor_edad, rol, creado_en;
    `;
    const values = [dni, nombre, apellido, telefono, esMayorEdad, password];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Da de baja lógica definitiva a un usuario (bloqueo permanente por administración)
   */
  static async darDeBaja(usuarioId) {
    const query = `
      UPDATE usuarios
      SET activo = FALSE, suspendido_hasta = NULL
      WHERE id = $1
      RETURNING id, dni, nombre, apellido, activo;
    `;
    const result = await db.query(query, [usuarioId]);
    return result.rows[0] || null;
  }

  /**
   * Suspende a un usuario por una cantidad de días (bloqueo temporal).
   * Si dias es null o 0, levanta la suspensión.
   */
  static async suspender(usuarioId, dias) {
    if (!dias || Number(dias) <= 0) {
      return this.levantarSuspension(usuarioId);
    }
    // No se toca 'activo': una baja lógica permanente no puede revertirse
    // suspendiendo al usuario (eso lo rehabilitaba indebidamente).
    const query = `
      UPDATE usuarios
      SET suspendido_hasta = CURRENT_TIMESTAMP + ($2 || ' days')::interval
      WHERE id = $1 AND activo = TRUE
      RETURNING id, dni, nombre, apellido, TO_CHAR(suspendido_hasta AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') AS suspendido_hasta;
    `;
    const result = await db.query(query, [usuarioId, String(Number(dias))]);
    if (result.rows[0]) return result.rows[0];

    // No se actualizó: o el usuario no existe, o está dado de baja.
    const { NotFoundError, ValidationError } = require('../utils/customErrors');
    const existe = await db.query('SELECT activo FROM usuarios WHERE id = $1', [usuarioId]);
    if (!existe.rows[0]) {
      throw new NotFoundError('El usuario indicado no existe.');
    }
    throw new ValidationError('No se puede suspender a un usuario que está dado de baja.');
  }

  /**
   * Estado de habilitación de un usuario en el momento actual.
   * Es la única fuente de verdad para decidir si puede operar en la plataforma:
   *  - deshabilitado: baja lógica permanente (activo = FALSE)
   *  - suspendido: baja temporal con vencimiento (suspendido_hasta > ahora)
   *  - habilitado: puede operar
   */
  static async obtenerEstadoHabilitacion(usuarioId) {
    const result = await db.query(
      `SELECT 
         id,
         nombre,
         apellido,
         rol,
         activo,
         suspendido_hasta,
         (activo = FALSE) AS deshabilitado,
         (activo = TRUE AND suspendido_hasta > CURRENT_TIMESTAMP) AS suspendido,
         TO_CHAR(suspendido_hasta AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS suspendido_hasta_legible
       FROM usuarios
       WHERE id = $1`,
      [usuarioId]
    );

    const fila = result.rows[0];
    if (!fila) return null;

    return {
      ...fila,
      habilitado: !fila.deshabilitado && !fila.suspendido
    };
  }

  /**
   * Una baja lógica permanente cierra el acceso: el usuario no puede ni
   * entrar. Distinto de una suspensión, que es una penalización temporal y
   * sí permite entrar en modo lectura.
   */
  static async exigirCuentaNoDadaDeBaja(usuarioId) {
    const estado = await this.obtenerEstadoHabilitacion(usuarioId);
    if (!estado) {
      const { NotFoundError } = require('../utils/customErrors');
      throw new NotFoundError('El usuario de esta sesión no existe.');
    }
    if (estado.deshabilitado) {
      const { ForbiddenError } = require('../utils/customErrors');
      throw new ForbiddenError('Tu cuenta fue dada de baja por la administración.');
    }
    return estado;
  }

  /**
   * Verifica que un usuario esté habilitado para operar.
   * Lanza ForbiddenError con un mensaje claro si está suspendido o dado de baja.
   * @param {number} usuarioId
   * @param {string} [motivo] qué intentó hacer, para armar el mensaje.
   */
  static async exigirHabilitacion(usuarioId, motivo = 'operar en la plataforma') {
    const estado = await this.obtenerEstadoHabilitacion(usuarioId);
    if (!estado) {
      const { NotFoundError } = require('../utils/customErrors');
      throw new NotFoundError('El usuario no existe.');
    }
    if (estado.deshabilitado) {
      const { ForbiddenError } = require('../utils/customErrors');
      throw new ForbiddenError('Tu cuenta fue dada de baja por la administración. No podés ' + motivo + '.');
    }
    if (estado.suspendido) {
      const { ForbiddenError } = require('../utils/customErrors');
      throw new ForbiddenError(
        `Tu cuenta está suspendida hasta el ${estado.suspendido_hasta_legible}. ` +
        'Durante la suspensión no podés ' + motivo + '.'
      );
    }
    return estado;
  }

  /**
   * Levanta la suspensión de un usuario
   */
  static async levantarSuspension(usuarioId) {
    const result = await db.query(
      `UPDATE usuarios SET suspendido_hasta = NULL, motivo_suspension = NULL
       WHERE id = $1
       RETURNING id, dni, nombre, apellido;`,
      [usuarioId]
    );
    return result.rows[0] || null;
  }

  /**
   * Da de alta nuevamente a una cuenta dada de baja.
   *
   * darDeBaja() es una baja lógica permanente (activo = FALSE): la persona
   * pierde el acceso y sus publicaciones salen del catálogo. Este método es
   * el camino inverso y queda reservado al rol ADMIN.
   */
  static async reactivar(usuarioId) {
    const result = await db.query(
      `UPDATE usuarios
       SET activo = TRUE,
           suspendido_hasta = NULL,
           motivo_suspension = NULL
       WHERE id = $1
       RETURNING id, dni, nombre, apellido, activo, suspendido_hasta;`,
      [usuarioId]
    );
    return result.rows[0] || null;
  }

  /**
   * Lista las cuentas bloqueadas o penalizadas, para que la administración
   * pueda verlas y decidir.
   *
   * Se listan las dos situaciones distintas, y sólo una está vencida:
   *  - deshabilitado: baja lógica permanente, no entra a la plataforma
   *  - suspendido: penalización temporal; se marca si el plazo ya corrió
   */
  static async listarBloqueados() {
    const query = `
      SELECT
        id, dni, nombre, apellido, rol, activo,
        suspendido_hasta,
        motivo_suspension,
        (activo = FALSE) AS deshabilitado,
        (activo = TRUE AND suspendido_hasta > CURRENT_TIMESTAMP) AS suspendido,
        (activo = TRUE AND suspendido_hasta IS NOT NULL
          AND suspendido_hasta <= CURRENT_TIMESTAMP) AS suspension_vencida,
        -- Días enteros que faltan, para que la pantalla pueda decir "3 días"
        -- sin tener que interpretar un intervalo. Si ya venció, 0.
        CASE
          WHEN activo = FALSE OR suspendido_hasta IS NULL THEN NULL
          ELSE GREATEST(CEIL(EXTRACT(EPOCH FROM (suspendido_hasta - CURRENT_TIMESTAMP)) / 86400.0)::int, 0)
        END AS dias_restantes,
        TO_CHAR(suspendido_hasta AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS suspendido_hasta_legible,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') AS creado_legible
      FROM usuarios
      WHERE activo = FALSE
         OR (activo = TRUE AND suspendido_hasta IS NOT NULL)
      ORDER BY (activo = FALSE) DESC, suspendido_hasta ASC NULLS LAST;
    `;
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Devuelve los datos del usuario junto a sus estadísticas reales:
   * trueques completados, voluntariados y reputación (reseñas recibidas).
   */
  static async obtenerPerfilConEstadisticas(usuarioId) {
    const queryUsuario = `
      SELECT 
        id, 
        dni, 
        nombre, 
        apellido, 
        telefono, 
        validado_mayor_edad, 
        rol,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') AS miembro_desde
      FROM usuarios 
      WHERE id = $1 AND activo = TRUE
      LIMIT 1;
    `;

    const queryStats = `
      SELECT
        (SELECT COUNT(*) FROM intercambios
          WHERE estado = 'COMPLETADO' AND (dueno_id = $1 OR ofertante_id = $1)) AS trueques_completados,
        (SELECT COUNT(*) FROM nexos_sociales WHERE usuario_id = $1) AS voluntariados,
        (SELECT COALESCE(ROUND(AVG(puntaje)::numeric, 1), 0) FROM resenas WHERE destino_id = $1) AS calificacion_promedio,
        (SELECT COUNT(*) FROM resenas WHERE destino_id = $1) AS cantidad_resenas,
        (SELECT COUNT(*) FROM nexos_sociales
          WHERE usuario_id = $1 AND EXTRACT(HOUR FROM (fecha_activacion AT TIME ZONE 'America/Argentina/Buenos_Aires')) < 8) AS voluntariados_madrugada;
    `;

    const [resUsuario, resStats] = await Promise.all([
      db.query(queryUsuario, [usuarioId]),
      db.query(queryStats, [usuarioId])
    ]);

    if (resUsuario.rowCount === 0) return null;

    const stats = resStats.rows[0];
    const estadisticas = {
      truequesCompletados: Number(stats.trueques_completados),
      voluntariados: Number(stats.voluntariados),
      calificacionPromedio: parseFloat(stats.calificacion_promedio),
      cantidadResenas: Number(stats.cantidad_resenas),
      // Pionero: uno de los primeros vecinos en registrarse en la plataforma
      esPionero: Number(resUsuario.rows[0].id) <= 10,
      voluntariadosMadrugada: Number(stats.voluntariados_madrugada)
    };

    return {
      ...resUsuario.rows[0],
      estadisticas,
      impacto: calcularImpacto(estadisticas)
    };
  }

  /**
   * Devuelve el nombre de pila de un usuario (para propuestas de trueque).
   */
  static async obtenerNombrePorId(usuarioId) {
    const result = await db.query(
      `SELECT nombre FROM usuarios WHERE id = $1 LIMIT 1;`,
      [usuarioId]
    );
    return result.rows[0]?.nombre || 'Vecino/a';
  }

  /**
   * Datos de identidad para poder responderle a una persona.
   *
   * El token de sesión sólo lleva { id, rol }, así que el nombre, el DNI y el
   * teléfono hay que buscarlos: sin esto el buzón de contacto guardaría a
   * todos los autores como "Visitante" y la administración no podría saber a
   * quién escribirle.
   */
  static async obtenerIdentidadPorId(usuarioId) {
    const result = await db.query(
      `SELECT id, nombre, apellido, dni, telefono
       FROM usuarios WHERE id = $1 LIMIT 1;`,
      [usuarioId]
    );
    return result.rows[0] || null;
  }
}

module.exports = UsuarioModel;