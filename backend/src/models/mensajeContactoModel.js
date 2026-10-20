/**
 * Buzón de contacto: preguntas, comentarios y pedidos de ayuda que cualquier
 * persona le envía a la administración.
 *
 * Decisiones que importan:
 *
 * - El autor se copia como texto (nombre, dni, teléfono) al momento de
 *   escribir. Si la cuenta se da de baja o se borra, el mensaje sigue
 *   siendo legible y la administración puede seguir respondiendo.
 *
 * - Un mensaje que ya tenía respuesta se puede volver a responder: se
 *   sobrescribe `respuesta` en vez de crear una fila nueva. Así el hilo queda
 *   en un solo lugar y no se duplica la conversación.
 *
 * - `leido` y `respondido` son cosas distintas. Leer un mensaje no lo
 *   contesta: el contador del panel avisa que hay algo nuevo, y el texto de
 *   respuesta es lo que marca el trabajo como terminado.
 */
const db = require('../config/db');

const ASUNTOS_VALIDOS = ['PREGUNTA', 'COMENTARIO', 'CONTACTO'];

class MensajeContactoModel {
  /** Guarda un mensaje nuevo y lo devuelve con su id. */
  static async crear({ usuarioId, autorNombre, autorDni, autorTelefono, asunto, mensaje, ipOrigen }) {
    const query = `
      INSERT INTO mensajes_contacto
        (usuario_id, autor_nombre, autor_dni, autor_telefono, asunto, mensaje, ip_origen)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, asunto, creado_en;
    `;
    const result = await db.query(query, [
      usuarioId ?? null,
      autorNombre,
      autorDni ?? null,
      autorTelefono ?? null,
      asunto,
      mensaje,
      ipOrigen ?? null
    ]);
    return result.rows[0];
  }

  /**
   * Bandeja del panel de administración.
   *
   * Sin 'pendientes' trae todo el historial; con 'pendientes' trae sólo lo que
   * todavía no tiene respuesta, que es lo que la administración necesita ver
   * primero.
   */
  static async listar({ pendientes = false, limite = 200 } = {}) {
    const filtro = pendientes
      ? 'WHERE respuesta IS NULL'
      : '';

    const query = `
      SELECT
        m.id,
        m.asunto,
        m.mensaje,
        m.respuesta,
        m.leido,
        m.autor_nombre,
        m.autor_dni,
        m.autor_telefono,
        m.usuario_id,
        m.respondido_por,
        m.creado_en,
        m.respondido_en,
        TO_CHAR(m.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_legible,
        TO_CHAR(m.respondido_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS respondido_legible,
        respondio.nombre AS respondio_nombre
      FROM mensajes_contacto m
      LEFT JOIN usuarios respondio ON respondio.id = m.respondido_por
      ${filtro}
      ORDER BY (m.respuesta IS NULL) DESC, m.creado_en DESC
      LIMIT $1;
    `;
    const result = await db.query(query, [limite]);
    return result.rows;
  }

  /** Un mensaje puntual, para responderlo. */
  static async obtenerPorId(mensajeId) {
    const result = await db.query(
      `SELECT
         m.id, m.asunto, m.mensaje, m.respuesta, m.leido, m.autor_nombre,
         m.autor_dni, m.autor_telefono, m.usuario_id, m.creado_en,
         m.respondido_en,
         TO_CHAR(m.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_legible
       FROM mensajes_contacto m
       WHERE m.id = $1`,
      [mensajeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Guarda la respuesta de la administración y marca el mensaje como leído.
   *
   * Marcar leído y contestado van juntos: cuando la respuesta queda
   * guardada, el mensaje está atendido.
   */
  static async responder(mensajeId, respuesta, adminId) {
    const result = await db.query(
      `UPDATE mensajes_contacto
       SET respuesta = $2,
           respondido_por = $3,
           respondido_en = CURRENT_TIMESTAMP,
           leido = TRUE
       WHERE id = $1
       RETURNING id, asunto, respuesta, leido, TO_CHAR(respondido_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS respondido_legible;`,
      [mensajeId, respuesta, adminId]
    );
    return result.rows[0] || null;
  }

  /** Marca leído sin responder (quien abrió el panel ya lo vio). */
  static async marcarLeido(mensajeId) {
    const result = await db.query(
      `UPDATE mensajes_contacto SET leido = TRUE WHERE id = $1 RETURNING id, leido;`,
      [mensajeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Cuántos mensajes siguen sin respuesta.
   * Es el número que muestra el aviso en el panel de administración.
   */
  static async contarPendientes() {
    const result = await db.query(
      `SELECT COUNT(*)::int AS total FROM mensajes_contacto WHERE respuesta IS NULL`
    );
    return result.rows[0].total;
  }

  /** Borra un mensaje. Reservado a la administración. */
  static async eliminar(mensajeId) {
    const result = await db.query(
      `DELETE FROM mensajes_contacto WHERE id = $1 RETURNING id;`,
      [mensajeId]
    );
    return result.rows[0] || null;
  }
}

module.exports = MensajeContactoModel;
module.exports.ASUNTOS_VALIDOS = ASUNTOS_VALIDOS;
