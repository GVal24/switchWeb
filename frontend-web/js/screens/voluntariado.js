/* Voluntariado: instituciones comunitarias, sus necesidades y el acceso a la
   validación de presencia por QR. */

import { Store } from '../store.js';
import { API } from '../api.js';
import {
  icon,
  esc,
  spinner,
  vacio,
  errorEstado,
  debounce,
} from '../ui.js';
import { navegar } from '../router.js';

export async function render(contenedor) {
  const cuposCache = new Map();
  const abiertas = new Set();
  let instituciones = [];
  let filtro = '';
  let carga = 0;

  contenedor.innerHTML = `
    <section class="pantalla pantalla-voluntariado">
      <header class="vol-hero">
        <p class="cat-saludo">Red de reciprocidad</p>
        <h1>Voluntariado que abre puertas</h1>
        <p>Colaborá con una institución del barrio y activá tu Nexo Social para intercambiar en el catálogo. Cada visita suma y se registra con un QR en el lugar.</p>
        <div class="fila" style="gap:0.4rem;flex-wrap:wrap;margin-top:0.7rem">
          <button type="button" class="btn btn-primario btn-sm" data-escanear>${icon('qr')} Escanear QR</button>
          <button type="button" class="btn btn-secundario btn-sm" data-sumar>${icon('plus')} Sumar institución</button>
        </div>
      </header>

      ${
        Store.suspendido
          ? `<div class="banner banner-aviso mt-1">${icon('alert')}<div><strong>Cuenta suspendida</strong><p>Podés ver las instituciones, pero no validar presencia hasta que se resuelva.</p></div></div>`
          : ''
      }

      <div class="seccion-cabecera mt-2">
        <h2>Instituciones cerca</h2>
      </div>

      <div class="buscador" role="search" style="margin-bottom:0.7rem">
        ${icon('search')}
        <input id="vol-buscar" type="search" placeholder="Buscar por nombre, tipo o dirección…" aria-label="Buscar instituciones" autocomplete="off">
      </div>

      <div id="vol-lista" aria-live="polite" aria-busy="true">${spinner('Cargando instituciones…')}</div>

      <button type="button" class="org-registro mt-2" data-sumar>
        ${icon('town')}
        <div class="crece">
          <strong>¿Representás una institución?</strong>
          <span>Sumala a Switch y publicá tus necesidades de voluntariado.</span>
        </div>
        ${icon('chevron')}
      </button>

      <p class="campo-ayuda" style="text-align:center;margin-top:0.8rem">El código QR te lo entrega la institución cuando llegás. Valida que estás en el lugar y activa tu Nexo Social.</p>
    </section>
  `;

  const lista = contenedor.querySelector('#vol-lista');
  const buscador = contenedor.querySelector('#vol-buscar');

  contenedor.querySelectorAll('[data-escanear]').forEach((b) =>
    b.addEventListener('click', () => irA('/qr'))
  );
  contenedor.querySelectorAll('[data-sumar]').forEach((b) =>
    b.addEventListener('click', () => navegar('/instituciones/registro'))
  );

  function irA(ruta) {
    if (!Store.sesionActiva) {
      navegar(`/login?volver=${encodeURIComponent(ruta)}`);
      return;
    }
    navegar(ruta);
  }

  const filtrar = debounce(() => {
    filtro = buscador.value.trim().toLowerCase();
    pintar();
  }, 220);
  buscador.addEventListener('input', filtrar);

  async function cargar() {
    const miCarga = ++carga;
    lista.setAttribute('aria-busy', 'true');
    lista.innerHTML = spinner('Cargando instituciones…');
    try {
      instituciones = await API.instituciones();
      if (miCarga !== carga) return;
      pintar();
    } catch (e) {
      if (miCarga !== carga) return;
      lista.setAttribute('aria-busy', 'false');
      lista.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar las instituciones.',
        '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      lista.querySelector('[data-reintentar]')?.addEventListener('click', cargar);
    }
  }

  function pintar() {
    lista.setAttribute('aria-busy', 'false');
    const visibles = instituciones.filter((i) => {
      if (!filtro) return true;
      return [i.nombre, i.tipo, i.direccion].some((v) =>
        String(v || '').toLowerCase().includes(filtro)
      );
    });

    if (!visibles.length) {
      lista.innerHTML = vacio(
        'town',
        filtro ? 'No encontramos esa institución' : 'Todavía no hay instituciones',
        filtro
          ? 'Probá con otro nombre, tipo o dirección.'
          : 'Las instituciones comunitarias van a aparecer acá a medida que se sumen. Si representás una, podés registrarla.',
        filtro
          ? '<button type="button" class="btn btn-secundario" data-limpiar>Limpiar búsqueda</button>'
          : '<button type="button" class="btn btn-primario" data-registrar>Sumar mi institución</button>'
      );
      lista.querySelector('[data-limpiar]')?.addEventListener('click', () => {
        buscador.value = '';
        filtro = '';
        pintar();
      });
      lista.querySelector('[data-registrar]')?.addEventListener('click', () =>
        navegar('/instituciones/registro')
      );
      return;
    }

    lista.innerHTML = visibles.map(tarjeta).join('');

    lista.querySelectorAll('[data-toggle]').forEach((b) =>
      b.addEventListener('click', () => alternar(b.dataset.toggle))
    );
    lista.querySelectorAll('[data-escanear-inst]').forEach((b) =>
      b.addEventListener('click', () =>
        irA(`/qr?institucion=${encodeURIComponent(b.dataset.escanearInst)}`)
      )
    );
    lista.querySelectorAll('[data-cupo]').forEach((b) =>
      b.addEventListener('click', () =>
        irA(
          `/qr?institucion=${encodeURIComponent(b.dataset.institucion)}&cupo=${encodeURIComponent(
            b.dataset.cupo
          )}&titulo=${encodeURIComponent(b.dataset.titulo || '')}`
        )
      )
    );

    abiertas.forEach((id) => {
      if (visibles.some((i) => String(i.id) === String(id))) {
        cargarCupos(id);
      }
    });
  }

  function tarjeta(inst) {
    const id = String(inst.id);
    const abierta = abiertas.has(id);
    return `
      <article class="inst-card" data-inst="${esc(id)}">
        <div class="inst-cab">
          <span class="inst-icono">${icon('town')}</span>
          <div class="crece">
            <h3 class="inst-nombre">${esc(inst.nombre || 'Institución')}</h3>
            <div class="inst-meta">
              <span>${esc(inst.tipo || 'Comunitaria')}</span>
              ${inst.direccion ? `· ${icon('pin')} ${esc(inst.direccion)}` : ''}
            </div>
          </div>
        </div>
        <div class="inst-pie">
          <button type="button" class="btn btn-secundario btn-sm" data-toggle="${esc(id)}" aria-expanded="${
      abierta ? 'true' : 'false'
    }">${icon(abierta ? 'minus' : 'plus')} ${
      abierta ? 'Ocultar necesidades' : 'Ver necesidades'
    }</button>
          <button type="button" class="btn btn-primario btn-sm" data-escanear-inst="${esc(id)}">${icon(
      'qr'
    )} Validar presencia</button>
        </div>
        <div class="inst-necesidades" data-zona="${esc(id)}" ${abierta ? '' : 'hidden'}>
          ${abierta ? '<div class="estado-carga"><span class="spinner spinner-chico" aria-hidden="true"></span><span>Cargando necesidades…</span></div>' : ''}
        </div>
      </article>
    `;
  }

  function alternar(id) {
    id = String(id);
    const zona = lista.querySelector(`[data-zona="${CSS.escape(id)}"]`);
    const boton = lista.querySelector(`[data-toggle="${CSS.escape(id)}"]`);
    if (!zona || !boton) return;

    if (abiertas.has(id)) {
      abiertas.delete(id);
      zona.hidden = true;
      zona.innerHTML = '';
      boton.setAttribute('aria-expanded', 'false');
      boton.innerHTML = `${icon('plus')} Ver necesidades`;
      return;
    }

    abiertas.add(id);
    zona.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    boton.innerHTML = `${icon('minus')} Ocultar necesidades`;
    cargarCupos(id);
  }

  async function cargarCupos(id) {
    id = String(id);
    const zona = lista.querySelector(`[data-zona="${CSS.escape(id)}"]`);
    if (!zona || zona.hidden) return;

    const cache = cuposCache.get(id);
    if (cache) {
      pintarCupos(zona, id, cache);
      return;
    }

    zona.innerHTML = `<div class="estado-carga"><span class="spinner spinner-chico" aria-hidden="true"></span><span>Cargando necesidades…</span></div>`;
    try {
      const cupos = await API.cupos(id);
      cuposCache.set(id, cupos);
      if (!lista.contains(zona)) return;
      pintarCupos(zona, id, cupos);
    } catch (e) {
      zona.innerHTML = `<div class="banner banner-peligro">${icon('alert')}<div><strong>No pudimos cargar las necesidades</strong><p>${esc(
        e?.message || 'Probá de nuevo.'
      )}</p></div><button type="button" class="btn btn-secundario btn-sm mt-1" data-reintentar-cupos>Reintentar</button>`;
      zona.querySelector('[data-reintentar-cupos]')?.addEventListener('click', () => {
        cuposCache.delete(id);
        cargarCupos(id);
      });
    }
  }

  function pintarCupos(zona, id, cupos) {
    if (!cupos.length) {
      zona.innerHTML = `<p class="campo-ayuda" style="margin:0">Esta institución no tiene necesidades abiertas en este momento. Igual podés acercarte y validar tu visita general.</p>`;
      return;
    }

    zona.innerHTML = cupos
      .map((c) => {
        const maximo = Math.max(1, Number(c.cupo_maximo) || 1);
        const actual = Number(c.cupo_actual) || 0;
        const completo = actual >= maximo || c.activo === false;
        const porcentaje = Math.min(100, Math.round((actual / maximo) * 100));
        return `
        <div class="necesidad ${completo ? 'completa' : ''}">
          <div class="necesidad-cab">
            <p class="necesidad-titulo">${esc(c.titulo || 'Necesidad')}</p>
            <span class="cupo-pill ${completo ? 'completo' : ''}">${
          completo ? 'Cubierto' : `${actual}/${maximo}`
        }</span>
          </div>
          ${c.descripcion ? `<p class="necesidad-desc">${esc(c.descripcion)}</p>` : ''}
          <div class="necesidad-progreso">
            <div class="barra ${completo ? '' : 'barra-azul'}"><span style="width:${porcentaje}%"></span></div>
            <span class="texto-suave texto-chico">${porcentaje}%</span>
          </div>
          <div class="necesidad-pie">
            <span class="chip">${icon('users')} ${actual} de ${maximo} personas</span>
            ${
              completo
                ? `<span class="chip estado-completado">${icon('checkcircle')} Necesidad cubierta</span>`
                : `<button type="button" class="btn btn-primario btn-sm" data-cupo="${esc(
                    String(c.id)
                  )}" data-institucion="${esc(id)}" data-titulo="${esc(c.titulo || '')}">${icon(
                    'qr'
                  )} Ayudar acá</button>`
            }
          </div>
        </div>`;
      })
      .join('');

    zona.querySelectorAll('[data-cupo]').forEach((b) =>
      b.addEventListener('click', () =>
        irA(
          `/qr?institucion=${encodeURIComponent(id)}&cupo=${encodeURIComponent(
            b.dataset.cupo
          )}&titulo=${encodeURIComponent(b.dataset.titulo || '')}`
        )
      )
    );
  }

  await cargar();
}
