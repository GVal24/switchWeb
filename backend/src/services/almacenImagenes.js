/**
 * Almacenamiento de imágenes del catálogo.
 *
 * Hay dos carpetas, y la diferencia es de seguridad, no de gusto:
 *
 *   uploads/              imágenes YA APROBADAS. Se sirven por HTTP.
 *   uploads/_cuarena/     imágenes esperando revisión. NO se sirven.
 *
 * ¿Por qué? Una imagen subida puede contener a un menor o contenido que
 * infringe las normas. Si la carpeta de espera fuera pública, cualquiera
 * que adivine o reciba el nombre del archivo podría verla aunque la
 * plataforma todavía no la aprobó, y las normas de la comunidad no se
 * cumplirían de verdad: el control existiría sólo en el papel.
 *
 * El nombre del archivo no cambia al aprobar, así que un solo campo
 * (moderacion_imagenes.nombre_archivo) basta para saber dónde está.
 */

const fs = require('fs');
const path = require('path');

const DIR_UPLOADS = path.resolve(__dirname, '../../uploads');
const DIR_CUARENA = path.join(DIR_UPLOADS, '_cuarena');

/** La carpeta de cuarentena empieza con guion bajo: nunca es un nombre real. */
const PREFIJO_CUARENA = '_cuarena';

/** Se usa siempre basename para que ningún nombre pueda escapar del directorio. */
function nombreSeguro(nombreArchivo) {
  return path.basename(String(nombreArchivo || '').trim());
}

function rutaPublica(nombreArchivo) {
  return path.join(DIR_UPLOADS, nombreSeguro(nombreArchivo));
}

function rutaCuarena(nombreArchivo) {
  return path.join(DIR_CUARENA, nombreSeguro(nombreArchivo));
}

function existe(ruta) {
  try {
    return fs.existsSync(ruta);
  } catch (_) {
    return false;
  }
}

/** Asegura que la carpeta de cuarentena exista (se crea una sola vez). */
function asegurarCuarena() {
  if (!fs.existsSync(DIR_CUARENA)) {
    fs.mkdirSync(DIR_CUARENA, { recursive: true });
  }
}

/**
 * Mueve una imagen desde la carpeta de espera a la de cuarentena.
 * Se llama apenas termina el filtrado técnico: desde ese momento la
 * imagen deja de ser accesible públicamente.
 *
 * @returns {boolean} true si el archivo quedó en cuarentena.
 */
function enviarACuarena(nombreArchivo) {
  try {
    asegurarCuarena();
    const origen = rutaPublica(nombreArchivo);
    const destino = rutaCuarena(nombreArchivo);
    if (existe(origen)) {
      fs.renameSync(origen, destino);
      return true;
    }
    return existe(destino);
  } catch (e) {
    console.error('[almacen] No se pudo aislar la imagen en cuarentena:', e.message);
    return false;
  }
}

/**
 * Al aprobar, la imagen pasa a la carpeta pública y queda servible.
 * @returns {boolean} true si el archivo quedó accesible.
 */
function publicarDesdeCuarena(nombreArchivo) {
  try {
    const origen = rutaCuarena(nombreArchivo);
    const destino = rutaPublica(nombreArchivo);
    if (existe(origen)) {
      fs.renameSync(origen, destino);
      return true;
    }
    return existe(destino);
  } catch (e) {
    console.error('[almacen] No se pudo publicar la imagen:', e.message);
    return false;
  }
}

/** Borra el archivo esté donde esté. Se usa al rechazar. */
function eliminarArchivo(nombreArchivo) {
  let eliminado = false;
  for (const ruta of [rutaCuarena(nombreArchivo), rutaPublica(nombreArchivo)]) {
    try {
      if (existe(ruta)) {
        fs.unlinkSync(ruta);
        eliminado = true;
      }
    } catch (_) {
      // Un archivo que no se puede borrar no debe-reverse la decisión de
      // moderación: la publicación igual queda fuera del catálogo.
    }
  }
  return eliminado;
}

/** ¿En qué carpeta está ahora mismo? 'publica' | 'cuarena' | null */
function ubicacion(nombreArchivo) {
  if (existe(rutaCuarena(nombreArchivo))) return 'cuarena';
  if (existe(rutaPublica(nombreArchivo))) return 'publica';
  return null;
}

/** Ruta absoluta según la ubicación real del archivo. */
function rutaAbsoluta(nombreArchivo) {
  const donde = ubicacion(nombreArchivo);
  if (donde === 'cuarena') return rutaCuarena(nombreArchivo);
  return rutaPublica(nombreArchivo);
}

/**
 * Traduce un nombre de archivo a la URL que corresponde según dónde esté.
 * Así, una publicación pendiente nunca guarda una URL que miente.
 */
function urlPara(nombreArchivo, base) {
  const donde = ubicacion(nombreArchivo);
  const carpeta = donde === 'cuarena' ? `${PREFIJO_CUARENA}/` : '';
  return `${String(base).replace(/\/+$/, '')}/${carpeta}${nombreSeguro(nombreArchivo)}`;
}

module.exports = {
  DIR_UPLOADS,
  DIR_CUARENA,
  PREFIJO_CUARENA,
  rutaPublica,
  rutaCuarena,
  rutaAbsoluta,
  ubicacion,
  existe,
  asegurarCuarena,
  enviarACuarena,
  publicarDesdeCuarena,
  eliminarArchivo,
  urlPara,
};
