/**
 * Sanitización de imágenes subidas por las personas usuarias.
 *
 * Sin dependencias externas: se trabaja sobre los bytes del archivo.
 *
 * ¿Por qué importa esto?
 *  1. Privacidad: las fotos de celular vienen con EXIF, y el bloque EXIF
 *     puede traer las coordenadas GPS de dónde se tomó la foto. Publicar
 *     eso en un catálogo abierto revela la dirección de quien publica.
 *  2. Seguridad: los metadatos sobreviven a cualquier recorte y permiten
 *     saber qué dispositivo tomó la foto.
 *
 * Se elimina:
 *   JPEG: APP1 (EXIF/XMP, donde vive el GPS) y APP13 (IPTC), COM.
 *   PNG:   tEXt, zTXt, iTXt (comentarios y software).
 *
 * Se conserva:
 *   JPEG: el resto de la imagen, incluido el perfil de color ICC (APP2),
 *          que si se quita cambia los colores de la foto.
 *   PNG:  IHDR, PLTE, IDAT, IEND y el resto de la imagen.
 */

const fs = require('fs');

const JPEG_SOI = Buffer.from([0xff, 0xd8]);
const PNG_FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Marcadores JPEG que se eliminan por completo. */
const MARCADORES_A_QUITAR = new Set([
  0xe1, // APP1: EXIF (GPS) y XMP
  0xed, // APP13: IPTC
  0xfe, // COM: comentario
]);

/** Marcadores APP1..APP15, útil para saber si hay que seguir avanzando. */
function esMarcadorApp(marcador) {
  return marcador >= 0xe0 && marcador <= 0xef;
}

/**
 * Quita los segmentos EXIF/IPTC/COM de un JPEG.
 * Devuelve el buffer limpio o el original si no se puede parsear.
 */
function limpiarJpeg(buffer) {
  if (buffer.length < 4 || !buffer.slice(0, 2).equals(JPEG_SOI)) {
    return buffer;
  }

  const partes = [JPEG_SOI];
  let offset = 2;
  let quitado = false;

  while (offset < buffer.length - 1) {
    // Se busca el inicio de un marcador (0xFF seguido de un byte distinto
    // de 0xFF, porque 0xFF se usa como relleno entre bytes).
    if (buffer[offset] !== 0xff) {
      // Datos fuera de estructura: desde acá en adelante no se sigue
      // interpretando, se copia el resto tal cual.
      partes.push(buffer.slice(offset));
      break;
    }

    let inicioMarcador = offset;
    while (inicioMarcador < buffer.length && buffer[inicioMarcador] === 0xff) {
      inicioMarcador += 1;
    }

    if (inicioMarcador >= buffer.length) {
      partes.push(buffer.slice(offset));
      break;
    }

    const marcador = buffer[inicioMarcador];

    // Marcadores que no llevan longitud (SOI, EOI, RSTn, TEM).
    const sinLongitud =
      marcador === 0xd8 || marcador === 0xd9 || marcador === 0x01 ||
      (marcador >= 0xd0 && marcador <= 0xd7);

    if (sinLongitud) {
      if (marcador === 0xd9) {
        // Fin de imagen: se copia el resto y se termina.
        partes.push(buffer.slice(offset));
        offset = buffer.length;
        break;
      }
      partes.push(buffer.slice(offset, inicioMarcador + 1));
      offset = inicioMarcador + 1;
      continue;
    }

    // A partir de acá los segmentos llevan longitud de 2 bytes (big endian).
    if (inicioMarcador + 2 >= buffer.length) {
      partes.push(buffer.slice(offset));
      break;
    }
    const longitud = buffer.readUInt16BE(inicioMarcador + 1);

    if (longitud < 2) {
      // Longitud imposible: archivo corrupto, no se toca nada.
      partes.push(buffer.slice(offset));
      break;
    }

    const finSegmento = inicioMarcador + 1 + longitud;

    if (finSegmento > buffer.length) {
      partes.push(buffer.slice(offset));
      break;
    }

    // Start of Scan: lo que sigue es datos comprimidos, no segmentos.
    if (marcador === 0xda) {
      partes.push(buffer.slice(offset));
      offset = buffer.length;
      break;
    }

    if (!MARCADORES_A_QUITAR.has(marcador)) {
      partes.push(buffer.slice(offset, finSegmento));
    } else {
      quitado = true;
    }

    offset = finSegmento;
  }

  if (!quitado) return buffer;
  return Buffer.concat(partes);
}

/** Quita los chunks de texto de un PNG (pueden traer GPS o datos de cámara). */
function limpiarPng(buffer) {
  if (buffer.length < 8 || !buffer.slice(0, 8).equals(PNG_FIRMA)) {
    return buffer;
  }

  const CHUNKS_A_QUITAR = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf']);

  const partes = [PNG_FIRMA];
  let offset = 8;
  let quitado = false;

  while (offset + 8 <= buffer.length) {
    const longitud = buffer.readUInt32BE(offset);
    const tipo = buffer.slice(offset + 4, offset + 8).toString('latin1');
    // longitud (4) + tipo (4) + datos + CRC (4)
    const siguiente = offset + 12 + longitud;

    if (siguiente > buffer.length) {
      partes.push(buffer.slice(offset));
      break;
    }

    if (tipo === 'IEND') {
      partes.push(buffer.slice(offset));
      break;
    }

    if (!CHUNKS_A_QUITAR.has(tipo)) {
      partes.push(buffer.slice(offset, siguiente));
    } else {
      quitado = true;
    }

    offset = siguiente;
  }

  if (!quitado) return buffer;
  return Buffer.concat(partes);
}

/**
 * Limpia una imagen en disco. Devuelve un resumen de lo que hizo.
 */
function sanitizarArchivo(ruta) {
  const original = fs.readFileSync(ruta);
  const esPng = original.slice(0, 8).equals(PNG_FIRMA);
  const limpio = esPng ? limpiarPng(original) : limpiarJpeg(original);

  if (limpio.length !== original.length) {
    fs.writeFileSync(ruta, limpio);
  }

  return {
    bytesAntes: original.length,
    bytesDespues: limpio.length,
    bytesEliminados: original.length - limpio.length,
    formato: esPng ? 'PNG' : 'JPEG',
    metadatosEliminados: limpio.length !== original.length,
  };
}

module.exports = {
  sanitizarArchivo,
  limpiarJpeg,
  limpiarPng,
};
