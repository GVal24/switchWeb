/**
 * Filtrado de imágenes publicadas en el Catálogo P2P.
 *
 * OBJETIVO REAL, y lo que este módulo NO hace:
 *
 * Este filtro NO intenta adivinar si una persona de la foto es menor de
 * edad. No existe un detector confiable: los modelos de estimación de edad
 * se erran por años y fallan con fotos borrosas, de perfil, con el rostro
 * tapado, o retocadas. Un filtro que acierta el 85%
 * daría una falsa sensación de protección y dejaría pasar el 15% restante,
 * que es exactamente el daño que la Ley 26.061 busca evitar.
 *
 * Lo que sí hace, y es lo que protege:
 *
 *  1. Verificación técnica automática de lo que el software SÍ detecta bien:
 *     que el archivo sea realmente una imagen (leída de los bytes, no del
 *     nombre), dimensiones, peso, y que no sea una animación.
 *  2. Eliminación de los metadatos EXIF/GPS de la foto. Además de ser
 *     información que la persona no pidió publicar, esos metadatos
 *     revelan las coordenadas de dónde se tomó la imagen.
 *  3. CUARENTENA: toda imagen queda en estado PENDIENTE_REVISION y la
 *     publicación no aparece en el catálogo público hasta que una persona
 *     la aprueba desde el panel de administración. Ése es el control que
 *     protege a las infancias, y es una persona, no un modelo.
 *
 * La interfaz de proveedor (`MODERADORES`) está preparada para sumar un
 * detector de contenido adulto o de rostros si más adelante se contrata
 * ese servicio. Sumarlo no cambia el flujo: la cuarentena sigue siendo
 * obligatoria.
 */

const fs = require('fs');
const path = require('path');

const { sanitizarArchivo } = require('../utils/sanitizarImagen');

// backend/src/services -> backend/uploads (misma carpeta que usa p2pController)
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

const LIMITE_PESO_BYTES = 10 * 1024 * 1024;
const DIMENSION_MINIMA = 100;
const DIMENSION_MAXIMA = 12000;

/**
 * Fórmulas de imagen que aceptamos, por su número mágico (los primeros
 * bytes del archivo). No se confía en el nombre ni en el mimetype que
 * declara el cliente: se pueden falsear los dos.
 */
const FIRMAS = [
  { nombre: 'JPEG', bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { nombre: 'PNG', bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { nombre: 'GIF', bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },
  { nombre: 'WEBP', bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp', prefijo: true },
  { nombre: 'BMP', bytes: [0x42, 0x4d], mime: 'image/bmp' },
  { nombre: 'HEIC', bytes: [0x66, 0x74, 0x79, 0x70], mime: 'image/heic', subcarpeta: 'heic' },
];

function detectarFormato(buffer) {
  for (const firma of FIRMAS) {
    const prefijo = Buffer.from(firma.bytes);
    if (firma.prefijo) {
      // RIFF....WEBP: la etiqueta está en el offset 8
      if (
        buffer.length > 12 &&
        buffer.slice(0, 4).equals(prefijo) &&
        buffer.slice(8, 12).toString('latin1') === 'WEBP'
      ) {
        return { ...firma, etiquetaOffset: 8 };
      }
    } else if (buffer.slice(0, prefijo.length).equals(prefijo)) {
      return { ...firma, etiquetaOffset: 0 };
    }
  }
  return null;
}

/**
 * Lee el ancho y el alto sin decodificar la imagen completa.
 * Sólo funciona para los formatos cuyo encabezado es estándar; para HEIC y
 * WEBP no se intenta y la comprobación dimensional se omite.
 */
function leerDimensiones(buffer, formato) {
  try {
    if (formato.nombre === 'PNG' && buffer.length > 24) {
      // IHDR: ancho y alto en big endian en el offset 16 y 20
      return { ancho: buffer.readUInt32BE(16), alto: buffer.readUInt32BE(20) };
    }

    if (formato.nombre === 'GIF' && buffer.length > 10) {
      return { ancho: buffer.readUInt16LE(6), alto: buffer.readUInt16LE(8) };
    }

    if (formato.nombre === 'BMP' && buffer.length > 26) {
      return { ancho: buffer.readInt32LE(18), alto: Math.abs(buffer.readInt32LE(22)) };
    }

    if (formato.nombre === 'JPEG') {
      // Se recorren los segmentos hasta el SOFn, que trae las dimensiones.
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marcador = buffer[offset + 1];
        // SOF0..SOF15, salvo los marcadores no SOF (C4, C8, CC)
        const esSOF =
          marcador >= 0xc0 && marcador <= 0xcf &&
          marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;
        if (esSOF) {
          return {
            alto: buffer.readUInt16BE(offset + 5),
            ancho: buffer.readUInt16BE(offset + 7),
          };
        }
        if (marcador === 0xda) break; // empieza el dato comprimido
        const longitud = buffer.readUInt16BE(offset + 2);
        if (longitud < 2) break;
        offset += 2 + longitud;
      }
    }
  } catch (_) {
    // Si no se puede leer, se deja pasar: la comprobación dimensional es
    // una ayuda, no la barrera de seguridad principal.
  }
  return null;
}

/** ¿Es una imagen animada? Las animaciones pueden ocultar contenido. */
function esAnimada(buffer, formato) {
  if (formato.nombre === 'GIF') {
    // Varios bloques de extensión de gráfico (0x21 0xF9) => es animada.
    let occurencias = 0;
    for (let i = 0; i < buffer.length - 1; i += 1) {
      if (buffer[i] === 0x21 && buffer[i + 1] === 0xf9) {
        occurencias += 1;
        if (occurencias > 1) return true;
      }
    }
  }
  return false;
}

/**
 * Proveedor técnico local.
 *
 * No juzga el contenido de la imagen: juzga el archivo. Es el único
 * proveedor que corre sin servicios externos, así que la aplicación nunca
 * queda sin control técnico aunque no haya ningún servicio contratado.
 */
const moderadorTecnico = {
  nombre: 'TECNICO_LOCAL',

  revisar({ buffer, nombreArchivo }) {
    const motivos = [];
    let puntaje = 0;

    // 1. ¿Es realmente una imagen?
    const formato = detectarFormato(buffer);
    if (!formato) {
      return {
        aprobado: false,
        puntaje: 100,
        motivoPrincipal: 'El archivo no es una imagen válida.',
        motivos: ['FORMATO_NO_RECONOCIDO'],
        formatoDetectado: null,
        dimensiones: null,
      };
    }

    // 2. Formatos que no se aceptan como foto de publicación.
    if (formato.nombre === 'GIF') {
      motivos.push('FORMATO_ANIMADO');
      puntaje += 40;
    }
    if (formato.nombre === 'SVG') {
      motivos.push('FORMATO_NO_SOPORTADO');
      puntaje += 100;
    }

    // 3. Peso
    if (buffer.length > LIMITE_PESO_BYTES) {
      motivos.push('PESO_EXCEDIDO');
      puntaje += 40;
    }
    if (buffer.length < 1024) {
      // Un archivo de menos de 1 KB difícilmente sea una foto real.
      motivos.push('ARCHIVO_SOSPECHOSO_MUY_PEQUENO');
      puntaje += 30;
    }

    // 4. Dimensiones
    const dimensiones = leerDimensiones(buffer, formato);
    if (dimensiones) {
      if (dimensiones.ancho < DIMENSION_MINIMA || dimensiones.alto < DIMENSION_MINIMA) {
        motivos.push('DIMENSIONES_MUY_PEQUENAS');
        puntaje += 30;
      }
      if (dimensiones.ancho > DIMENSION_MAXIMA || dimensiones.alto > DIMENSION_MAXIMA) {
        motivos.push('DIMENSIONES_EXCESIVAS');
        puntaje += 20;
      }
    }

    // 5. Animación
    if (esAnimada(buffer, formato)) {
      motivos.push('IMAGEN_ANIMADA');
      puntaje += 40;
    }

    // 6. Metadatos: se limpian siempre, pero su presencia se deja anotada
    //    porque es información que la persona no sabe que está subiendo.
    //    El motivo lleva el nombre exacto de lo que se quitó: en JPEG es el
    //    bloque EXIF (que suele traer GPS y modelo de cámara); en PNG son los
    //    chunks de texto. No se mezclan los nombres porque la moderatora
    //    necesita saber qué se eliminó.
    const limpieza = sanitizarArchivo(path.join(UPLOADS_DIR, nombreArchivo));
    if (limpieza.metadatosEliminados) {
      motivos.push(
        limpieza.formato === 'PNG'
          ? 'METADATOS_TEXTO_PNG_ELIMINADOS'
          : 'METADATOS_EXIF_ELIMINADOS'
      );
    }

    const aprobada = motivos.every(
      (m) =>
        m === 'METADATOS_EXIF_ELIMINADOS' || m === 'METADATOS_TEXTO_PNG_ELIMINADOS'
    );

    return {
      aprobado: aprobada,
      // El puntaje nunca habilita la publicación por sí solo: la decisión
      // de publicar la toma siempre una persona.
      puntaje: Math.min(100, puntaje),
      motivoPrincipal: aprobada
        ? null
        : `La imagen fue marcada automáticamente (${motivos.join(', ')}).`,
      motivos,
      formatoDetectado: formato.nombre,
      mimeDetectado: formato.mime,
      dimensiones,
      limpieza,
    };
  },
};

/**
 * Registro de moderadores. Para sumar un detector de contenido adulto o de
 * rostros se implementa la misma interfaz ({ nombre, revisar }) y se agrega
 * acá. La cuarentena obligatoria no se modifica.
 */
const MODERADORES = [moderadorTecnico];

/**
 * Ejecuta todos los moderadores sobre una imagen ya subida.
 * Siempre deja la decisión final en manos de revisión humana.
 */
function evaluarImagen(nombreArchivo) {
  const ruta = path.join(UPLOADS_DIR, nombreArchivo);
  const buffer = fs.readFileSync(ruta);

  const resultados = MODERADORES.map((m) => {
    try {
      return m.revisar({ buffer, nombreArchivo, ruta });
    } catch (err) {
      return {
        aprobado: false,
        puntaje: 50,
        motivoPrincipal: `El filtro ${m.nombre} falló: ${err.message}`,
        motivos: ['ERROR_EN_FILTRO'],
      };
    }
  });

  const rechazadoAutomaticamente = resultados.some((r) => !r.aprobado);
  const puntaje = Math.max(0, ...resultados.map((r) => r.puntaje || 0));
  const motivos = resultados.flatMap((r) => r.motivos || []);
  const principal = resultados.find((r) => !r.aprobado)?.motivoPrincipal || null;

  return {
    // Aunque el filtro técnico lo apruebe, la imagen va a revisión humana.
    requiereRevisionHumana: true,
    filtroEstado: rechazadoAutomaticamente
      ? 'RECHAZADA_TECNICAMENTE'
      : 'APROBADA_TECNICAMENTE',
    publicadoAutomaticamente: false,
    puntaje,
    motivos,
    motivoPrincipal: principal,
    resultados,
    bytes: buffer.length,
  };
}

module.exports = {
  evaluarImagen,
  detectarFormato,
  leerDimensiones,
  esAnimada,
  moderadorTecnico,
  MODERADORES,
  LIMITE_PESO_BYTES,
};
