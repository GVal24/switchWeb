/**
 * Gamificación de Switch: convierte las estadísticas reales del usuario
 * en puntos de impacto comunitario, niveles e insignias.
 *
 * Los puntos NO se almacenan: se calculan siempre a partir de los datos,
 * así es imposible inflarlos y nunca quedan desincronizados.
 *
 * Fórmula:
 *   - Trueque completado ............ +10 pts
 *   - Voluntariado (nexo social) .... +15 pts
 *   - Bonus reputación .............. hasta +10 pts (promedio de reseñas > 3)
 */

const NIVELES = [
  { numero: 1, nombre: 'Semilla del Barrio', puntos: 0 },
  { numero: 2, nombre: 'Brote Activo', puntos: 40 },
  { numero: 3, nombre: 'Vecino Confiable', puntos: 100 },
  { numero: 4, nombre: 'Motor Solidario', puntos: 200 },
  { numero: 5, nombre: 'Pilar de la Comunidad', puntos: 350 }
];

const INSIGNIAS = [
  {
    codigo: 'PRIMER_TRUEQUE',
    nombre: 'Primer Intercambio',
    descripcion: 'Completaste tu primer trueque',
    condicion: (s) => s.truequesCompletados >= 1
  },
  {
    codigo: 'ALMA_TRUEQUE',
    nombre: 'Alma de Trueque',
    descripcion: 'Completaste 5 o más trueques',
    condicion: (s) => s.truequesCompletados >= 5
  },
  {
    codigo: 'VOLUNTARIO',
    nombre: 'Voluntario',
    descripcion: 'Colaboraste por primera vez en una institución',
    condicion: (s) => s.voluntariados >= 1
  },
  {
    codigo: 'MANOS_SOLIDARIAS',
    nombre: 'Manos Solidarias',
    descripcion: 'Te presentaste a ayudar en 3 o más ocasiones',
    condicion: (s) => s.voluntariados >= 3
  },
  {
    codigo: 'CORAZON_ORO',
    nombre: 'Corazón de Oro',
    descripcion: 'Reputación de 4.5 o más con al menos 3 reseñas',
    condicion: (s) => s.calificacionPromedio >= 4.5 && s.cantidadResenas >= 3
  },
  {
    codigo: 'VOZ_CONFIABLE',
    nombre: 'Voz Confiable',
    descripcion: 'Recibiste 10 o más reseñas de la comunidad',
    condicion: (s) => s.cantidadResenas >= 10
  },
  {
    codigo: 'PIONERO',
    nombre: 'Pionero de Switch',
    descripcion: 'Fuiste de los primeros vecinos en sumarse a la comunidad',
    secreta: true,
    condicion: (s) => s.esPionero
  },
  {
    codigo: 'MADRUGADOR',
    nombre: 'Madrugador Solidario',
    descripcion: 'Validaste tu presencia en una institución antes de las 8 AM',
    secreta: true,
    condicion: (s) => s.voluntariadosMadrugada >= 1
  }
];

function calcularBonus(estadisticas) {
  const promedio = Number(estadisticas.calificacionPromedio) || 0;
  if (promedio <= 3) return 0;
  return Math.min(10, Math.round((promedio - 3) * 5));
}

/**
 * @param {Object} estadisticas - { truequesCompletados, voluntariados, calificacionPromedio, cantidadResenas }
 * @returns Impacto completo: puntos, nivel actual, siguiente nivel, progreso e insignias.
 */
function calcularImpacto(estadisticas) {
  const stats = {
    truequesCompletados: Number(estadisticas.truequesCompletados) || 0,
    voluntariados: Number(estadisticas.voluntariados) || 0,
    calificacionPromedio: Number(estadisticas.calificacionPromedio) || 0,
    cantidadResenas: Number(estadisticas.cantidadResenas) || 0,
    esPionero: Boolean(estadisticas.esPionero),
    voluntariadosMadrugada: Number(estadisticas.voluntariadosMadrugada) || 0
  };

  const bonus = calcularBonus(stats);
  const puntos =
    stats.truequesCompletados * 10 +
    stats.voluntariados * 15 +
    bonus;

  let indiceNivel = 0;
  for (let i = 0; i < NIVELES.length; i++) {
    if (puntos >= NIVELES[i].puntos) indiceNivel = i;
  }

  const nivel = NIVELES[indiceNivel];
  const nivelSiguiente = NIVELES[indiceNivel + 1] || null;
  const progreso = nivelSiguiente
    ? (puntos - nivel.puntos) / (nivelSiguiente.puntos - nivel.puntos)
    : 1;

  return {
    puntos,
    detalle: {
      trueques: stats.truequesCompletados * 10,
      voluntariados: stats.voluntariados * 15,
      reputacion: bonus
    },
    nivel: { numero: nivel.numero, nombre: nivel.nombre },
    nivelSiguiente: nivelSiguiente
      ? { numero: nivelSiguiente.numero, nombre: nivelSiguiente.nombre, puntos: nivelSiguiente.puntos }
      : null,
    puntosParaSiguiente: nivelSiguiente ? Math.max(0, nivelSiguiente.puntos - puntos) : 0,
    progreso: Math.min(1, Math.max(0, progreso)),
    insignias: INSIGNIAS.map((i) => {
      const desbloqueada = Boolean(i.condicion(stats));
      // Las insignias secretas no revelan su nombre ni descripción hasta desbloquearse
      return {
        codigo: i.codigo,
        nombre: !desbloqueada && i.secreta ? '???' : i.nombre,
        descripcion: !desbloqueada && i.secreta ? 'Insignia secreta: descubrí cómo desbloquearla' : i.descripcion,
        secreta: Boolean(i.secreta),
        desbloqueada
      };
    })
  };
}

module.exports = { calcularImpacto, NIVELES, INSIGNIAS };
