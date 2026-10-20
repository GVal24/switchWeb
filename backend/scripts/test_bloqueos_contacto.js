/**
 * Pruebas del desbloqueo de cuentas y del buzón de contacto.
 *
 * Hace HTTP real contra la API, igual que una persona o la app:
 *  - que la lista de bloqueados distinga baja permanente de penalización
 *  - que una penalización vencida figure como vencida
 *  - que dar de alta funcione para los dos casos
 *  - que un admin no pueda darse de alta a sí mismo
 *  - que un usuario normal no pueda ver la lista ni reactivar a nadie
 *  - que el buzón guarde, cuente y responda mensajes
 *  - que el contador de pendientes baje al responder
 *  - que se rechace el texto vacío y el mensaje demasiado largo
 *
 * Ejecutar con: node backend/scripts/test_bloqueos_contacto.js
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = require('../src/index');
const db = require('../src/config/db');

let ok = 0;
let fallos = 0;
function afirmar(desc, cond, extra) {
  if (cond) {
    ok += 1;
    console.log(`  PASS  ${desc}`);
  } else {
    fallos += 1;
    console.log(`  FAIL  ${desc}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`);
  }
}

let servidor;
let url;
const creados = [];

function firmar(id, rol) {
  return jwt.sign(
    { id, rol },
    process.env.JWT_SECRET || 'switch_secreto_temporal',
    { expiresIn: '1h' }
  );
}

/** Usuario limpio, con Nexo activo para poder operar. */
async function crearUsuario(sufijo, rol = 'VECINO') {
  const dni = `81${sufijo}00001`;
  const hash = await bcrypt.hash('clave123', 10);
  const res = await db.query(
    `INSERT INTO usuarios (dni, nombre, apellido, telefono, password, validado_mayor_edad, rol)
     VALUES ($1, 'Prueba', 'Bloqueo', $2, $3, TRUE, $4) RETURNING id, dni, nombre, apellido, rol`,
    [dni, `1180000${sufijo}00`, hash, rol]
  );
  creados.push(dni);
  return res.rows[0];
}

async function pedir(metodo, ruta, cuerpo, token) {
  const res = await fetch(`${url}/api${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

(async () => {
  try {
    servidor = app.listen(0);
    await new Promise((r) => servidor.once('listening', r));
    url = `http://127.0.0.1:${servidor.address().port}`;
    console.log(`\nAPI en ${url}\n`);

    const admin = await crearUsuario('01', 'ADMIN');
    const tokenAdmin = firmar(admin.id, 'ADMIN');
    const vecino = await crearUsuario('02');
    const tokenVecino = firmar(vecino.id, 'VECINO');

    console.log('--- 1. Lista de cuentas bloqueadas y penalizadas ---');

    // Un usuario dado de baja (activo = FALSE)
    const baja = await crearUsuario('03');
    await db.query('UPDATE usuarios SET activo = FALSE WHERE id = $1', [baja.id]);

    // Uno con penalización vigente
    const penalizado = await crearUsuario('04');
    await db.query(
      `UPDATE usuarios SET suspendido_hasta = CURRENT_TIMESTAMP + INTERVAL '5 days',
                          motivo_suspension = 'Prueba de penalizacion'
       WHERE id = $1`,
      [penalizado.id]
    );

    // Uno con penalización YA vencida: el plazo corrió
    const vencido = await crearUsuario('05');
    await db.query(
      `UPDATE usuarios SET suspendido_hasta = CURRENT_TIMESTAMP - INTERVAL '1 day',
                          motivo_suspension = 'Prueba de penalizacion vencida'
       WHERE id = $1`,
      [vencido.id]
    );

    // Uno habilitado: no debe aparecer
    const sano = await crearUsuario('06');

    const lista = await pedir('GET', '/admin/usuarios-bloqueados', null, tokenAdmin);
    afirmar('el admin puede ver la lista de bloqueados', lista.status === 200, lista.json);
    const filas = lista.json?.datos?.bloqueados || [];
    // No se espera un total exacto: la base puede tener cuentas reales
    // bloqueadas. Se comprueba que estén las tres de esta prueba.
    afirmar('la lista trae los tres casos de prueba',
      [baja.id, penalizado.id, vencido.id].every((id) => filas.some((f) => f.id === id)),
      filas.map((f) => f.id));

    const fBaja = filas.find((f) => f.id === baja.id);
    afirmar('la baja permanente figura como deshabilitada', fBaja?.deshabilitado === true, fBaja);
    afirmar('la baja permanente no tiene fecha de vencimiento', fBaja?.suspendido_hasta == null, fBaja);

    const fPenal = filas.find((f) => f.id === penalizado.id);
    afirmar('la penalizacion vigente figura como suspendido', fPenal?.suspendido === true, fPenal);
    afirmar('la penalizacion vigente muestra dias restantes', fPenal?.dias_restantes >= 4, fPenal?.dias_restantes);

    const fVencido = filas.find((f) => f.id === vencido.id);
    afirmar('la penalizacion vencida NO figura como suspendido', fVencido?.suspendido === false, fVencido);
    afirmar('la penalizacion vencida figura como vencida', fVencido?.suspension_vencida === true, fVencido);

    afirmar('un usuario sano no aparece en la lista', !filas.some((f) => f.id === sano.id));

    console.log('\n--- 2. Solo el admin ---');

    const sinToken = await pedir('GET', '/admin/usuarios-bloqueados');
    afirmar('sin sesion no se puede ver la lista', sinToken.status === 401, sinToken.status);

    const comoVecino = await pedir('GET', '/admin/usuarios-bloqueados', null, tokenVecino);
    afirmar('un usuario normal no puede ver la lista', comoVecino.status === 403, comoVecino.status);

    const reactivarComoVecino = await pedir(
      'POST', '/admin/reactivar', { usuarioId: baja.id }, tokenVecino
    );
    afirmar('un usuario normal no puede dar de alta a nadie', reactivarComoVecino.status === 403, reactivarComoVecino.status);
    const sigueBajo = await db.query('SELECT activo FROM usuarios WHERE id = $1', [baja.id]);
    afirmar('y la cuenta sigue dada de baja', sigueBajo.rows[0].activo === false);

    console.log('\n--- 3. Dar de alta nuevamente ---');

    const reactivarBaja = await pedir('POST', '/admin/reactivar', { usuarioId: baja.id }, tokenAdmin);
    afirmar('el admin da de alta una baja permanente', reactivarBaja.status === 200, reactivarBaja.json);
    afirmar('el mensaje lo dice en palabras simples', /dado de alta nuevamente/.test(reactivarBaja.json?.mensaje || ''), reactivarBaja.json?.mensaje);
    const bajaAhora = await db.query('SELECT activo FROM usuarios WHERE id = $1', [baja.id]);
    afirmar('la cuenta queda activa', bajaAhora.rows[0].activo === true);

    const reactivarPenal = await pedir('POST', '/admin/reactivar', { usuarioId: penalizado.id }, tokenAdmin);
    afirmar('el admin levanta una penalizacion vigente', reactivarPenal.status === 200, reactivarPenal.json);
    const penalAhora = await db.query('SELECT suspendido_hasta, motivo_suspension FROM usuarios WHERE id = $1', [penalizado.id]);
    afirmar('la fecha de vencimiento se borra', penalAhora.rows[0].suspendido_hasta == null, penalAhora.rows[0]);
    afirmar('el motivo de la penalizacion se borra', penalAhora.rows[0].motivo_suspension == null, penalAhora.rows[0]);

    const reactivarVencido = await pedir('POST', '/admin/reactivar', { usuarioId: vencido.id }, tokenAdmin);
    afirmar('el admin limpia una penalizacion vencida', reactivarVencido.status === 200, reactivarVencido.json);

    // No se compara contra cero: la base puede tener cuentas reales bloqueadas
    // (por ejemplo la cuenta de la demo). Lo que importa es que ninguna de
    // las cuentas de esta prueba siga bloqueada.
    const listaDepois = await pedir('GET', '/admin/usuarios-bloqueados', null, tokenAdmin);
    const quedanDePrueba = (listaDepois.json?.datos?.bloqueados || []).filter((f) =>
      [baja.id, penalizado.id, vencido.id].includes(f.id)
    );
    afirmar('ninguna cuenta de prueba queda bloqueada', quedanDePrueba.length === 0, quedanDePrueba);

    const aSiMismo = await pedir('POST', '/admin/reactivar', { usuarioId: admin.id }, tokenAdmin);
    afirmar('el admin no se da de alta a si mismo', aSiMismo.status === 400, aSiMismo.status);
    const adminActivo = await db.query('SELECT activo FROM usuarios WHERE id = $1', [admin.id]);
    afirmar('el admin sigue con su cuenta', adminActivo.rows[0].activo === true);

    const inexistente = await pedir('POST', '/admin/reactivar', { usuarioId: 99999999 }, tokenAdmin);
    afirmar('dar de alta a alguien inexistente avisa que no existe', inexistente.status === 404, inexistente.status);

    const sinId = await pedir('POST', '/admin/reactivar', {}, tokenAdmin);
    afirmar('sin usuarioId se rechaza', sinId.status === 400, sinId.status);

    const idBasura = await pedir('POST', '/admin/reactivar', { usuarioId: 'abc' }, tokenAdmin);
    afirmar('un id no numerico se rechaza', idBasura.status === 400, idBasura.status);

    console.log('\n--- 3b. La penalizacion se levanta sola al vencer ---');

    // Esto es lo que se quiere comprobar: que nadie tenga que hacer nada. La
    // penalizacion tiene el plazo vencido, la persona entra con su usuario y
    // contraseña, y al entrar ya puede publicar otra vez.
    const venceSolo = await crearUsuario('07');
    await db.query(
      `UPDATE usuarios SET suspendido_hasta = CURRENT_TIMESTAMP - INTERVAL '2 hours',
                          motivo_suspension = 'Prueba de vencimiento automatico'
       WHERE id = $1`,
      [venceSolo.id]
    );
    const antesDeEntrar = await db.query(
      'SELECT suspendido_hasta FROM usuarios WHERE id = $1', [venceSolo.id]
    );
    afirmar('antes de entrar la penalizacion sigue puesta',
      antesDeEntrar.rows[0].suspendido_hasta != null, antesDeEntrar.rows[0]);

    const entrada = await pedir('POST', '/auth/login', {
      dni: venceSolo.dni,
      password: 'clave123',
    });
    afirmar('una penalizacion vencida no impide entrar', entrada.status === 200, entrada.json);
    afirmar('el backend avisa que ya no esta suspendida',
      entrada.json?.datos?.suspensionVigente === false, entrada.json?.datos);
    afirmar('no manda la fecha de vencimiento vencida',
      entrada.json?.datos?.suspendidoHasta == null, entrada.json?.datos);

    const despuesDeEntrar = await db.query(
      'SELECT suspendido_hasta, motivo_suspension FROM usuarios WHERE id = $1', [venceSolo.id]
    );
    afirmar('la fecha se limpia sola al entrar',
      despuesDeEntrar.rows[0].suspendido_hasta == null, despuesDeEntrar.rows[0]);
    afirmar('el motivo tambien se limpia solo',
      despuesDeEntrar.rows[0].motivo_suspension == null, despuesDeEntrar.rows[0]);

    // Y al revés: con el plazo en vigor sigue sin poder publicar, y seguir
    // entrando no lo levanta antes de tiempo.
    const sigueVigente = await crearUsuario('08');
    await db.query(
      `UPDATE usuarios SET suspendido_hasta = CURRENT_TIMESTAMP + INTERVAL '2 days',
                          motivo_suspension = 'Prueba de penalizacion vigente'
       WHERE id = $1`,
      [sigueVigente.id]
    );
    const entradaVigente = await pedir('POST', '/auth/login', {
      dni: sigueVigente.dni,
      password: 'clave123',
    });
    afirmar('una penalizacion vigente deja entrar igual', entradaVigente.status === 200, entradaVigente.json);
    afirmar('pero avisa que sigue suspendida',
      entradaVigente.json?.datos?.suspensionVigente === true, entradaVigente.json?.datos);
    afirmar('y manda la fecha de vencimiento',
      !!entradaVigente.json?.datos?.suspendidoHasta, entradaVigente.json?.datos);
    const sigueVigenteDb = await db.query(
      'SELECT suspendido_hasta FROM usuarios WHERE id = $1', [sigueVigente.id]
    );
    afirmar('entrar antes de tiempo NO levanta la penalizacion',
      sigueVigenteDb.rows[0].suspendido_hasta != null, sigueVigenteDb.rows[0]);

    // Y una baja permanente no se levanta sola: eso lo decide un humano.
    const bajaNoSeLevanta = await crearUsuario('09');
    await db.query('UPDATE usuarios SET activo = FALSE WHERE id = $1', [bajaNoSeLevanta.id]);
    const entradaBaja = await pedir('POST', '/auth/login', {
      dni: bajaNoSeLevanta.dni,
      password: 'clave123',
    });
    afirmar('una cuenta bloqueada no entra', entradaBaja.status === 403, entradaBaja.status);
    const bajaSigue = await db.query('SELECT activo FROM usuarios WHERE id = $1', [bajaNoSeLevanta.id]);
    afirmar('y no se da de alta sola', bajaSigue.rows[0].activo === false);

    console.log('\n--- 4. Buzon de contacto ---');

    // La base puede tener mensajes reales, así que se toma como referencia el
    // número de pendientes de antes y se compara la diferencia.
    const pendientesInicial = await pedir('GET', '/admin/contacto/pendientes', null, tokenAdmin);
    const base0 = pendientesInicial.json?.datos?.pendientes ?? -1;
    afirmar('el contador de pendientes se puede leer', base0 >= 0, pendientesInicial.json?.datos);

    const buzonComoVecino = await pedir('GET', '/admin/contacto', null, tokenVecino);
    afirmar('un usuario normal no puede leer el buzon', buzonComoVecino.status === 403, buzonComoVecino.status);

    const consultarComoVecino = await pedir('GET', '/admin/contacto/pendientes', null, tokenVecino);
    afirmar('un usuario normal no puede ver el contador', consultarComoVecino.status === 403, consultarComoVecino.status);

    const marca = 'foto de perfil';
    const enviar = await pedir('POST', '/contacto', {
      asunto: 'PREGUNTA',
      mensaje: '¿Como hago para cambiar mi foto de perfil?'
    }, tokenVecino);
    afirmar('un usuario puede escribir un mensaje', enviar.status === 201, enviar.json);
    const idMensaje = enviar.json?.datos?.id;

    const buzonAdmin = await pedir('GET', '/admin/contacto', null, tokenAdmin);
    const recibido = buzonAdmin.json?.datos?.mensajes?.find((m) => m.id === idMensaje);
    afirmar('el admin ve el mensaje en la bandeja', Boolean(recibido), idMensaje);
    afirmar('guarda el texto que se escribio', recibido?.mensaje?.includes(marca), recibido?.mensaje);
    afirmar('guarda el nombre del autor', recibido?.autor_nombre === 'Prueba Bloqueo', recibido?.autor_nombre);
    afirmar('guarda el DNI del autor para poder responderle', /^81/.test(recibido?.autor_dni || ''), recibido?.autor_dni);
    afirmar('guarda el teléfono del autor', Boolean(recibido?.autor_telefono), recibido?.autor_telefono);
    afirmar('arranca sin responder', recibido?.respuesta == null, recibido?.respuesta);
    afirmar('arranca sin leer', recibido?.leido === false, recibido?.leido);

    const pendientesTrasEnvio = await pedir('GET', '/admin/contacto/pendientes', null, tokenAdmin);
    afirmar('el contador sube a 1', (pendientesTrasEnvio.json?.datos?.pendientes - base0) === 1, {
      antes: base0, ahora: pendientesTrasEnvio.json?.datos?.pendientes
    });

    // Segundo mensaje: comentario, sin sesión
    const sinSesion = await pedir('POST', '/contacto', {
      asunto: 'CONTACTO',
      mensaje: 'Escribo sin haber entrado a mi cuenta',
      nombre: 'Alguien sin sesion'
    });
    afirmar('también se puede escribir sin sesión', sinSesion.status === 201, sinSesion.json);
    const idSinSesion = sinSesion.json?.datos?.id;
    const buzonSinSesion = await db.query('SELECT autor_nombre, autor_dni, usuario_id FROM mensajes_contacto WHERE id = $1', [idSinSesion]);
    afirmar('sin sesión no se guarda el DNI de nadie', buzonSinSesion.rows[0].autor_dni == null, buzonSinSesion.rows[0]);
    afirmar('sin sesión tampoco se vincula a una cuenta', buzonSinSesion.rows[0].usuario_id == null, buzonSinSesion.rows[0]);
    afirmar('se guarda el nombre que escribió la persona', buzonSinSesion.rows[0].autor_nombre === 'Alguien sin sesion', buzonSinSesion.rows[0]);

    const vacio = await pedir('POST', '/contacto', { asunto: 'PREGUNTA', mensaje: '   ' }, tokenVecino);
    afirmar('un mensaje vacío se rechaza', vacio.status === 400, vacio.status);

    const largo = await pedir('POST', '/contacto', {
      asunto: 'PREGUNTA',
      mensaje: 'a'.repeat(2001)
    }, tokenVecino);
    afirmar('un mensaje de más de 2000 caracteres se rechaza', largo.status === 400, largo.status);

    const asuntoFalso = await pedir('POST', '/contacto', {
      asunto: 'HACK', mensaje: 'prueba'
    }, tokenVecino);
    afirmar('un tipo de mensaje inventado se rechaza', asuntoFalso.status === 400, asuntoFalso.status);

    console.log('\n--- 5. Responder ---');

    const responder = await pedir('POST', `/admin/contacto/${idMensaje}/responder`, {
      respuesta: 'Entrá a tu perfil y tocá la foto para cambiarla.'
    }, tokenAdmin);
    afirmar('el admin responde el mensaje', responder.status === 200, responder.json);
    afirmar('la respuesta queda guardada', /tocá la foto/.test(responder.json?.datos?.respuesta || ''), responder.json?.datos?.respuesta);
    afirmar('el mensaje queda marcado como leído', responder.json?.datos?.leido === true, responder.json?.datos);

    const pendientesTrasResponder = await pedir('GET', '/admin/contacto/pendientes', null, tokenAdmin);
    afirmar('el contador baja después de responder', (pendientesTrasResponder.json?.datos?.pendientes - base0) === 1, {
      antes: pendientesTrasEnvio.json?.datos?.pendientes, ahora: pendientesTrasResponder.json?.datos?.pendientes
    });

    const soloPendientes = await pedir('GET', '/admin/contacto?pendientes=1', null, tokenAdmin);
    const pendientesDePrueba = (soloPendientes.json?.datos?.mensajes || []).filter((m) =>
      [idMensaje, idSinSesion].includes(m.id)
    );
    afirmar('el filtro de pendientes deja sólo lo que no tiene respuesta', pendientesDePrueba.length === 1, pendientesDePrueba.map((m) => m.id));
    afirmar('y es el mensaje que no se respondió', pendientesDePrueba[0]?.id === idSinSesion, pendientesDePrueba[0]?.id);

    const todos = await pedir('GET', '/admin/contacto', null, tokenAdmin);
    const mios = (todos.json?.datos?.mensajes || []).filter((m) => [idMensaje, idSinSesion].includes(m.id));
    afirmar('sin filtro se ve todo el historial', mios.length === 2, mios.map((m) => m.id));
    afirmar('lo respondido figura con su respuesta', Boolean(
      mios.find((m) => m.id === idMensaje)?.respuesta
    ));
    afirmar('figura quién respondió', Boolean(
      mios.find((m) => m.id === idMensaje)?.respondio_nombre
    ));
    afirmar('lo pendiente va primero en la bandeja', mios[0]?.id === idSinSesion, mios.map((m) => m.id));

    const responderVacio = await pedir('POST', `/admin/contacto/${idMensaje}/responder`, {
      respuesta: '  '
    }, tokenAdmin);
    afirmar('una respuesta vacía se rechaza', responderVacio.status === 400, responderVacio.status);

    const responderFantasma = await pedir('POST', '/admin/contacto/99999999/responder', {
      respuesta: 'hola'
    }, tokenAdmin);
    afirmar('responder a un mensaje inexistente avisa que no existe', responderFantasma.status === 404, responderFantasma.status);

    const leerComoVecino = await pedir('POST', `/admin/contacto/${idSinSesion}/leer`, {}, tokenVecino);
    afirmar('un usuario normal no puede marcar leído', leerComoVecino.status === 403, leerComoVecino.status);

    console.log('\n--- 6. Limpieza ---');

    await db.query('DELETE FROM mensajes_contacto WHERE usuario_id IN (SELECT id FROM usuarios WHERE dni = ANY($1))', [creados]);
    await db.query("DELETE FROM mensajes_contacto WHERE autor_nombre LIKE 'Alguien sin sesion'");
    const quedan = await db.query("SELECT COUNT(*)::int AS n FROM mensajes_contacto WHERE autor_nombre IN ('Prueba Bloqueo', 'Alguien sin sesion')");
    afirmar('no quedan mensajes de prueba', quedan.rows[0].n === 0, quedan.rows[0]);

    console.log(`\n${'='.repeat(52)}`);
    console.log(`RESULTADO: ${ok} OK, ${fallos} fallos`);
    console.log(`${'='.repeat(52)}\n`);
  } catch (e) {
    console.error('\nLa prueba se cortó por un error:', e);
    fallos += 1;
  } finally {
    if (servidor) {
      await new Promise((r) => servidor.close(r));
    }
    try {
      if (creados.length > 0) {
        await db.query('DELETE FROM usuarios WHERE dni = ANY($1)', [creados]);
        console.log(`Base restaurada. ${creados.length} usuarios de prueba borrados.`);
      }
    } catch (e) {
      console.warn('Aviso al limpiar:', e.message);
    }
    process.exit(fallos > 0 ? 1 : 0);
  }
})();
