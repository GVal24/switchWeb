/* Router por hash. Cada ruta se registra con su sección de navegación y
   sus guardas; las pantallas se cargan bajo demanda. */

import { Store } from './store.js';
import { spinner, errorEstado, anunciar, cerrarTodosLosDialogos } from './ui.js';

const rutas = [];
const RUTA_INICIAL = '/voluntariado';

let opciones = {
  contenedor: null,
  alNavegar: null,
  pedirAdmin: async () => false,
  alError: null,
};
let actual = null;
let anterior = null;
let limpieza = null;
let tokenRender = 0;

export function definirRuta(patron, cargador, meta = {}) {
  rutas.push({
    patron,
    segmentos: patron.split('/').filter(Boolean),
    cargador,
    seccion: meta.seccion || null,
    titulo: meta.titulo || 'Switch',
    requiereSesion: !!meta.requiereSesion,
    requiereAdmin: !!meta.requiereAdmin,
    volver: meta.volver !== false,
  });
}

export function rutaActual() {
  return actual;
}

export function navegar(ruta, { reemplazar = false } = {}) {
  const destino = ruta.startsWith('#') ? ruta : '#' + (ruta.startsWith('/') ? ruta : '/' + ruta);
  if (reemplazar) {
    const url = location.pathname + location.search + destino;
    history.replaceState(null, '', url);
    manejarCambio();
  } else if (location.hash === destino) {
    manejarCambio();
  } else {
    location.hash = destino;
  }
}

export function volver(origen = '/voluntariado') {
  if (anterior && anterior !== actual?.hash) {
    navegar(anterior, { reemplazar: true });
  } else {
    navegar(origen, { reemplazar: true });
  }
}

function normalizar(hash) {
  let crudo = (hash || '').replace(/^#/, '');
  if (!crudo) return RUTA_INICIAL;
  if (!crudo.startsWith('/')) crudo = '/' + crudo;
  return crudo;
}

export function analizar(hash = location.hash) {
  const crudo = normalizar(hash);
  const [camino, cadenaQuery = ''] = crudo.split('?');
  const segmentos = camino.split('/').filter(Boolean);
  const query = new URLSearchParams(cadenaQuery);

  for (const ruta of rutas) {
    if (ruta.segmentos.length !== segmentos.length) continue;
    const params = {};
    let coincide = true;
    for (let i = 0; i < ruta.segmentos.length; i++) {
      const parte = ruta.segmentos[i];
      if (parte.startsWith(':')) {
        params[parte.slice(1)] = decodeURIComponent(segmentos[i]);
      } else if (parte !== segmentos[i]) {
        coincide = false;
        break;
      }
    }
    if (coincide) return { ruta, params, query, camino, hash: '#' + crudo };
  }
  return { ruta: null, params: {}, query, camino, hash: '#' + crudo };
}

async function manejarCambio() {
  const info = analizar();
  if (!info.ruta) {
    navegar(RUTA_INICIAL, { reemplazar: true });
    return;
  }

  if (info.ruta.requiereSesion && !Store.sesionActiva) {
    const volverA = encodeURIComponent(info.hash);
    navegar(`/login?volver=${volverA}`, { reemplazar: true });
    return;
  }

  if (info.ruta.requiereAdmin && !Store.esAdmin) {
    const concedido = await opciones.pedirAdmin();
    if (!concedido) {
      navegar('/perfil', { reemplazar: true });
      return;
    }
  }

  await renderizar(info);
}

async function renderizar(info) {
  const miToken = ++tokenRender;
  cerrarTodosLosDialogos();
  if (typeof limpieza === 'function') {
    try { limpieza(); } catch (e) {}
    limpieza = null;
  }

  anterior = actual?.hash || null;
  actual = {
    ...info,
    seccion: info.ruta.seccion,
    titulo: info.ruta.titulo,
    volver: info.ruta.volver,
  };

  if (opciones.alNavegar) opciones.alNavegar(actual);

  const contenedor = opciones.contenedor;
  contenedor.setAttribute('aria-busy', 'true');
  contenedor.innerHTML = `<div class="pantalla">${spinner('Cargando…')}</div>`;
  contenedor.scrollTop = 0;

  try {
    const modulo = await info.ruta.cargador();
    if (miToken !== tokenRender) return;
    if (typeof modulo.render !== 'function') {
      throw new Error('La pantalla no exporta render().');
    }
    contenedor.innerHTML = '';
    const resultado = await modulo.render(contenedor, {
      params: info.params,
      query: info.query,
      ruta: actual,
      navegar,
      volver,
    });
    if (miToken !== tokenRender) {
      if (typeof resultado === 'function') resultado();
      return;
    }
    limpieza = typeof resultado === 'function' ? resultado : null;
    anunciar(`Pantalla ${actual.titulo} cargada.`);
  } catch (e) {
    if (miToken !== tokenRender) return;
    console.error(e);
    contenedor.innerHTML = `<div class="pantalla">
      ${errorEstado(
        e && e.name === 'ApiError'
          ? e.message
          : 'No pudimos cargar esta pantalla. Revisá tu conexión e intentá de nuevo.',
        '<button class="btn btn-secundario" data-reintentar>Reintentar</button>'
      )}
    </div>`;
    const boton = contenedor.querySelector('[data-reintentar]');
    if (boton) boton.addEventListener('click', () => renderizar(info));
    if (opciones.alError) opciones.alError(e);
  } finally {
    if (miToken === tokenRender) contenedor.removeAttribute('aria-busy');
  }
}

export function iniciarRouter(nuevasOpciones = {}) {
  opciones = { ...opciones, ...nuevasOpciones };
  window.addEventListener('hashchange', manejarCambio);
  manejarCambio();
}

export function refrescarRuta() {
  manejarCambio();
}

export function rutaSeccion() {
  return actual?.seccion || null;
}
