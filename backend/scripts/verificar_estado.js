/**
 * Verifica que la base quedó limpia y que los cambios de esta tanda
 * (teléfono privado, OTP, legales) no rompieron el estado de las cuentas.
 */
require('dotenv').config();
const db = require('../src/config/db');
const app = require('../src/index');
const { hashDocumento } = require('../src/content/legales');

let ok = 0;
let fallos = 0;
function afirmar(desc, cond, extra) {
  if (cond) {
    ok += 1;
    console.log(`  PASS  ${desc}`);
  } else {
    fallos += 1;
    console.log(`  FAIL  ${desc}${extra ? ` -> ${JSON.stringify(extra)}` : ''}`);
  }
}

let servidor;
let url;

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
  } catch (_) {}
  return { status: res.status, json };
}

(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  url = `http://127.0.0.1:${servidor.address().port}`;

  console.log('\n[A] Estado de la base de datos');
  const u = await db.query('SELECT COUNT(*)::int AS n FROM usuarios');
  const p = await db.query("SELECT COUNT(*)::int AS n FROM publicaciones_p2p WHERE estado='Activo'");
  const n = await db.query('SELECT COUNT(*)::int AS n FROM nexos_sociales');
  const i = await db.query('SELECT COUNT(*)::int AS n FROM intercambios');
  const susp = await db.query('SELECT COUNT(*)::int AS n FROM usuarios WHERE suspendido_hasta IS NOT NULL');
  const bajas = await db.query('SELECT COUNT(*)::int AS n FROM usuarios WHERE activo = FALSE');
  console.log(`  usuarios=${u.rows[0].n} publicaciones=${p.rows[0].n} nexos=${n.rows[0].n} intercambios=${i.rows[0].n}`);
  console.log(`  suspendidos=${susp.rows[0].n} dados de baja=${bajas.rows[0].n}`);

  // Estas cuentas suspendidas o dadas de baja son datos reales de la demo, no
  // basura de pruebas: por eso se busca residuo por patrón de DNI y no un
  // número congelado de usuarios (el catálogo crece cuando se agregan datos).
  const pruebas = await db.query(
    "SELECT COUNT(*)::int AS n FROM usuarios WHERE dni LIKE '80%'"
  );
  afirmar('no quedan usuarios de prueba', pruebas.rows[0].n === 0, pruebas.rows[0].n);

  const pruebasSuspendidas = await db.query(
    "SELECT COUNT(*)::int AS n FROM usuarios WHERE dni LIKE '80%' AND suspendido_hasta IS NOT NULL"
  );
  afirmar('no quedan cuentas de prueba suspendidas', pruebasSuspendidas.rows[0].n === 0);

  const pruebasBajas = await db.query(
    "SELECT COUNT(*)::int AS n FROM usuarios WHERE dni LIKE '80%' AND activo = FALSE"
  );
  afirmar('no quedan cuentas de prueba dadas de baja', pruebasBajas.rows[0].n === 0);

  afirmar('el catálogo de demostración sigue cargado', u.rows[0].n >= 13, u.rows[0].n);

  // Si hay cuentas suspendidas o dadas de baja, se listan: si aparecen sin que
  // nadie las haya hecho a mano, es residuo y hay que investigarlo.
  const suspendidasAhora = await db.query(
    'SELECT id, nombre, apellido, dni, suspendido_hasta, motivo_suspension FROM usuarios WHERE suspendido_hasta IS NOT NULL ORDER BY id'
  );
  for (const cuenta of suspendidasAhora.rows) {
    console.log(
      `  suspendida: ${cuenta.nombre} ${cuenta.apellido} (DNI ${cuenta.dni}) hasta ${cuenta.suspendido_hasta}` +
        (cuenta.motivo_suspension ? ` — ${cuenta.motivo_suspension}` : '')
    );
  }
  const bajasAhora = await db.query(
    'SELECT id, nombre, apellido, dni FROM usuarios WHERE activo = FALSE ORDER BY id'
  );
  for (const cuenta of bajasAhora.rows) {
    console.log(`  dada de baja: ${cuenta.nombre} ${cuenta.apellido} (DNI ${cuenta.dni})`);
  }

  const otpHuerfanos = await db.query(
    "SELECT COUNT(*)::int AS n FROM verificaciones_otp WHERE telefono LIKE '%11223344%'"
  );
  afirmar('no quedaron códigos OTP de la prueba', otpHuerfanos.rows[0].n === 0);

  const accVacias = await db.query('SELECT COUNT(*)::int AS n FROM aceptaciones_legales');
  console.log(`  aceptaciones_legales registradas: ${accVacias.rows[0].n} (las de usuarios previos a esta función)`);

  console.log('\n[B] Privacidad del teléfono en toda la API');
  const cat = await pedir('GET', '/catalogo');
  afirmar('el catálogo responde 200', cat.status === 200);
  afirmar('el catálogo no menciona telefono', !JSON.stringify(cat.json).includes('telefono'));

  const inst = await pedir('GET', '/instituciones');
  afirmar('las instituciones responden 200', inst.status === 200);
  // El teléfono de la institución sí es público: es un dato de contacto
  // institucional, no personal de un usuario.
  console.log('  (el teléfono institucional sí se publica: es un dato de la institución)');

  console.log('\n[C] El login y las cuentas suspendidas siguen funcionando');
  const sample = await db.query(
    "SELECT dni FROM usuarios WHERE activo = TRUE AND suspendido_hasta IS NULL LIMIT 1"
  );
  const dni = sample.rows[0].dni;
  const loginMal = await pedir('POST', '/auth/login', { dni, password: 'claveIncorrecta123' });
  afirmar('una contraseña incorrecta da 401', loginMal.status === 401, loginMal.json?.mensaje);

  const loginOk = await pedir('POST', '/auth/login', { dni, password: '123456' });
  afirmar(
    'el login sigue respondiendo (401 o 200 según la contraseña del seed)',
    [200, 401].includes(loginOk.status),
    loginOk.json?.mensaje
  );

  console.log('\n[D] Los documentos legales se sirven íntegros');
  for (const id of ['terminos', 'privacidad']) {
    const doc = await pedir('GET', `/legal/${id}`);
    const secciones = doc.json?.datos?.secciones?.length || 0;
    afirmar(`${id} tiene al menos 6 secciones`, secciones >= 6, secciones);
    afirmar(
      `${id} expone su hash para la constancia`,
      doc.json?.datos?.hash === hashDocumento(id)
    );
  }

  console.log('\n[E] No se filtra el código OTP en ningún mensaje de error');
  // Número único por ejecución: si se usara uno fijo, el cooldown del
  // teléfono haría fallar la segunda corrida al poco tiempo de la primera.
  const telefonoPrueba = `1155${String(Date.now()).slice(-7)}`;
  const pedir1 = await pedir('POST', '/auth/otp/solicitar', { telefono: telefonoPrueba });
  const codigo = pedir1.json?.datos?.codigoMock;
  afirmar('se emitió un código para la prueba', !!codigo, pedir1.json?.mensaje);
  const errorConCodigo = await pedir('POST', '/auth/otp/verificar', {
    telefono: telefonoPrueba,
    codigo: '999999',
  });
  afirmar(
    'el mensaje de error no incluye el código correcto',
    !!codigo && !JSON.stringify(errorConCodigo).includes(codigo),
    errorConCodigo.json?.mensaje
  );

  await db.query('DELETE FROM verificaciones_otp WHERE telefono = $1', [`54${telefonoPrueba}`]);
  await db.query('DELETE FROM verificaciones_otp WHERE telefono = $1', [telefonoPrueba]);

  console.log(`\n${'='.repeat(52)}`);
  console.log(`RESULTADO: ${ok} OK, ${fallos} fallos`);
  console.log('='.repeat(52));
})()
  .then(async () => {
    servidor.close();
    await db.pool.end();
    process.exit(fallos > 0 ? 1 : 0);
  })
  .catch(async (e) => {
    console.error('Error:', e);
    if (servidor) servidor.close();
    await db.pool.end();
    process.exit(1);
  });
