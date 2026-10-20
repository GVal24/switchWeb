const db = require('../config/db');

class OtpModel {
  /**
   * Guarda un código nuevo. El codigo_hash es el HMAC del código real:
   * la base de datos nunca guarda el código en claro.
   */
  static async crear({ telefono, proposito, canal, codigoHash, ipOrigen, expiraEn, maxIntentos }) {
    const query = `
      INSERT INTO verificaciones_otp
        (telefono, proposito, canal, codigo_hash, ip_origen, max_intentos, expira_en)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, telefono, proposito, canal, intentos, max_intentos,
                expira_en, consumido_en, creado_en;
    `;
    const result = await db.query(query, [
      telefono,
      proposito,
      canal,
      codigoHash,
      ipOrigen || null,
      maxIntentos,
      expiraEn,
    ]);
    return result.rows[0];
  }

  /**
   * Devuelve el código activo más reciente para ese teléfono y propósito:
   * sin consumir, sin intentiones agotadas y no vencido.
   */
  static async obtenerActivo({ telefono, proposito }) {
    const query = `
      SELECT id, telefono, proposito, canal, codigo_hash, intentos,
             max_intentos, expira_en, consumido_en, creado_en
      FROM verificaciones_otp
      WHERE telefono = $1
        AND proposito = $2
        AND consumido_en IS NULL
        AND intentos < max_intentos
        AND expira_en > CURRENT_TIMESTAMP
      ORDER BY creado_en DESC
      LIMIT 1;
    `;
    const result = await db.query(query, [telefono, proposito]);
    return result.rows[0] || null;
  }

  /**
   * Suma un intento fallido. Si se agotan, el registro queda inservible
   * por la condición intentos < max_intentos de obtenerActivo().
   */
  static async sumarIntento(id) {
    const query = `
      UPDATE verificaciones_otp
      SET intentos = intentos + 1
      WHERE id = $1
      RETURNING intentos, max_intentos;
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Marca el código como usado. Un código verificado no se reutiliza.
   */
  static async marcarConsumido(id) {
    const query = `
      UPDATE verificaciones_otp
      SET consumido_en = CURRENT_TIMESTAMP
      WHERE id = $1 AND consumido_en IS NULL
      RETURNING id, telefono, proposito, canal, creado_en, consumido_en;
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Invalida los códigos pendientes de un teléfono para un propósito.
   * Se usa al pedir un reenvío, para que quede un solo código válido.
   */
  static async invalidarPendientes({ telefono, proposito }) {
    const query = `
      UPDATE verificaciones_otp
      SET consumido_en = CURRENT_TIMESTAMP
      WHERE telefono = $1
        AND proposito = $2
        AND consumido_en IS NULL;
    `;
    await db.query(query, [telefono, proposito]);
  }

  /**
   * Freno de abuso: cuántos códigos se emitieron para este teléfono en la
   * última hora. El segundo parámetro es un intervalo de PostgreSQL.
   */
  static async contarEnviosRecientes({ telefono, proposito, minutos }) {
    const query = `
      SELECT COUNT(*)::int AS total
      FROM verificaciones_otp
      WHERE telefono = $1
        AND proposito = $2
        AND creado_en > CURRENT_TIMESTAMP - ($3 || ' minutes')::INTERVAL;
    `;
    const result = await db.query(query, [telefono, proposito, String(minutos)]);
    return result.rows[0]?.total || 0;
  }

  /**
   * Freno de abuso por origen: cuántos códigos se emitieron desde esta IP
   * en la última hora, para que no se use el endpoint para Castigar
   * masivamente números ajenos.
   */
  static async contarEnviosPorIp({ ip, minutos }) {
    if (!ip) return 0;
    const query = `
      SELECT COUNT(*)::int AS total
      FROM verificaciones_otp
      WHERE ip_origen = $1
        AND creado_en > CURRENT_TIMESTAMP - ($2 || ' minutes')::INTERVAL;
    `;
    const result = await db.query(query, [ip, String(minutos)]);
    return result.rows[0]?.total || 0;
  }

  /**
   * Limpieza de códigos vencidos. Los consumidos también se borran: ya no
   * sirven para nada y guardan datos asociados a un teléfono.
   */
  static async purgarVencidos() {
    const query = `
      DELETE FROM verificaciones_otp
      WHERE expira_en < CURRENT_TIMESTAMP - INTERVAL '1 day'
         OR consumido_en IS NOT NULL AND consumido_en < CURRENT_TIMESTAMP - INTERVAL '1 day';
    `;
    await db.query(query);
  }
}

module.exports = OtpModel;
