/* Catálogo general P2P: búsqueda, filtros por esfuerzo y tipo, y grilla de
   publicaciones activas. */

import { Store } from '../store.js';
import { API } from '../api.js';
import {
  icon,
  esc,
  avatar,
  toast,
  anunciar,
  spinner,
  vacio,
  errorEstado,
  chipEsfuerzo,
  esfuerzo,
  imagenPublicacion,
  idPublicacion,
  nombreOferente,
  fecha,
  debounce,
} from '../ui.js';
import { navegar } from '../router.js';

const NIVELES = [
  { valor: 'TODOS', texto: 'Todo' },
  { valor: 'SIMPLE', texto: 'Simple' },
  { valor: 'MEDIO', texto: 'Medio' },
  { valor: 'ALTO', texto: 'Alto' },
];

const TIPOS = [
  { valor: 'TODOS', texto: 'Todo' },
  { valor: 'OBJETO', texto: 'Objetos' },
  { valor: 'SERVICIO', texto: 'Servicios' },
];

export async function render(contenedor) {
  const filtros = { nivel: 'TODOS', tipo: 'TODOS', busqueda: '' };
  let carga = 0;

  const nombre = Store.usuario?.nombre || '';
  const saludo = Store.sesionActiva ? `Hola, ${nombre}` : 'Catálogo abierto a la comunidad';

  contenedor.innerHTML = `
    <section class="pantalla pantalla-catalogo">
      <header class="cat-hero">
        <p class="cat-saludo">${esc(saludo)}</p>
        <h1 class="cat-titulo">Lo que se mueve en el barrio</h1>
        <p class="cat-bajada">Trueques sin dinero: ofrecé lo que tenés y pedí lo que necesitás. Cada intercambio suma.</p>
        <div class="cat-metricas" id="cat-metricas">
          <span class="chip">${icon('gift')} Intercambios P2P</span>
          <span class="chip chip-verde">${icon('users')} Red de vecinos</span>
        </div>
        <div class="buscador cat-buscador" role="search">
          ${icon('search')}
          <input id="cat-buscar" type="search" placeholder="Buscar por título o descripción…" aria-label="Buscar publicaciones" autocomplete="off">
          <button type="button" class="icon-btn" id="cat-limpiar-busqueda" aria-label="Borrar búsqueda" hidden>${icon('x')}</button>
        </div>
      </header>

      <div class="mt-1">
        <p class="campo-etiqueta" style="margin-bottom:0.3rem">Esfuerzo</p>
        <div class="chips-fila" role="group" aria-label="Filtrar por esfuerzo">
          ${NIVELES.map(
            (n) =>
              `<button type="button" class="chip-opcion" data-nivel="${n.valor}" aria-pressed="${
                n.valor === 'TODOS' ? 'true' : 'false'
              }">${n.valor === 'TODOS' ? icon('sliders') : ''}${esc(n.texto)}</button>`
          ).join('')}
        </div>
      </div>

      <div>
        <p class="campo-etiqueta" style="margin-bottom:0.3rem">Tipo</p>
        <div class="chips-fila" role="group" aria-label="Filtrar por tipo">
          ${TIPOS.map(
            (t) =>
              `<button type="button" class="chip-opcion chip-azul" data-tipo="${t.valor}" aria-pressed="${
                t.valor === 'TODOS' ? 'true' : 'false'
              }">${esc(t.texto)}</button>`
          ).join('')}
        </div>
      </div>

      <div id="cat-resultados" aria-live="polite" aria-busy="true">${spinner('Buscando publicaciones…')}</div>

      ${
        Store.sesionActiva
          ? `<div class="fab-contenedor">
              <button type="button" class="fab" id="cat-publicar" ${
                Store.suspendido ? 'disabled title="Tu cuenta está suspendida"' : ''
              }>${icon('plus')} Publicar</button>
            </div>`
          : `<div class="card mt-1" style="text-align:center">
              <p class="negrita">¿Querés sumar lo tuyo?</p>
              <p class="texto-suave texto-chico" style="margin:0.25rem 0 0.7rem">Creá tu cuenta gratis para publicar y proponer trueques.</p>
              <button type="button" class="btn btn-primario btn-block" data-crear-cuenta>Crear mi cuenta</button>
              <button type="button" class="btn btn-fantasma btn-block mt-1" data-ingresar>Ya tengo cuenta</button>
            </div>`
      }
    </section>
  `;

  const resultados = contenedor.querySelector('#cat-resultados');
  const buscador = contenedor.querySelector('#cat-buscar');
  const limpiarBusqueda = contenedor.querySelector('#cat-limpiar-busqueda');

  contenedor.querySelectorAll('[data-nivel]').forEach((b) =>
    b.addEventListener('click', () => {
      filtros.nivel = b.dataset.nivel;
      contenedor.querySelectorAll('[data-nivel]').forEach((x) =>
        x.setAttribute('aria-pressed', String(x.dataset.nivel === filtros.nivel))
      );
      cargar();
    })
  );

  contenedor.querySelectorAll('[data-tipo]').forEach((b) =>
    b.addEventListener('click', () => {
      filtros.tipo = b.dataset.tipo;
      contenedor.querySelectorAll('[data-tipo]').forEach((x) =>
        x.setAttribute('aria-pressed', String(x.dataset.tipo === filtros.tipo))
      );
      cargar();
    })
  );

  const buscarDemorado = debounce(() => {
    filtros.busqueda = buscador.value;
    limpiarBusqueda.hidden = !buscador.value;
    cargar();
  }, 380);

  buscador.addEventListener('input', buscarDemorado);
  buscador.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      filtros.busqueda = buscador.value;
      cargar();
    }
  });
  limpiarBusqueda.addEventListener('click', () => {
    buscador.value = '';
    filtros.busqueda = '';
    limpiarBusqueda.hidden = true;
    buscador.focus();
    cargar();
  });

  contenedor.querySelector('[data-crear-cuenta]')?.addEventListener('click', () => navegar('/registro'));
  contenedor.querySelector('[data-ingresar]')?.addEventListener('click', () =>
    navegar('/login?volver=/catalogo')
  );
  const botonPublicar = contenedor.querySelector('#cat-publicar');
  botonPublicar?.addEventListener('click', () => {
    if (Store.suspendido) {
      toast('Tu cuenta está suspendida: no podés publicar por ahora.', 'aviso');
      return;
    }
    navegar('/publicar');
  });

  async function cargar() {
    const miCarga = ++carga;
    resultados.setAttribute('aria-busy', 'true');
    resultados.innerHTML = spinner('Buscando publicaciones…');
    try {
      const publicaciones = await API.catalogo({
        nivelEsfuerzo: filtros.nivel,
        tipoItem: filtros.tipo,
        busqueda: filtros.busqueda,
      });
      if (miCarga !== carga) return;
      pintar(publicaciones);
    } catch (e) {
      if (miCarga !== carga) return;
      resultados.setAttribute('aria-busy', 'false');
      resultados.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar el catálogo. Revisá tu conexión.',
        '<button class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      resultados.querySelector('[data-reintentar]')?.addEventListener('click', cargar);
    }
  }

  function pintar(publicaciones) {
    resultados.setAttribute('aria-busy', 'false');
    actualizarMetricas(publicaciones.length);

    if (!publicaciones.length) {
      const hayFiltros =
        filtros.busqueda.trim() || filtros.nivel !== 'TODOS' || filtros.tipo !== 'TODOS';
      resultados.innerHTML = vacio(
        'search',
        hayFiltros ? 'No encontramos coincidencias' : 'El catálogo está tomando aire',
        hayFiltros
          ? 'Probá con otras palabras o quitá los filtros.'
          : 'Todavía no hay publicaciones activas. Si tenés algo para ofrecer, ¡animate a publicar!',
        hayFiltros
          ? '<button type="button" class="btn btn-secundario" data-quitar-filtros>Quitar filtros</button>'
          : Store.sesionActiva
          ? '<button type="button" class="btn btn-primario" data-publicar-vacio>Publicar algo</button>'
          : '<button type="button" class="btn btn-primario" data-crear-vacio>Crear mi cuenta</button>'
      );
      resultados.querySelector('[data-quitar-filtros]')?.addEventListener('click', () => {
        filtros.nivel = 'TODOS';
        filtros.tipo = 'TODOS';
        filtros.busqueda = '';
        buscador.value = '';
        limpiarBusqueda.hidden = true;
        contenedor.querySelectorAll('[data-nivel]').forEach((x) =>
          x.setAttribute('aria-pressed', String(x.dataset.nivel === 'TODOS'))
        );
        contenedor.querySelectorAll('[data-tipo]').forEach((x) =>
          x.setAttribute('aria-pressed', String(x.dataset.tipo === 'TODOS'))
        );
        cargar();
      });
      resultados.querySelector('[data-publicar-vacio]')?.addEventListener('click', () => navegar('/publicar'));
      resultados.querySelector('[data-crear-vacio]')?.addEventListener('click', () => navegar('/registro'));
      anunciar('La búsqueda no devolvió publicaciones.');
      return;
    }

    resultados.innerHTML = `
      <div class="cat-grid">
        ${publicaciones.map(tarjeta).join('')}
      </div>
      <p class="cat-info">${icon('info')} ${publicaciones.length} ${
      publicaciones.length === 1 ? 'publicación activa' : 'publicaciones activas'
    }. Tocá una para ver el detalle.</p>
    `;
    anunciar(`Se muestran ${publicaciones.length} publicaciones.`);
  }

  function actualizarMetricas(cantidad) {
    const el = contenedor.querySelector('#cat-metricas');
    if (!el) return;
    el.innerHTML = `
      <span class="chip chip-verde">${icon('gift')} ${cantidad} ${
      cantidad === 1 ? 'publicación' : 'publicaciones'
    }</span>
      <span class="chip">${icon('swap')} Trueques sin dinero</span>
    `;
  }

  function tarjeta(pub) {
    const id = idPublicacion(pub);
    const nivel = esfuerzo(pub.nivel_esfuerzo);
    const tipo = String(pub.tipo_item || 'OBJETO').toUpperCase();
    const calif = Number(pub.oferente_calificacion);
    const resenas = Number(pub.oferente_resenas);
    return `
      <a class="pub-card" href="#/detalle/${encodeURIComponent(id)}" aria-label="${esc(
      pub.titulo || 'Publicación'
    )}, esfuerzo ${esc(nivel.etiqueta)}">
        ${imagenPublicacion(pub, 'pub-imagen', 148)}
        <div class="pub-cuerpo">
          <span class="pub-titulo">${esc(pub.titulo || 'Publicación')}</span>
          <span class="pub-desc">${esc(pub.descripcion || 'Sin descripción.')}</span>
          <div class="fila" style="gap:0.3rem;flex-wrap:wrap;margin-top:0.1rem">
            ${chipEsfuerzo(pub.nivel_esfuerzo)}
            <span class="chip">${icon(tipo === 'SERVICIO' ? 'sparkles' : 'gift')} ${
      tipo === 'SERVICIO' ? 'Servicio' : 'Objeto'
    }</span>
          </div>
          <div class="pub-pie">
            <button type="button" class="pub-dueno" data-ver-usuario="${esc((pub.usuario_id || pub.oferente_id || ''))}" style="border:0;background:none;padding:0;text-align:left;cursor:pointer;">
              ${avatar(nombreOferente(pub))}
              <span>${esc(nombreOferente(pub))}</span>
            </button>
            ${
              Number.isFinite(calif) && resenas > 0
                ? `<span class="chip" title="${esc(String(resenas))} reseñas">${icon('star')} ${calif.toFixed(1)}</span>`
                : ''
            }
          </div>
          ${pub.creado_en ? `<span class="texto-suave texto-chico">${esc(fecha(pub.creado_en))}</span>` : ''}
        </div>
      </a>
    `;
  }

  await cargar();
}
