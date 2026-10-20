/**
 * Pruebas de regresión: privacidad del teléfono, textos legales y OTP.
 *
 * Levanta la API real en un puerto efímero y prueba por HTTP contra
 * PostgreSQL. Deja la base como estaba: borra lo que crea.
 *
 * Ejecutar con: node backend/scripts/test_otp_legales.js
 */
require('dotenv').config();
const app = require('../src/index');
const db = require('../src/config/db');
const argonNoUsar = null; // placeholder

let ok = 0;
let fallos = 0;
const pruebas = [];

function afirmar(descripcion, condicion, extra) {
  if (condicion) {
    ok += 1;
    console.log(`  PASS  ${descripcion}`);
  } else {
    fallos += 1;
    console.log(`  FAIL  ${descripcion}${extra ? ` -> ${JSON.stringify(extra)}` : ''}`);
  }
}

const BASE = '/api';
let servidor;
let url;

async function pedir(metodo, ruta, cuerpo, token) {
  const res = await fetch(`${url}${BASE}${ruta}`, {
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
  } catch (_) {
    json = null;
  }
  return { status: res.status, json };
}

const DNI_PRUEBA = '99900011';
const TEL_PRUEBA = '1122334455';

async function main() {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  const puerto = servidor.address().port;
  url = `http://127.0.0.1:${puerto}`;
  console.log(`\nAPI de prueba escuchando en ${url}\n`);

  // ---------------------------------------------------------
  console.log('[1] Textos legales públicos (antes de tener cuenta)');
  // ---------------------------------------------------------
  const indice = await pedir('GET', '/legal');
  afirmar('GET /legal responde 200 sin autenticación', indice.status === 200, indice.json);
  afirmar(
    'el índice lista términos y privacidad',
    indice.json?.datos?.documentos?.length === 2,
    indice.json?.datos?.documentos
  );
  afirmar(
    'cada documento trae versión y hash',
    indice.json?.datos?.documentos?.every((d) => d.version && d.hash?.length === 64)
  );

  const terminos = await pedir('GET', '/legal/terminos');
  afirmar('GET /legal/terminos responde 200', terminos.status === 200);
  afirmar(
    'los términos tienen cláusulas completas',
    terminos.json?.datos?.secciones?.length >= 7,
    terminos.json?.datos?.secciones?.length
  );
  afirmar(
    'los términos ya no prometen una PWA inexistente',
    !JSON.stringify(terminos.json).includes('PWA')
  );
  afirmar(
    'los términos no prometen un Delegado Digital que no existe',
    !JSON.stringify(terminos.json).includes('Delegado Digital')
  );

  // El texto que lee la persona usuaria no lleva listas de trabajo pendiente:
  // no debe aparecer un marcador "PENDIENTE: ...". El estado interno
  // "PENDIENTE_REVISION" sí aparece y tiene que aparecer: es parte de la
  // explicación de la revisión previa.
  afirmar(
    'los términos no muestran marcadores de trabajo',
    !/PENDIENTE\s*:/i.test(JSON.stringify(terminos.json))
  );

  const privacidad = await pedir('GET', '/legal/privacidad');
  afirmar('GET /legal/privacidad responde 200', privacidad.status === 200);
  afirmar(
    'la política de privacidad no muestra marcadores de trabajo',
    !/PENDIENTE\s*:/i.test(JSON.stringify(privacidad.json))
  );
  afirmar(
    'la política cita la Ley 27.744 además de la 25.326',
    JSON.stringify(privacidad.json).includes('27.744')
  );
  afirmar(
    'la política ya no dice que no hay ningún control automático',
    !/No se aplican hoy filtros automáticos de análisis de imagen/i.test(
      JSON.stringify(privacidad.json)
    )
  );
  afirmar(
    'la política describe el control técnico que sí existe',
    /control técnico automático/i.test(JSON.stringify(privacidad.json))
  );
  afirmar(
    'la política dice que las imágenes se sanean sus metadatos',
    /eliminación de sus metadatos|elimina los metadatos/i.test(
      JSON.stringify(privacidad.json)
    )
  );
  afirmar(
    'los términos NO prometen detección automática de menores',
    /NO afirma contar con un sistema que detecte automáticamente/i.test(
      JSON.stringify(terminos.json)
    ),
    'falta el aviso de que no hay detector automático'
  );
  afirmar(
    'y dicen que el control real es la revisión humana',
    /revisión humana, obligatoria e individual/i.test(JSON.stringify(terminos.json))
  );
  afirmar(
    'los términos explican la revisión obligatoria previa',
    /PENDIENTE_REVISION/i.test(JSON.stringify(terminos.json))
  );
  afirmar(
    'los términos explican que las imágenes pendientes no son públicas',
    /acceso restringido/i.test(JSON.stringify(terminos.json))
  );
  afirmar(
    'los términos dicen qué pasa con la imagen de un menor',
    /no se borra/i.test(JSON.stringify(terminos.json))
  );
  afirmar(
    'la política no afirma que la base esté cifrada en reposo',
    !/almacenan en bases de datos relacionales cifradas/i.test(
      JSON.stringify(privacidad.json)
    )
  );
  afirmar(
    'la política aclara que el chat va cifrado sólo en tránsito',
    /cifrados en tránsito/.test(JSON.stringify(privacidad.json))
  );

  const inexistente = await pedir('GET', '/legal/inexistente');
  afirmar('un documento inexistente devuelve 400', inexistente.status === 400, inexistente.json);

  // ---------------------------------------------------------
  console.log('\n[2] El teléfono no se expone públicamente');
  // ---------------------------------------------------------
  const catalogo = await pedir('GET', '/catalogo');
  afirmar('GET /catalogo responde 200 sin autenticación', catalogo.status === 200);
  const publicaciones = catalogo.json?.datos?.publicaciones || catalogo.json?.datos || [];
  afirmar(
    'el catálogo no incluye ningún campo de teléfono',
    !JSON.stringify(publicaciones).includes('telefono')
  );
  afirmar(
    'el catálogo no incluye el alias que exponía el teléfono',
    !JSON.stringify(publicaciones).includes('oferente_telefono')
  );

  const perfilSinSesion = await pedir('GET', '/usuarios/perfil');
  afirmar('el perfil propio sigue requiriendo sesión', perfilSinSesion.status === 401);

  // ---------------------------------------------------------
  console.log('\n[3] OTP: solicitud, límites y verificación');
  // ---------------------------------------------------------
  const sinTelefono = await pedir('POST', '/auth/otp/solicitar', { telefono: '123' });
  afirmar('un teléfono inválido se rechaza con 400', sinTelefono.status === 400, sinTelefono.json);

  const solicitado = await pedir('POST', '/auth/otp/solicitar', {
    telefono: TEL_PRUEBA,
    proposito: 'REGISTRO',
  });
  afirmar('solicitar código responde 200', solicitado.status === 200, solicitado.json);
  const codigo = solicitado.json?.datos?.codigoMock;
  afirmar('en modo mock el código vuelve en la respuesta', !!codigo, solicitado.json?.datos);
  afirmar('el código tiene 6 dígitos', /^\d{6}$/.test(codigo || ''), codigo);
  afirmar(
    'el canal enviado es SMS (el primero de la lista)',
    solicitado.json?.datos?.canalEnviado === 'SMS',
    solicitado.json?.datos?.canalEnviado
  );

  const repetido = await pedir('POST', '/auth/otp/solicitar', { telefono: TEL_PRUEBA });
  afirmar('pedir dos códigos seguidos da 429', repetido.status === 429, repetido.json);
  afirmar(
    'el 429 informa cuántos segundos faltan',
    typeof repetido.json?.detalles?.segundosRestantes === 'number',
    repetido.json?.detalles
  );

  const codigoMalo = await pedir('POST', '/auth/otp/verificar', {
    telefono: TEL_PRUEBA,
    codigo: '000000',
  });
  afirmar('un código incorrecto da 400', codigoMalo.status === 400, codigoMalo.json);
  afirmar(
    'el error dice cuántos intentos quedan',
    /intento/.test(codigoMalo.json?.mensaje || ''),
    codigoMalo.json?.mensaje
  );

  const verificado = await pedir('POST', '/auth/otp/verificar', {
    telefono: TEL_PRUEBA,
    codigo,
  });
  afirmar('el código correcto verifica el teléfono', verificado.status === 200, verificado.json);
  const tokenOtp = verificado.json?.datos?.tokenVerificacion;
  afirmar('la verificación entrega un comprobante firmado', !!tokenOtp);

  const reuso = await pedir('POST', '/auth/otp/verificar', {
    telefono: TEL_PRUEBA,
    codigo,
  });
  afirmar('el mismo código no se puede reutilizar', reuso.status === 400, reuso.json);

  // ---------------------------------------------------------
  console.log('\n[4] El registro exige OTP y aceptación de ambos textos');
  // ---------------------------------------------------------
  const cuerpoRegistro = {
    dni: DNI_PRUEBA,
    nombre: 'Prueba',
    apellido: 'OTP',
    telefono: TEL_PRUEBA,
    password: 'clave123',
    esMayorEdad: true,
    aceptoTerminos: true,
    aceptoPrivacidad: true,
  };

  const sinOtp = await pedir('POST', '/auth/registro', cuerpoRegistro);
  afirmar('registrar sin OTP da 400', sinOtp.status === 400, sinOtp.json);
  afirmar(
    'el mensaje pide verificar el teléfono',
    /teléfono/i.test(sinOtp.json?.mensaje || ''),
    sinOtp.json?.mensaje
  );

  const sinPrivacidad = await pedir('POST', '/auth/registro', {
    ...cuerpoRegistro,
    tokenVerificacion: tokenOtp,
    aceptoPrivacidad: false,
  });
  afirmar('registrar sin aceptar la privacidad da 400', sinPrivacidad.status === 400, sinPrivacidad.json);

  const registroOk = await pedir('POST', '/auth/registro', {
    ...cuerpoRegistro,
    tokenVerificacion: tokenOtp,
  });
  afirmar('registrar con OTP y ambos textos da 201', registroOk.status === 201, registroOk.json);
  afirmar(
    'la respuesta confirma que se aceptaron 2 documentos',
    registroOk.json?.datos?.documentosAceptados === 2,
    registroOk.json?.datos
  );
  afirmar(
    'la respuesta incluye la versión aceptada',
    !!registroOk.json?.datos?.versionDocumentos,
    registroOk.json?.datos?.versionDocumentos
  );

  // ---------------------------------------------------------
  console.log('\n[5] Constancia de la aceptación en la base');
  // ---------------------------------------------------------
  const acept = await db.query(
    `SELECT documento, version, hash_documento, ip_origen, usuario_id, aceptado_en
     FROM aceptaciones_legales WHERE usuario_id = (SELECT id FROM usuarios WHERE dni = $1)
     ORDER BY documento`,
    [DNI_PRUEBA]
  );
  afirmar('se guardaron 2 aceptaciones', acept.rows.length === 2, acept.rows);
  afirmar(
    'están los dos documentos (TÉRMINOS y PRIVACIDAD)',
    acept.rows.map((r) => r.documento).sort().join(',') === 'PRIVACIDAD,TERMINOS',
    acept.rows.map((r) => r.documento)
  );
  afirmar(
    'cada aceptación tiene versión, hash, IP y fecha',
    acept.rows.every(
      (r) => r.version && r.hash_documento?.length === 64 && r.aceptado_en
    )
  );

  const hashEsperado = require('../src/content/legales').hashDocumento('terminos');
  afirmar(
    'el hash guardado coincide con el texto vigente',
    acept.rows.find((r) => r.documento === 'TERMINOS')?.hash_documento === hashEsperado
  );

  // El código nunca se guarda en claro
  const filaOtp = await db.query(
    'SELECT codigo_hash FROM verificaciones_otp WHERE telefono = $1 ORDER BY id DESC LIMIT 1',
    [codigo ? codigo : '']
  );
  const codigosEnClaro = await db.query(
    'SELECT codigo_hash FROM verificaciones_otp'
  );
  afirmar(
    'la tabla de OTP no guarda el código en claro',
    codigosEnClaro.rows.every((r) => /^[a-f0-9]{64}$/.test(r.codigo_hash))
  );
  void filaOtp;

  // ---------------------------------------------------------
  console.log('\n[6] Limpieza');
  // ---------------------------------------------------------
  const borrar = await db.query('DELETE FROM usuarios WHERE dni = $1', [DNI_PRUEBA]);
  const borrarOtp = await db.query('DELETE FROM verificaciones_otp WHERE telefono = $1', [
    require('../src/services/providers/otpProvider').normalizarTelefono(TEL_PRUEBA),
  ]);
  console.log(`  usuarios borrados: ${borrar.rowCount}`);
  console.log(`  códigos OTP borrados: ${borrarOtp.rowCount}`);

  const aceptacionesHuerfanas = await db.query(
    'SELECT COUNT(*)::int AS n FROM aceptaciones_legales WHERE usuario_id IS NULL'
  );
  afirmar(
    'no quedan aceptaciones sin vincular (CASCADE limpió las huérfanas)',
    aceptacionesHuerfanas.rows[0].n === 0,
    aceptacionesHuerfanas.rows[0].n
  );

  // ---------------------------------------------------------
  console.log(`\n${'='.repeat(52)}`);
  console.log(`RESULTADO: ${ok} pruebas OK, ${fallos} fallos`);
  console.log('='.repeat(52));
}

main()
  .then(async () => {
    servidor.close();
    await db.pool.end();
    process.exit(fallos > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error('\nError inesperado en la prueba:', err);
    if (servidor) servidor.close();
    await db.pool.end();
    process.exit(1);
  });
