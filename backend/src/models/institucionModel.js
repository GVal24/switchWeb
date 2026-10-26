const db = require('../config/db');
const { ValidationError, NotFoundError } = require('../utils/customErrors');

class InstitucionModel {
  /**
   * Obtiene la lista completa de instituciones de la comunidad.
   */
  static async obtenerTodas() {
    const query = `
      SELECT
        id,
        nombre,
        tipo,
        direccion,
        descripcion,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM instituciones
      ORDER BY nombre ASC;
    `;
    const result = await db.query(query);
    return result.rows;
  }

  static async obtenerPerfilPublico(id) {
    const result = await db.query(
      `SELECT
         i.id, i.nombre, i.tipo, i.direccion, i.telefono, i.descripcion,
         TO_CHAR(i.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') AS desde,
         (SELECT COUNT(*)::int FROM nexos_sociales n WHERE n.institucion_id = i.id) AS colaboraciones,
         (SELECT COUNT(*)::int FROM cupos_necesidad c WHERE c.institucion_id = i.id) AS necesidades_total,
         (SELECT COUNT(*)::int FROM cupos_necesidad c WHERE c.institucion_id = i.id AND c.activo = TRUE) AS necesidades_abiertas,
         (SELECT COALESCE(SUM(c.cupo_maximo), 0)::int FROM cupos_necesidad c WHERE c.institucion_id = i.id) AS cupos_totales,
         (SELECT COALESCE(SUM(c.cupo_actual), 0)::int FROM cupos_necesidad c WHERE c.institucion_id = i.id) AS cupos_cubiertos
       FROM instituciones i
       WHERE i.id = $1;`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async obtenerPanelUsuario(usuarioId) {
    const result = await db.query(
      `SELECT
         i.id, i.nombre, i.tipo, i.direccion, i.telefono, i.descripcion,
         m.rol AS rol_membresia,
         (SELECT COUNT(*)::int FROM nexos_sociales n WHERE n.institucion_id = i.id) AS colaboraciones,
         (SELECT COUNT(*)::int FROM cupos_necesidad c WHERE c.institucion_id = i.id) AS necesidades_total,
         (SELECT COUNT(*)::int FROM cupos_necesidad c WHERE c.institucion_id = i.id AND c.activo = TRUE) AS necesidades_abiertas,
         (SELECT COALESCE(SUM(c.cupo_maximo), 0)::int FROM cupos_necesidad c WHERE c.institucion_id = i.id) AS cupos_totales,
         (SELECT COALESCE(SUM(c.cupo_actual), 0)::int FROM cupos_necesidad c WHERE c.institucion_id = i.id) AS cupos_cubiertos
       FROM institucion_membresias m
       JOIN instituciones i ON i.id = m.institucion_id
       WHERE m.usuario_id = $1 AND m.activo = TRUE
       ORDER BY i.nombre ASC;`,
      [usuarioId]
    );
    return result.rows;
  }

  static async obtenerMembresiaActiva(institucionId, usuarioId) {
    const result = await db.query(
      `SELECT id, institucion_id, usuario_id, rol
       FROM institucion_membresias
       WHERE institucion_id = $1 AND usuario_id = $2 AND activo = TRUE
       LIMIT 1;`,
      [institucionId, usuarioId]
    );
    return result.rows[0] || null;
  }

  static async listarNecesidadesGestion(institucionId) {
    const result = await db.query(
      `SELECT id, titulo, descripcion, prioridad, cupo_maximo, cupo_actual,
              activo, pausado_manualmente,
              (cupo_actual >= cupo_maximo) AS completo
       FROM cupos_necesidad
       WHERE institucion_id = $1
       ORDER BY creado_en DESC, id DESC;`,
      [institucionId]
    );
    return result.rows;
  }

  static async listarDelegados(institucionId) {
    const result = await db.query(
      `SELECT m.id AS membresia_id, u.id AS usuario_id, u.dni,
              u.nombre, u.apellido, m.creado_en
       FROM institucion_membresias m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.institucion_id = $1
         AND m.rol = 'DELEGADO'
         AND m.activo = TRUE
       ORDER BY u.apellido, u.nombre;`,
      [institucionId]
    );
    return result.rows;
  }

  static async crearNecesidad(institucionId, necesidad) {
    const result = await db.query(
      `INSERT INTO cupos_necesidad
         (institucion_id, titulo, descripcion, prioridad, cupo_maximo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, titulo, descripcion, prioridad, cupo_maximo, cupo_actual,
                 activo, pausado_manualmente, (cupo_actual >= cupo_maximo) AS completo;`,
      [institucionId, necesidad.titulo, necesidad.descripcion, necesidad.prioridad, necesidad.cupoMaximo]
    );
    return result.rows[0];
  }

  static async actualizarNecesidad(institucionId, necesidadId, necesidad) {
    const result = await db.query(
      `UPDATE cupos_necesidad
       SET titulo = $3,
           descripcion = $4,
           prioridad = $5,
           cupo_maximo = $6,
           activo = NOT pausado_manualmente AND cupo_actual < $6
       WHERE institucion_id = $1 AND id = $2 AND $6 >= cupo_actual
       RETURNING id, titulo, descripcion, prioridad, cupo_maximo, cupo_actual,
                 activo, pausado_manualmente, (cupo_actual >= cupo_maximo) AS completo;`,
      [institucionId, necesidadId, necesidad.titulo, necesidad.descripcion, necesidad.prioridad, necesidad.cupoMaximo]
    );
    return result.rows[0] || null;
  }

  static async cambiarPausaNecesidad(institucionId, necesidadId, pausada) {
    const result = await db.query(
      `UPDATE cupos_necesidad
       SET pausado_manualmente = $3,
           activo = NOT $3 AND cupo_actual < cupo_maximo
       WHERE institucion_id = $1 AND id = $2
       RETURNING id, titulo, activo, pausado_manualmente;`,
      [institucionId, necesidadId, pausada]
    );
    return result.rows[0] || null;
  }

  static async agregarDelegado(institucionId, dni, asignadoPor) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const institucionResult = await client.query(
        `SELECT id FROM instituciones WHERE id = $1 FOR UPDATE;`,
        [institucionId]
      );
      if (!institucionResult.rowCount) {
        throw new NotFoundError('No encontramos la institución indicada.');
      }
      const userResult = await client.query(
        `SELECT id, dni, nombre, apellido, activo FROM usuarios WHERE dni = $1 FOR UPDATE;`,
        [dni]
      );
      const usuario = userResult.rows[0];
      if (!usuario) {
        throw new NotFoundError('No encontramos una cuenta registrada con ese DNI.');
      }
      if (!usuario.activo) {
        throw new ValidationError('La cuenta indicada está dada de baja y no puede ser delegada.');
      }
      const responsableResult = await client.query(
        `SELECT id FROM institucion_membresias
         WHERE institucion_id = $1 AND usuario_id = $2
           AND rol = 'RESPONSABLE' AND activo = TRUE;`,
        [institucionId, usuario.id]
      );
      if (responsableResult.rowCount) {
        throw new ValidationError('La persona responsable no puede agregarse también como delegada.');
      }
      const result = await client.query(
        `INSERT INTO institucion_membresias
           (institucion_id, usuario_id, rol, activo, asignado_por)
         VALUES ($1, $2, 'DELEGADO', TRUE, $3)
         ON CONFLICT (institucion_id, usuario_id)
         DO UPDATE SET
           rol = CASE WHEN institucion_membresias.rol = 'RESPONSABLE'
                      THEN institucion_membresias.rol ELSE 'DELEGADO' END,
           activo = CASE WHEN institucion_membresias.rol = 'RESPONSABLE'
                         THEN institucion_membresias.activo ELSE TRUE END,
           asignado_por = EXCLUDED.asignado_por
         RETURNING id, institucion_id, usuario_id, rol, activo;`,
        [institucionId, usuario.id, asignadoPor]
      );
      if (result.rows[0].rol !== 'DELEGADO' || !result.rows[0].activo) {
        throw new ValidationError('La persona ya tiene un rol incompatible en esta institución.');
      }
      await client.query('COMMIT');
      return { usuario, membresia: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async quitarDelegado(institucionId, membresiaId) {
    const result = await db.query(
      `UPDATE institucion_membresias
       SET activo = FALSE
       WHERE institucion_id = $1 AND id = $2 AND rol = 'DELEGADO' AND activo = TRUE
       RETURNING id;`,
      [institucionId, membresiaId]
    );
    return result.rowCount > 0;
  }

  /**
   * Obtiene una institución por su ID (UUID).
   */
  static async obtenerPorId(id) {
    const query = `
      SELECT id, nombre, tipo, direccion, latitud, longitud, qr_codigo_hash
      FROM instituciones
      WHERE id = $1;
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Busca una institución comparando el hash de su código QR físico.
   * La comparación es tolerante: ignora mayúsculas/minúsculas y cualquier
   * espacio en blanco o carácter invisible que el lector del celular pueda
   * agregar al escanear.
   */
  static async obtenerPorQrHash(qrCodigoHash) {
    const normalizado = String(qrCodigoHash || '')
      .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
      .toUpperCase();
    if (!normalizado) return null;

    const query = `
      SELECT id, nombre, tipo, direccion, latitud, longitud
      FROM instituciones
      WHERE UPPER(REGEXP_REPLACE(qr_codigo_hash, '\\s', '', 'g')) = $1
      LIMIT 1;
    `;
    const result = await db.query(query, [normalizado]);
    return result.rows[0] || null;
  }

  /**
   * Lista instituciones junto con su responsable vigente para administración.
   */
  static async listarParaAdministracion() {
    const query = `
      SELECT
        i.id,
        i.nombre,
        i.tipo,
        i.direccion,
        r.id AS responsable_id,
        r.dni AS responsable_dni,
        r.nombre || ' ' || r.apellido AS responsable_nombre
      FROM instituciones i
      LEFT JOIN institucion_membresias m
        ON m.institucion_id = i.id
       AND m.rol = 'RESPONSABLE'
       AND m.activo = TRUE
      LEFT JOIN usuarios r ON r.id = m.usuario_id
      ORDER BY i.nombre ASC;
    `;
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Asigna o transfiere la responsabilidad institucional a una cuenta existente.
   */
  static async asignarResponsable(institucionId, dni, administradorId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const institucionResult = await client.query(
        `SELECT id, nombre FROM instituciones WHERE id = $1 FOR UPDATE;`,
        [institucionId]
      );
      const institucion = institucionResult.rows[0];
      if (!institucion) {
        throw new NotFoundError('No encontramos la institución indicada.');
      }

      const usuarioResult = await client.query(
        `SELECT id, dni, nombre, apellido, activo
         FROM usuarios
         WHERE dni = $1
         FOR UPDATE;`,
        [dni]
      );
      const usuario = usuarioResult.rows[0];
      if (!usuario) {
        throw new NotFoundError('No encontramos una cuenta registrada con ese DNI.');
      }
      if (!usuario.activo) {
        throw new ValidationError('La cuenta indicada está dada de baja y no puede gestionar una institución.');
      }

      await client.query(
        `UPDATE institucion_membresias
         SET activo = FALSE
         WHERE institucion_id = $1
           AND rol = 'RESPONSABLE'
           AND activo = TRUE
           AND usuario_id <> $2;`,
        [institucionId, usuario.id]
      );

      const membresiaResult = await client.query(
        `INSERT INTO institucion_membresias
           (institucion_id, usuario_id, rol, activo, asignado_por)
         VALUES ($1, $2, 'RESPONSABLE', TRUE, $3)
         ON CONFLICT (institucion_id, usuario_id)
         DO UPDATE SET
           rol = 'RESPONSABLE',
           activo = TRUE,
           asignado_por = EXCLUDED.asignado_por
         RETURNING id, institucion_id, usuario_id, rol, activo;`,
        [institucionId, usuario.id, administradorId]
      );

      await client.query('COMMIT');
      return {
        institucion,
        usuario: {
          id: usuario.id,
          dni: usuario.dni,
          nombre: usuario.nombre,
          apellido: usuario.apellido
        },
        membresia: membresiaResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Registra una institución nueva junto con sus necesidades iniciales.
   * Genera automáticamente el hash de QR que la institución imprimirá.
   */
  static async crearConNecesidades({ nombre, tipo, direccion, telefono, descripcion, necesidades }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const qrHash = `QR_${Date.now()}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

      const resInst = await client.query(
        `
        INSERT INTO instituciones (nombre, tipo, direccion, telefono, descripcion, latitud, longitud, qr_codigo_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, nombre, tipo, direccion, telefono, qr_codigo_hash;
        `,
        [
          nombre,
          tipo,
          direccion,
          telefono || null,
          descripcion || null,
          -36.7771 + (Math.random() - 0.5) * 0.02, // Centro geografico con leve variación
          -59.8586 + (Math.random() - 0.5) * 0.02,
          qrHash
        ]
      );

      const institucion = resInst.rows[0];

      for (const n of (necesidades || [])) {
        if (!n.titulo || !String(n.titulo).trim()) continue;
        const prioridad = ['GENERAL', 'PRIORITARIA', 'URGENTE'].includes(String(n.prioridad || '').toUpperCase())
          ? String(n.prioridad).toUpperCase()
          : 'GENERAL';
        await client.query(
          `
          INSERT INTO cupos_necesidad (institucion_id, titulo, descripcion, prioridad, cupo_maximo)
          VALUES ($1, $2, $3, $4, $5);
          `,
          [institucion.id, String(n.titulo).trim(), String(n.descripcion || '').trim(), prioridad, Math.max(1, Number(n.cupoMaximo) || 1)]
        );
      }

      await client.query('COMMIT');
      return institucion;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = InstitucionModel;