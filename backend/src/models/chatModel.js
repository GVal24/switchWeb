const db = require('../config/db');

class ChatModel {
  /**
   * Obtiene la conversación bidireccional entre dos participantes.
   * Los IDs son VARCHAR para soportar usuarios ("1") e instituciones ("inst_1").
   */
  static async obtenerConversacion(emisorId, receptorId) {
    const query = `
      SELECT 
        id,
        emisor_id,
        receptor_id,
        texto,
        leido,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en
      FROM mensajes_chat
      WHERE (emisor_id = $1 AND receptor_id = $2)
         OR (emisor_id = $2 AND receptor_id = $1)
      ORDER BY creado_en ASC;
    `;
    const result = await db.query(query, [String(emisorId), String(receptorId)]);
    return result.rows;
  }

  /**
   * Registra un nuevo mensaje en la conversación.
   */
  static async crearMensaje({ emisorId, receptorId, texto }) {
    const query = `
      INSERT INTO mensajes_chat (emisor_id, receptor_id, texto)
      VALUES ($1, $2, $3)
      RETURNING 
        id,
        emisor_id,
        receptor_id,
        texto,
        leido,
        TO_CHAR(creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS creado_en;
    `;
    const result = await db.query(query, [String(emisorId), String(receptorId), texto]);
    return result.rows[0];
  }
}

module.exports = ChatModel;
