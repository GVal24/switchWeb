const db = require('../config/db');

class LegalModel {
  /**
   * Registra la aceptación de un documento legal.
   * usuario_id puede venir null: durante el registro todavía no existe
   * la cuenta, y en ese momento el vínculo se completa después.
   */
  static async registrarAceptacion({
    usuarioId = null,
    documento,
    version,
    hash,
    ipOrigen = null,
    userAgent = null,
  }) {
    const query = `
      INSERT INTO aceptaciones_legales
        (usuario_id, documento, version, hash_documento, ip_origen, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, documento, version, hash_documento, ip_origen, aceptado_en;
    `;
    const result = await db.query(query, [
      usuarioId,
      documento,
      version,
      hash,
      ipOrigen,
      userAgent ? String(userAgent).slice(0, 255) : null,
    ]);
    return result.rows[0];
  }

  /**
   * Vincula las aceptaciones que se hicieron antes de crear la cuenta
   * con el usuario ya creado.
   */
  static async vincularConUsuario(ids, usuarioId) {
    if (!ids || ids.length === 0) return 0;
    const query = `
      UPDATE aceptaciones_legales
      SET usuario_id = $1
      WHERE id = ANY($2::int[]) AND usuario_id IS NULL;
    `;
    const result = await db.query(query, [usuarioId, ids]);
    return result.rowCount;
  }

  /**
   * Historial de aceptaciones de un usuario. Sirve para responder un
   * reclamo mostrando qué versión aceptó y cuándo.
   */
  static async obtenerPorUsuario(usuarioId) {
    const query = `
      SELECT documento, version, hash_documento, ip_origen, aceptado_en
      FROM aceptaciones_legales
      WHERE usuario_id = $1
      ORDER BY aceptado_en ASC;
    `;
    const result = await db.query(query, [usuarioId]);
    return result.rows;
  }
}

module.exports = LegalModel;
