/**
 * Da de alta nuevamente las cuentas de la demo que estaban bloqueadas.
 *
 * No cambia publicaciones, imágenes ni sesiones: sólo los campos de bloqueo.
 * Es idempotente: correrlo de nuevo no hace nada.
 */
require('dotenv').config();
const db = require('../src/config/db');
const UsuarioModel = require('../src/models/usuarioModel');

const CUENTAS_DEMO = ['38450912', '27333455'];

(async () => {
  try {
    for (const dni of CUENTAS_DEMO) {
      const antes = await db.query(
        `SELECT id, nombre, apellido, activo, suspendido_hasta
         FROM usuarios WHERE dni = $1`,
        [dni]
      );
      const usuario = antes.rows[0];

      if (!usuario) {
        console.log(`DNI ${dni}: no existe en la base, se omite.`);
        continue;
      }

      const estabaBloqueada = usuario.activo === false || usuario.suspendido_hasta != null;
      if (!estabaBloqueada) {
        console.log(`${usuario.nombre} ${usuario.apellido}: ya estaba dada de alta.`);
        continue;
      }

      await UsuarioModel.reactivar(usuario.id);
      console.log(
        `${usuario.nombre} ${usuario.apellido} (DNI ${dni}): dada de alta. ` +
        `activo ${usuario.activo} -> true, suspendido_hasta ${usuario.suspendido_hasta || 'null'} -> null`
      );
    }

    const quedan = await db.query(
      `SELECT nombre, apellido, dni FROM usuarios
       WHERE activo = FALSE OR suspendido_hasta IS NOT NULL
       ORDER BY nombre`
    );
    console.log('\nCuentas bloqueadas o penalizadas que quedan en la base:');
    if (quedan.rows.length === 0) {
      console.log('  (ninguna)');
    } else {
      for (const f of quedan.rows) {
        console.log(`  - ${f.nombre} ${f.apellido} (DNI ${f.dni})`);
      }
    }
  } catch (err) {
    console.error('Fallo:', err.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();
