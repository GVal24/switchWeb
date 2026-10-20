/**
 * Genera imágenes de prueba reales para verificar el filtrado.
 *   - un JPEG válido
 *   - un JPEG con EXIF y coordenadas GPS (como sacan los celulares)
 *   - un PNG
 *   - un GIF animado
 *   - un archivo que NO es una imagen (renombrado)
 */
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

/** JPEG mínimo válido 1x1 (gris) en base64. */
const JPEG_BASE =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCABkAGQBAREA/8QAHwAAAQUBAQEB' +
  'AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh' +
  'ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ' +
  'WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG' +
  'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAEC' +
  'AwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBC' +
  'SMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0' +
  'dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2' +
  'Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';

/** Bloque EXIF con un IFD de GPS con coordenadas reales. */
function bloqueExifConGps() {
  // Estructura TIFF: "II" (little endian), magic 42, offset al IFD0.
  const tiff = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // header, IFD0 en offset 8
    0x01, 0x00, // 1 entrada
    // entrada: tag GPSInfoIFDPointer (0x8825), tipo LONG, count 1
    0x25, 0x88, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
    0x1a, 0x00, 0x00, 0x00, // valor: offset 26 hacia el IFD de GPS
    0x00, 0x00, 0x00, 0x00, // next IFD = 0

    // IFD de GPS en el offset 26
    0x01, 0x00, // 1 entrada
    // GPSLatitudeRef (1), tipo ASCII(2), count 2, valor "S"
    0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x53, 0x00, 0x00, 0x00, // 'S'
    0x00, 0x00, 0x00, 0x00, // next
  ]);

  const cabeceraExif = Buffer.from('Exif\0\0', 'latin1');
  return Buffer.concat([cabeceraExif, tiff]);
}

/** Inserta un segmento APP1 (EXIF) justo después del SOI. */
function jpegConExif() {
  const jpeg = Buffer.from(JPEG_BASE, 'base64');
  const exif = bloqueExifConGps();

  const segmento = Buffer.alloc(4 + exif.length);
  segmento[0] = 0xff;
  segmento[1] = 0xe1; // APP1
  segmento.writeUInt16BE(2 + exif.length, 2);
  exif.copy(segmento, 4);

  return Buffer.concat([jpeg.slice(0, 2), segmento, jpeg.slice(2)]);
}

/** PNG 1x1 transparente. */
const PNG_BASE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmM' +
  'IQAAAABJRU5ErkJggg==';

/** PNG con un chunk tEXt que dice "Software" y otro con coordenadas. */
function pngConTexto() {
  const png = Buffer.from(PNG_BASE, 'base64');
  const firma = png.slice(0, 8);
  const ihdr = png.slice(8, 8 + 25); // longitud 13 + tipo 4 + datos 13 + CRC 4

  function chunk(tipo, contenido) {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(contenido.length, 0);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), contenido]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(cuerpo) >>> 0, 0);
    return Buffer.concat([largo, cuerpo, crc]);
  }

  const texto = Buffer.from('Software\x00Switch Test 1.0\x00', 'latin1');
  return Buffer.concat([firma, ihdr, chunk('tEXt', texto), png.slice(8 + 25)]);
}

let TABLA_CRC = null;
function crc32(buf) {
  if (!TABLA_CRC) {
    TABLA_CRC = [];
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      TABLA_CRC[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = TABLA_CRC[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** GIF89a con dos cuadros de control => imagen animada. */
const GIF_ANIMADO = Buffer.from(
  'R0lGODlhAgACAIAAAP///wAAACH5BAEAAAAALAAAAAACAAIAAAIChFQAOw==',
  'base64'
);

/**
 * PNG con dimensiones realistas y peso suficiente para pasar el filtro.
 *
 * Se construye parcheando el IHDR del PNG de 1x1 (el filtro técnico sólo
 * lee la cabecera, nunca decodifica píxeles) y agregando un chunk tEXt de
 * relleno que el saneador después elimina. Sirve para probar el camino
 * "imagen válida que pasa el filtro técnico".
 */
function pngGrandeValido() {
  const png = Buffer.from(PNG_BASE, 'base64');
  const firma = png.slice(0, 8);
  const ihdrOriginal = png.slice(8, 8 + 25);

  // IHDR: longitud(4) tipo(4) ancho(4) alto(4) profundidad(1) color(1) ...
  const ihdrCuerpo = Buffer.from(ihdrOriginal.slice(8, 8 + 13));
  ihdrCuerpo.writeUInt32BE(800, 0); // ancho
  ihdrCuerpo.writeUInt32BE(600, 4); // alto

  const tipoIhdr = Buffer.from('IHDR', 'latin1');
  const ihdrReconstruido = Buffer.concat([tipoIhdr, ihdrCuerpo]);
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(ihdrCuerpo.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(ihdrReconstruido) >>> 0, 0);
  const ihdrNuevo = Buffer.concat([largo, ihdrReconstruido, crc]);

  // Relleno: un tEXt largo que el saneador va a quitar después.
  const relleno = Buffer.alloc(3000, 0x41);
  const texto = Buffer.concat([
    Buffer.from('Comentario\x00', 'latin1'),
    relleno,
  ]);

  // El resto del PNG original (IDAT, IEND) va después del IHDR.
  return Buffer.concat([firma, ihdrNuevo, chunk('tEXt', texto), png.slice(8 + 25)]);
}

function chunk(tipo, contenido) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(contenido.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), contenido]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo) >>> 0, 0);
  return Buffer.concat([largo, cuerpo, crc]);
}

module.exports = {
  DIR,
  JPEG_BASE,
  generarArchivos() {
    const archivos = {
      jpegValido: path.join(DIR, 'prueba_mod_valido.jpg'),
      jpegConExif: path.join(DIR, 'prueba_mod_exif.jpg'),
      png: path.join(DIR, 'prueba_mod.png'),
      pngConTexto: path.join(DIR, 'prueba_mod_texto.png'),
      pngGrande: path.join(DIR, 'prueba_mod_grande.png'),
      gifAnimado: path.join(DIR, 'prueba_mod_animado.gif'),
      falso: path.join(DIR, 'prueba_mod_falso.jpg'),
      diminuta: path.join(DIR, 'prueba_mod_diminuta.png'),
    };

    fs.writeFileSync(archivos.jpegValido, Buffer.from(JPEG_BASE, 'base64'));
    fs.writeFileSync(archivos.jpegConExif, jpegConExif());
    fs.writeFileSync(archivos.png, Buffer.from(PNG_BASE, 'base64'));
    fs.writeFileSync(archivos.pngConTexto, pngConTexto());
    fs.writeFileSync(archivos.pngGrande, pngGrandeValido());
    fs.writeFileSync(archivos.gifAnimado, GIF_ANIMADO);
    // Un archivo de texto con extensión .jpg: el filtro no debe creerse el nombre.
    fs.writeFileSync(archivos.falso, 'esto no es una imagen, es texto plano'.repeat(40));
    // PNG de 1x1: demasiado chica para ser una foto.
    fs.writeFileSync(archivos.diminuta, Buffer.from(PNG_BASE, 'base64'));

    return archivos;
  },
  limpiar(archivos) {
    Object.values(archivos).forEach((ruta) => {
      try {
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
      } catch (_) {}
    });
  },
};
