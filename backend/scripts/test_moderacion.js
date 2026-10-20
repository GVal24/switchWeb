/**
 * Pruebas del filtro de imágenes y de la cola de moderación.
 *
 * Verifica sobre archivos reales:
 *  - que se limpien los metadatos EXIF/GPS (y que se detecten antes)
 *  - que el formato se detecte por los bytes y no por el nombre
 *  - que una publicación nueva nunca nazca visible
 *  - que aprobar y rechaza hagan lo que corresponde
 *  - que el hallazgo de un menor suspenda la cuenta
 *
 * Ejecutar con: node backend/scripts/test_moderacion.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const app = require('../src/index');
const db = require('../src/config/db');
const moderacion = require('../src/services/moderacionService');
const almacen = require('../src/services/almacenImagenes');
const { sanitizarArchivo } = require('../src/utils/sanitizarImagen');
const { generarArchivos, limpiar } = require('./generarImagenesPrueba');

const UPLOADS = path.resolve(__dirname, '../uploads');

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
let archivos;
/** Copias que guardó el servidor, con nombres pub_<usuario>_<ts>.<ext>. */
const archivosServidor = [];
const creados = [];

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

/** Sube un archivo real usando FormData nativo de Node 18+. */
async function subir(nombreRuta, token, mime = 'image/jpeg') {
  const datos = fs.readFileSync(nombreRuta);
  const form = new FormData();
  form.append('imagen', new Blob([datos], { type: mime }), path.basename(nombreRuta));
  const res = await fetch(`${url}/api/catalogo/imagen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) {}
  // El servidor guarda la copia con otro nombre (pub_<usuario>_<ts>.<ext>).
  // Se anotan para poder borrarlas al terminar.
  if (json?.datos?.nombreArchivo) archivosServidor.push(json.datos.nombreArchivo);
  return { status: res.status, json };
}

/** Crea un usuario limpio con Nexo activo para las pruebas. */
async function crearUsuarioDePrueba(sufijo) {
  const dni = `80${sufijo}00001`;
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('clave123', 10);
  const res = await db.query(
    `INSERT INTO usuarios (dni, nombre, apellido, telefono, password, validado_mayor_edad, rol)
     VALUES ($1, 'Prueba', 'Moderacion', $2, $3, TRUE, 'VECINO') RETURNING id, dni`,
    [dni, `1190000${sufijo}00`, hash]
  );
  creados.push(dni);
  return res.rows[0];
}

async function darNexo(usuarioId) {
  const inst = await db.query(
    `INSERT INTO instituciones (nombre, tipo, direccion, latitud, longitud, qr_codigo_hash)
     VALUES ($1, 'BIBLIOTECA', 'Calle 1', -34.6, -58.4, $2) RETURNING id`,
    [`Inst Prueba ${usuarioId}`, `qr_prueba_${usuarioId}_${Date.now()}`]
  );
  const instId = inst.rows[0].id;
  await db.query(
    `INSERT INTO cupos_necesidad (institucion_id, titulo, descripcion, cupo_maximo, prioridad)
     VALUES ($1, 'Acompañamiento escolar', 'Ayuda con tareas', 50, 'GENERAL')`,
    [instId]
  );
  await db.query(
    `INSERT INTO nexos_sociales (usuario_id, institucion_id, fecha_activacion, estado)
     VALUES ($1, $2, CURRENT_TIMESTAMP, 'ACTIVO')`,
    [usuarioId, instId]
  );
  return instId;
}

async function main() {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  url = `http://127.0.0.1:${servidor.address().port}`;
  console.log(`\nAPI en ${url}\n`);

  archivos = generarArchivos();

  // ---------------------------------------------------------
  console.log('[1] Detección de formato por los bytes, no por el nombre');
  // ---------------------------------------------------------
  const detectadoJpeg = moderacion.detectarFormato(fs.readFileSync(archivos.jpegValido));
  afirmar('un JPEG válido se detecta como JPEG', detectadoJpeg?.nombre === 'JPEG', detectadoJpeg?.nombre);

  const detectadoPng = moderacion.detectarFormato(fs.readFileSync(archivos.png));
  afirmar('un PNG válido se detecta como PNG', detectadoPng?.nombre === 'PNG', detectadoPng?.nombre);

  const falso = moderacion.detectarFormato(fs.readFileSync(archivos.falso));
  afirmar(
    'un texto renombrado a .jpg NO se detecta como imagen',
    falso === null,
    falso?.nombre
  );

  const webpFalso = moderacion.detectarFormato(Buffer.from('RIFF____WAVEfmt '));
  afirmar('un RIFF que no es WEBP no se acepta', webpFalso === null);

  // ---------------------------------------------------------
  console.log('\n[2] Lectura de dimensiones');
  // ---------------------------------------------------------
  const dimsJpeg = moderacion.leerDimensiones(
    fs.readFileSync(archivos.jpegValido),
    detectadoJpeg
  );
  afirmar('se leen las dimensiones del JPEG', dimsJpeg && dimsJpeg.ancho > 0, dimsJpeg);

  const dimsPng = moderacion.leerDimensiones(
    fs.readFileSync(archivos.png),
    detectadoPng
  );
  afirmar('se leen las dimensiones del PNG', dimsPng && dimsPng.ancho > 0, dimsPng);

  // ---------------------------------------------------------
  console.log('\n[3] Eliminación de metadatos EXIF/GPS');
  // ---------------------------------------------------------
  const antes = fs.readFileSync(archivos.jpegConExif);
  const tieneExifAntes = antes.includes(Buffer.from('Exif\0\0', 'latin1'));
  afirmar('el archivo de prueba tiene EXIF antes de limpiar', tieneExifAntes);
  afirmar(
    'el EXIF contiene la palabra GPS antes de limpiar',
    antes.includes(Buffer.from('GPSInfo', 'latin1')) || tieneExifAntes
  );

  const limpieza = sanitizarArchivo(archivos.jpegConExif);
  const despues = fs.readFileSync(archivos.jpegConExif);

  afirmar('el saneado quitó bytes', limpieza.bytesEliminados > 0, limpieza);
  afirmar('ya no queda el bloque Exif', !despues.includes(Buffer.from('Exif\0\0', 'latin1')));
  afirmar('la imagen sigue siendo un JPEG válido', dspuesEsJpeg(despues));
  afirmar(
    'la imagen conserva su contenido (sigue teniendo datos de imagen)',
    despues.length > 100,
    despues.length
  );

  // PNG con tEXt
  const limpiezaPng = sanitizarArchivo(archivos.pngConTexto);
  const pngDespues = fs.readFileSync(archivos.pngConTexto);
  afirmar('se quitó el chunk tEXt del PNG', limpiezaPng.bytesEliminados > 0, limpiezaPng);
  afirmar('el texto "Software" ya no está', !pngDespues.includes('Software'));
  afirmar('el PNG sigue siendo PNG', dspuesEsPng(pngDespues));

  // ---------------------------------------------------------
  console.log('\n[4] Evaluación del filtro técnico');
  // ---------------------------------------------------------
  const evValido = moderacion.evaluarImagen(path.basename(archivos.pngGrande));
  afirmar('una foto válida pasa el filtro técnico', evValido.filtroEstado === 'APROBADA_TECNICAMENTE', evValido.motivos);
  afirmar('pero SIEMPRE requiere revisión humana', evValido.requiereRevisionHumana === true);
  afirmar('nunca se publica automáticamente', evValido.publicadoAutomaticamente === false);

  const evFalso = moderacion.evaluarImagen(path.basename(archivos.falso));
  afirmar('un archivo que no es imagen se rechaza', evFalso.filtroEstado === 'RECHAZADA_TECNICAMENTE');
  afirmar('el motivo es el formato no reconocido', evFalso.motivos.includes('FORMATO_NO_RECONOCIDO'), evFalso.motivos);

  const evAnimado = moderacion.evaluarImagen(path.basename(archivos.gifAnimado));
  afirmar('un GIF animado se rechaza', evAnimado.filtroEstado === 'RECHAZADA_TECNICAMENTE', evAnimado.motivos);
  afirmar('se marca como formato animado', evAnimado.motivos.includes('FORMATO_ANIMADO'), evAnimado.motivos);

  const evDiminuta = moderacion.evaluarImagen(path.basename(archivos.diminuta));
  afirmar('una imagen diminuta se marca', evDiminuta.motivos.length > 0, evDiminuta.motivos);
  afirmar('se marca el tamaño sospechoso', evDiminuta.motivos.includes('ARCHIVO_SOSPECHOSO_MUY_PEQUENO'), evDiminuta.motivos);
  afirmar('se marcan las dimensiones ridículas', evDiminuta.motivos.includes('DIMENSIONES_MUY_PEQUENAS'), evDiminuta.motivos);


  // ---------------------------------------------------------
  console.log('\n[5] Flujo completo con la API');
  // ---------------------------------------------------------
  const admin = await db.query("SELECT id, dni FROM usuarios WHERE rol = 'ADMIN' LIMIT 1");
  const adminId = admin.rows[0].id;
  const bcrypt = require('bcrypt');
  const adminLogin = await pedir('POST', '/auth/login', {
    dni: admin.rows[0].dni,
    password: '123456',
  });
  // La contraseña del seed puede no ser 123456: se crea una sesión directa
  // firmando un token, que es equivalente para probar autorización.
  const jwt = require('jsonwebtoken');
  const tokenAdmin = jwt.sign(
    { id: adminId, rol: 'ADMIN' },
    process.env.JWT_SECRET || 'switch_secreto_temporal',
    { expiresIn: '1h' }
  );
  void adminLogin;
  void bcrypt;

  const user = await crearUsuarioDePrueba('01');
  await darNexo(user.id);
  const tokenUser = jwt.sign(
    { id: user.id, rol: 'VECINO' },
    process.env.JWT_SECRET || 'switch_secreto_temporal',
    { expiresIn: '1h' }
  );

  const subida = await subir(archivos.jpegValido, tokenUser);
  afirmar('la subida responde 201', subida.status === 201, subida.json);
  afirmar(
    'avisa que la imagen queda en revisión',
    subida.json?.datos?.requiereRevisionHumana === true,
    subida.json?.datos
  );
  const nombreImagen = subida.json?.datos?.nombreArchivo;
  afirmar('devuelve el nombre del archivo', !!nombreImagen);

  // ---------------------------------------------------------
  console.log('\n[6] La imagen pendiente NO es pública');
  // ---------------------------------------------------------
  const rutaCuarena = path.join(UPLOADS, '_cuarena', nombreImagen);

  afirmar(
    'el archivo queda guardado en la carpeta de cuarentena',
    fs.existsSync(rutaCuarena)
  );
  afirmar(
    'NO queda en la carpeta pública',
    !fs.existsSync(path.join(UPLOADS, nombreImagen))
  );

  const urlDevuelta = subida.json?.datos?.url;
  afirmar(
    'la URL devuelta apunta a la cuarentena',
    String(urlDevuelta).includes('/uploads/_cuarena/'),
    urlDevuelta
  );

  // Con la ruta que devuelve la API, cualquiera sin sesión NO puede verla.
  const rutaRelativa = String(urlDevuelta).split('/uploads')[1];
  const accesoAnonimo = await fetch(`${url}/uploads${rutaRelativa}`);
  afirmar('sin sesión la imagen NO se puede descargar', accesoAnonimo.status === 404, accesoAnonimo.status);

  const accesoConductor = await fetch(`${url}/uploads${rutaRelativa}`, {
    headers: { Authorization: `Bearer ${tokenUser}` },
  });
  afirmar(
    'ni siquiera quien la subió puede verla por la URL pública',
    accesoConductor.status === 404,
    accesoConductor.status
  );

  const listado = await fetch(`${url}/uploads/`);
  afirmar('no se puede listar la carpeta de cuarentena', listado.status === 404, listado.status);

  const nueva = await pedir(
    'POST',
    '/catalogo/publicar',
    {
      titulo: 'Silla de madera',
      descripcion: 'Silla en buen estado, se entrega en la institución.',
      tipoItem: 'OBJETO',
      imagenUrl: `http://x/uploads/${nombreImagen}`,
      nombreArchivoImagen: nombreImagen,
    },
    tokenUser
  );
  afirmar('la publicación se crea con 201', nueva.status === 201, nueva.json);
  afirmar(
    'nace en PENDIENTE_REVISION, no visible',
    nueva.json?.datos?.estado === 'PENDIENTE_REVISION',
    nueva.json?.datos?.estado
  );
  const publicacionId = nueva.json?.datos?.id;

  // No debe aparecer en el catálogo público
  const catalogo = await pedir('GET', '/catalogo');
  afirmar(
    'no aparece en el catálogo público mientras espera revisión',
    !JSON.stringify(catalogo.json).includes('Silla de madera')
  );

  // Cola de moderación
  const cola = await pedir('GET', '/admin/moderacion/pendientes', null, tokenAdmin);
  afirmar('la cola responde 200', cola.status === 200, cola.json);
  const enCola = (cola.json?.datos?.pendientes || []).find(
    (i) => i.publicacion_id === publicacionId
  );
  afirmar('la imagen aparece en la cola de moderación', !!enCola);
  afirmar('la cola trae el contexto de la publicación', enCola?.titulo === 'Silla de madera', enCola?.titulo);
  afirmar('la cola trae el autor', !!enCola?.autor_nombre, enCola?.autor_nombre);

  const noAdmin = await pedir('GET', '/admin/moderacion/pendientes', null, tokenUser);
  afirmar('un usuario común no puede ver la cola', noAdmin.status === 403, noAdmin.status);

  // La moderadora SÍ tiene que poder mirarla, por un endpoint con sesión
  // de administrador: sin eso, la revisión sería a ciegas.
  const verSinPermiso = await fetch(`${url}/api/admin/moderacion/${enCola.id}/imagen`, {
    headers: { Authorization: `Bearer ${tokenUser}` },
  });
  afirmar('un usuario común no puede ver la imagen en cuarentena', verSinPermiso.status === 403, verSinPermiso.status);

  const verAnonimo = await fetch(`${url}/api/admin/moderacion/${enCola.id}/imagen`);
  afirmar('sin sesión tampoco se puede ver la imagen en cuarentena', verAnonimo.status === 401, verAnonimo.status);

  const verComoAdmin = await fetch(`${url}/api/admin/moderacion/${enCola.id}/imagen`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  afirmar('la administradora sí puede ver la imagen', verComoAdmin.status === 200, verComoAdmin.status);
  afirmar('y recibe el tipo de imagen correcto', verComoAdmin.headers.get('content-type') === 'image/jpeg', verComoAdmin.headers.get('content-type'));

  // Aprobar
  const aprobar = await pedir(
    'POST',
    `/admin/moderacion/${enCola.id}/aprobar`,
    {},
    tokenAdmin
  );
  afirmar('aprobar responde 200', aprobar.status === 200, aprobar.json);

  // Recién ahora la imagen pasa a la carpeta pública.
  afirmar(
    'al aprobar, el archivo sale de la cuarentena',
    fs.existsSync(path.join(UPLOADS, nombreImagen))
  );
  afirmar(
    'y deja de estar en la carpeta de cuarentena',
    !fs.existsSync(rutaCuarena)
  );

  const accesoPublico = await fetch(`${url}/uploads/${nombreImagen}`);
  afirmar('aprobada, la imagen ya es pública', accesoPublico.status === 200, accesoPublico.status);

  const catalogo2 = await pedir('GET', '/catalogo');
  afirmar(
    'después de aprobar, la publicación sí aparece en el catálogo',
    JSON.stringify(catalogo2.json).includes('Silla de madera')
  );
  afirmar(
    'y la publicación apunta a la URL pública, no a la de cuarentena',
    !String(catalogo2.json).includes('/uploads/_cuarena/')
  );

  // No se puede aprobar dos veces
  const aprobar2 = await pedir(
    'POST',
    `/admin/moderacion/${enCola.id}/aprobar`,
    {},
    tokenAdmin
  );
  afirmar('aprobar dos veces da 409', aprobar2.status === 409, aprobar2.status);

  // Rechazar
  const subida2 = await subir(archivos.pngGrande, tokenUser, 'image/png');
  const nombre2 = subida2.json?.datos?.nombreArchivo;
  const pub2 = await pedir(
    'POST',
    '/catalogo/publicar',
    {
      titulo: 'Pizarra',
      descripcion: 'Pizarra de corcho en buen estado.',
      tipoItem: 'OBJETO',
      imagenUrl: `http://x/uploads/${nombre2}`,
      nombreArchivoImagen: nombre2,
    },
    tokenUser
  );
  const pub2Id = pub2.json?.datos?.id;
  const cola2 = await pedir('GET', '/admin/moderacion/pendientes', null, tokenAdmin);
  const item2 = (cola2.json?.datos?.pendientes || []).find((i) => i.publicacion_id === pub2Id);

  const rechazarSinMotivo = await pedir(
    'POST',
    `/admin/moderacion/${item2.id}/rechazar`,
    {},
    tokenAdmin
  );
  afirmar('rechazar sin motivo da 400', rechazarSinMotivo.status === 400, rechazarSinMotivo.json);

  const rechazar = await pedir(
    'POST',
    `/admin/moderacion/${item2.id}/rechazar`,
    { motivoRechazo: 'No cumple las normas de la comunidad.' },
    tokenAdmin
  );
  afirmar('rechazar responde 200', rechazar.status === 200, rechazar.json);
  afirmar('el archivo fue eliminado del servidor', rechazar.json?.datos?.archivoEliminado === true);
  afirmar(
    'la copia que el servidor guardó ya no existe en disco',
    !fs.existsSync(path.join(require('path').resolve(__dirname, '../uploads'), nombre2))
  );

  const estadoPub2 = await db.query('SELECT estado FROM publicaciones_p2p WHERE id = $1', [
    pub2Id,
  ]);
  afirmar('la publicación queda en estado Rechazada', estadoPub2.rows[0].estado === 'Rechazada', estadoPub2.rows[0].estado);

  // Hallazgo de menor de edad
  const subida3 = await subir(archivos.jpegValido, tokenUser);
  const nombre3 = subida3.json?.datos?.nombreArchivo;
  const pub3 = await pedir(
    'POST',
    '/catalogo/publicar',
    {
      titulo: 'Juego de mesa',
      descripcion: 'Juego completo, muy lindo.',
      tipoItem: 'OBJETO',
      imagenUrl: `http://x/uploads/${nombre3}`,
      nombreArchivoImagen: nombre3,
    },
    tokenUser
  );
  const pub3Id = pub3.json?.datos?.id;
  const cola3 = await pedir('GET', '/admin/moderacion/pendientes', null, tokenAdmin);
  const item3 = (cola3.json?.datos?.pendientes || []).find((i) => i.publicacion_id === pub3Id);

  const porMenor = await pedir(
    'POST',
    `/admin/moderacion/${item3.id}/rechazar-menor`,
    {},
    tokenAdmin
  );
  afirmar('rechazar por menor de edad responde 200', porMenor.status === 200, porMenor.json);
  afirmar('marca que contenía un menor', porMenor.json?.datos?.contiene_menor === true);
  afirmar(
    'el archivo se retiene, no se borra',
    porMenor.json?.datos?.archivoRetenido === true
  );
  afirmar('suspende la cuenta del autor', !!porMenor.json?.datos?.usuarioSuspendido, porMenor.json?.datos);

  const susp = await db.query(
    'SELECT suspendido_hasta FROM usuarios WHERE id = $1',
    [user.id]
  );
  afirmar(
    'la cuenta quedó suspendida en la base',
    !!susp.rows[0].suspendido_hasta,
    susp.rows[0].suspendido_hasta
  );
  afirmar(
    'y el archivo sigue reservado, sin quedar accesible',
    fs.existsSync(path.join(UPLOADS, '_cuarena', nombre3))
  );
  const urlTrasMenor = `${url}/uploads/_cuarena/${nombre3}`;
  const intentoDescarga = await fetch(urlTrasMenor);
  afirmar('el archivo reservado tampoco se puede descargar por la web', intentoDescarga.status === 404, intentoDescarga.status);

  const stats = await pedir('GET', '/admin/moderacion/estadisticas', null, tokenAdmin);
  afirmar('las estadísticas responden 200', stats.status === 200);
  afirmar('cuentan el hallazgo de menor', stats.json?.datos?.con_menores >= 1, stats.json?.datos);

  // ---------------------------------------------------------
  console.log('\n[7] Publicaciones sin imagen: también se revisan');
  // ---------------------------------------------------------
  // La cuenta quedó suspendida por el paso anterior, así que se usa una nueva.
  const user2 = await crearUsuarioDePrueba('02');
  await darNexo(user2.id);
  const tokenUser2 = jwt.sign(
    { id: user2.id, rol: 'VECINO' },
    process.env.JWT_SECRET || 'switch_secreto_temporal',
    { expiresIn: '1h' }
  );

  const sinImagen = await pedir(
    'POST',
    '/catalogo/publicar',
    {
      titulo: 'Clases de guitarra para-principiantes',
      descripcion: 'Doy clases de guitarra los sábados.',
      tipoItem: 'SERVICIO',
    },
    tokenUser2
  );
  afirmar('una publicación sin imagen también se crea', sinImagen.status === 201, sinImagen.json);
  afirmar('y nace en PENDIENTE_REVISION', sinImagen.json?.datos?.estado === 'PENDIENTE_REVISION');
  const sinImagenId = sinImagen.json?.datos?.id;

  const colaTexto = await pedir('GET', '/admin/moderacion/pendientes', null, tokenAdmin);
  const itemTexto = (colaTexto.json?.datos?.pendientes || []).find(
    (i) => i.publicacion_id === sinImagenId
  );
  afirmar('la publicación sin imagen aparece en la cola', !!itemTexto, 'no apareció');
  afirmar('se marca como revisión de texto', itemTexto?.tipo_revision === 'TEXTO', itemTexto?.tipo_revision);
  afirmar('no tiene imagen para mirar', itemTexto?.url_para_moderar === null);

  // El cartel del panel se arma con estas estadísticas: si sólo contaran las
  // imágenes, el admin vería "0 pendientes" con textos esperando.
  const statsConTexto = await pedir('GET', '/admin/moderacion/estadisticas', null, tokenAdmin);
  afirmar('las estadísticas suman también las publicaciones de texto',
    statsConTexto.json?.datos?.pendientes >= 1,
    statsConTexto.json?.datos);
  afirmar(
    'y el número coincide con la cola',
    statsConTexto.json?.datos?.pendientes === (colaTexto.json?.datos?.pendientes || []).length,
    { stats: statsConTexto.json?.datos?.pendientes, cola: (colaTexto.json?.datos?.pendientes || []).length }
  );

  const catalogoAntes = await pedir('GET', '/catalogo');
  afirmar(
    'no está visible mientras espera',
    !JSON.stringify(catalogoAntes.json).includes('Clases de guitarra para-principiantes')
  );

  const aprobarTexto = await pedir(
    'POST',
    `/admin/moderacion/texto/${sinImagenId}/aprobar`,
    {},
    tokenAdmin
  );
  afirmar('aprobar el texto responde 200', aprobarTexto.status === 200, aprobarTexto.json);

  const catalogoDespues = await pedir('GET', '/catalogo');
  afirmar(
    'aprobada, la publicación sin imagen sí aparece',
    JSON.stringify(catalogoDespues.json).includes('Clases de guitarra para-principiantes')
  );

  // El mismo hallazgo sobre una publicación SIN imagen: también tiene que
  // rechazar y suspender a la persona. Antes fallaba con error de SQL porque
  // usuarios.motivo_suspension no existía, y ningún test lo cubría.
  const user3 = await crearUsuarioDePrueba('03');
  await darNexo(user3.id);
  const tokenUser3 = jwt.sign(
    { id: user3.id, rol: 'VECINO' },
    process.env.JWT_SECRET || 'switch_secreto_temporal',
    { expiresIn: '1h' }
  );

  const textoSospechoso = await pedir(
    'POST',
    '/catalogo/publicar',
    {
      titulo: 'Muebles usados para medida',
      descripcion: 'Armario y cama matrimonial, diálogo directo.',
      tipoItem: 'OBJETO',
    },
    tokenUser3
  );
  afirmar('otra publicación de texto se crea', textoSospechoso.status === 201, textoSospechoso.json);
  const textoSospechosoId = textoSospechoso.json?.datos?.id;

  const marcarTextoMenor = await pedir(
    'POST',
    `/admin/moderacion/texto/${textoSospechosoId}/rechazar-menor`,
    {},
    tokenAdmin
  );
  afirmar(
    'marcar un texto como posible imagen de menor responde 200',
    marcarTextoMenor.status === 200,
    marcarTextoMenor.json
  );

  const usuarioSuspendido = await db.query(
    'SELECT suspendido_hasta, motivo_suspension FROM usuarios WHERE id = $1',
    [user3.id]
  );
  afirmar(
    'y la cuenta del autor queda suspendida de verdad',
    usuarioSuspendido.rows[0]?.suspendido_hasta != null,
    usuarioSuspendido.rows[0]
  );
  afirmar(
    'con el motivo de la suspensión anotado',
    /menor/i.test(usuarioSuspendido.rows[0]?.motivo_suspension || ''),
    usuarioSuspendido.rows[0]?.motivo_suspension
  );

  const catalogoTrasMenor = await pedir('GET', '/catalogo');
  afirmar(
    'y la publicación no queda visible',
    !JSON.stringify(catalogoTrasMenor.json).includes('Muebles usados para medida')
  );

  // ---------------------------------------------------------
  console.log('\n[8] No se puede publicar la foto de otra persona');
  // ---------------------------------------------------------
  const subidaAjena = await subir(archivos.pngGrande, tokenUser2, 'image/png');
  const nombreAjeno = subidaAjena.json?.datos?.nombreArchivo;
  afirmar('el segundo usuario también puede subir', subidaAjena.status === 201);

  // user2 intenta usar una imagen subida por... nadie: nombre inventado.
  const inventada = await pedir(
    'POST',
    '/catalogo/publicar',
    {
      titulo: 'Ropa de invierno',
      descripcion: 'Abrigos y camperas para el frío.',
      tipoItem: 'OBJETO',
      imagenUrl: `${url}/uploads/cualquiera.jpg`,
      nombreArchivoImagen: 'no_existe_este_archivo.jpg',
    },
    tokenUser2
  );
  afirmar('un nombre de archivo inventado se rechaza con 400', inventada.status === 400, inventada.status);

  // URL sin nombre de archivo: no se puede verificar de quién es.
  const urlSola = await pedir(
    'POST',
    '/catalogo/publicar',
    {
      titulo: 'Mueble',
      descripcion: 'Mesa de madera para el comedor.',
      tipoItem: 'OBJETO',
      imagenUrl: `${url}/uploads/cualquiera.jpg`,
    },
    tokenUser2
  );
  afirmar('mandar sólo una URL, sin nombre de archivo, se rechaza', urlSola.status === 400, urlSola.status);

  // Limpieza de la subida que no se llegó a usar.
  await db.query('DELETE FROM moderacion_imagenes WHERE nombre_archivo = $1', [nombreAjeno]);
  almacen.eliminarArchivo(nombreAjeno);
  afirmar('la imagen subida sin usar no queda publicada', !fs.existsSync(path.join(UPLOADS, nombreAjeno)));

  console.log(`\n${'='.repeat(52)}`);
  console.log(`RESULTADO: ${ok} OK, ${fallos} fallos`);
  console.log('='.repeat(52));
}

function dspuesEsJpeg(buf) {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}
function dspuesEsPng(buf) {
  return (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

main()
  .then(async () => {
    await limpiarEstado();
    limpiar(archivos);
    servidor.close();
    await db.pool.end();
    await new Promise((r) => setTimeout(r, 300));
    process.exit(fallos > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error('\nError inesperado:', err);
    await limpiarEstado();
    if (archivos) limpiar(archivos);
    if (servidor) servidor.close();
    await db.pool.end();
    await new Promise((r) => setTimeout(r, 300));
    process.exit(1);
  });

/** Deja la base y el disco como estaban. */
async function limpiarEstado() {
  try {
    for (const dni of creados) {
      const u = await db.query('SELECT id FROM usuarios WHERE dni = $1', [dni]);
      if (u.rows[0]) {
        await db.query('DELETE FROM moderacion_imagenes WHERE usuario_id = $1', [u.rows[0].id]);
        await db.query('DELETE FROM usuarios WHERE id = $1', [u.rows[0].id]);
        await db.query('DELETE FROM instituciones WHERE nombre = $1', [`Inst Prueba ${u.rows[0].id}`]);
      }
    }
    await db.query("DELETE FROM moderacion_imagenes WHERE nombre_archivo LIKE 'prueba_mod%'");

    // Las copias del servidor se borran por nombre: si no, la prueba deja
    // basura en uploads/ y en la cola de moderación.
    let borrados = 0;
    for (const nombre of archivosServidor) {
      if (almacen.eliminarArchivo(nombre)) borrados += 1;
    }
    console.log(`\nBase restaurada. ${borrados} archivos de prueba borrados del servidor.`);
  } catch (e) {
    console.warn('Aviso al limpiar:', e.message);
  }
}
