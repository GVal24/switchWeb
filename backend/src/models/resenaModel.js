const db = require('../config/db');

class ResenaModel {
  /**
   * Registra la calificación de una parte del trueque hacia la otra.
   * La restricción UNIQUE (intercambio_id, autor_id) evita reseñas duplicadas.
   */
  static async crear({ intercambioId, autorId, destinoId, puntaje, comentario }) {
    const query = `
      INSERT INTO resenas (intercambio_id, autor_id, destino_id, puntaje, comentario)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (intercambio_id, autor_id) DO UPDATE
        SET puntaje = EXCLUDED.puntaje,
            comentario = EXCLUDED.comentario
      RETURNING id, puntaje;
    `;
    const result = await db.query(query, [intercambioId, autorId, destinoId, puntaje, comentario]);
    return result.rows[0];
  }
}

module.exports = ResenaModel;
