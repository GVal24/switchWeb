/**
 * Clasificador automático de Nivel de Esfuerzo.
 *
 * Analiza título + descripción de una publicación y determina si el
 * compromiso que implica es SIMPLE, MEDIO o ALTO. Es la única fuente
 * de verdad: el cliente no envía el nivel, solo lo previsualiza.
 *
 * Reglas (en orden):
 *   1. Si aparece una palabra de esfuerzo ALTO ............ -> ALTO
 *   2. Si aparece una palabra de esfuerzo MEDIO ........... -> MEDIO
 *   3. Base según tipo: SERVICIO -> MEDIO | OBJETO -> SIMPLE
 */

function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const PALABRAS_ALTO = [
  // Enseñanza y talleres
  'clase', 'curso', 'taller', 'capacitacion', 'tutoria', 'refuerzo',
  // Oficios y reparaciones
  'reparacion', 'reparar', 'arreglar', 'formatear', 'formateo',
  'plomeria', 'plomero', 'electricidad', 'electricista', 'electrico',
  'gasista', 'gas', 'albanil', 'construccion', 'construir', 'soldadura',
  'soldar', 'herreria', 'carpinteria', 'techista', 'destapar', 'desague',
  'pintura', 'pintar', 'instalacion', 'instalar', 'aire acondicionado',
  'mecanico', 'jardineria', 'jardinero', 'poda',
  // Traslados pesados
  'mudanza', 'flete', 'traslado de heladera', 'traslado de muebles',
  'traslado de lavarropas',
  // Cuidados y salud
  'enfermeria', 'enfermero', 'cuidado de adulto', 'adultos mayores',
  'cuidado de bebe', 'acompanante terapeutico', 'kinesiologia',
  'kinesiologo', 'terapia',
  // Profesionales
  'traduccion', 'ingles', 'programacion', 'pagina web', 'sitio web',
  'gestoria', 'abogado', 'contador', 'masaje',
  'peluqueria', 'corte de pelo', 'entrenador', 'entrenamiento personal'
];

const PALABRAS_MEDIO = [
  // Cocina y comida
  'cocina', 'cocinar', 'cocinero', 'comida casera', 'torta', 'tarta',
  'panificado', 'panaderia', 'vianda',
  // Traslados y mandados
  'traslado', 'llevar a', 'delivery', 'mandado', 'mandados', 'recados',
  'reparto', 'transporte',
  // Cuidados y apoyo
  'cuidado de ninos', 'apoyo escolar', 'tareas', 'ninos', 'paseador',
  'pasear', 'perro', 'gato', 'mascota',
  // Hogar y limpieza
  'limpieza', 'limpiar', 'planchado', 'lavado',
  // Manualidades y estética
  'costura', 'coser', 'tejer', 'tejido', 'manualidad', 'fotografia',
  'maquillaje', 'manicuria',
  // Objetos grandes (el esfuerzo está en el traslado)
  'mueble', 'silla', 'mesa', 'bicicleta', 'herramienta', 'heladera',
  'lavarropas', 'ropero', 'placard', 'colchon', 'somier'
];

/**
 * @param {string} titulo
 * @param {string} descripcion
 * @param {string} tipoItem - 'OBJETO' | 'SERVICIO'
 * @returns {'SIMPLE'|'MEDIO'|'ALTO'}
 */
function clasificarEsfuerzo(titulo, descripcion, tipoItem) {
  const texto = normalizar(`${titulo} ${descripcion}`);

  if (PALABRAS_ALTO.some((p) => texto.includes(p))) return 'ALTO';
  if (PALABRAS_MEDIO.some((p) => texto.includes(p))) return 'MEDIO';

  return normalizar(tipoItem) === 'servicio' ? 'MEDIO' : 'SIMPLE';
}

module.exports = { clasificarEsfuerzo };
