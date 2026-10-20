/* Sugerencias de esfuerzo: la comunidad propone reclasificar una publicación. */

import { API } from '../../api.js';
import {
  icon,
  esc,
  toast,
  spinner,
  vacio,
  errorEstado,
  chipEsfuerzo,
} from '../../ui.js';
import { navegar } from '../../router.js';

export async function render(contenedor) {
  let sugerencias = [];
  const ocupados = new Set();

  contenedor.innerHTML = `
    <section class="pantalla pantalla-sugerencias">
      <header class="admin-cabecera">
        <h1>${icon('sliders')} Sugerencias de esfuerzo</h1>
        <p>La comunidad propone cambiar el nivel de esfuerzo de una publicación. Revisá el título y el contexto antes de aplicar.</p>
        <div class="fila" style="gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem">
          <button type="button" class="btn btn-secundario btn-sm" id="sug-refrescar">${icon(
            'refresh'
          )} Actualizar</button>
          <button type="button" class="btn btn-fantasma btn-sm" data-volver>${icon(
            'back'
          )} Panel</button>
        </div>
      </header>

      <div id="sug-lista" aria-live="polite">${spinner('Cargando sugerencias…')}</div>
    </section>
  `;

  const lista = contenedor.querySelector('#sug-lista');

  contenedor.querySelector('[data-volver]').addEventListener('click', () => navegar('/admin'));
  contenedor.querySelector('#sug-refrescar').addEventListener('click', cargar);

  async function cargar() {
    const boton = contenedor.querySelector('#sug-refrescar');
    boton.disabled = true;
    lista.innerHTML = spinner('Cargando sugerencias…');
    try {
      sugerencias = await API.adminSugerencias();
      pintar();
    } catch (e) {
      lista.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar las sugerencias.',
        '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      lista.querySelector('[data-reintentar]')?.addEventListener('click', cargar);
    } finally {
      boton.disabled = false;
    }
  }

  function pintar() {
    if (!sugerencias.length) {
      lista.innerHTML = vacio(
        'checkcircle',
        'No hay sugerencias pendientes',
        'Cuando alguien proponga otro nivel de esfuerzo, va a aparecer acá.',
        ''
      );
      return;
    }

    lista.innerHTML = `<div class="admin-lista">${sugerencias.map(tarjeta).join('')}</div>`;
    lista.querySelectorAll('[data-aplicar]').forEach((b) =>
      b.addEventListener('click', () => aplicar(b.dataset.aplicar))
    );
    lista.querySelectorAll('[data-descartar]').forEach((b) =>
      b.addEventListener('click', () => descartar(b.dataset.descartar))
    );
  }

  function tarjeta(s) {
    return `<article class="mod-card" data-sugerencia="${esc(String(s.id))}">
      <div class="mod-meta">
        <span class="chip">${icon('clipboard')} ${esc(s.tipo_item || 'Ítem')}</span>
        <span>${icon('user')} ${esc(s.sugerido_por || 'Alguien de la comunidad')}</span>
        <span>${icon('clock')} ${esc(s.creado_en || '')}</span>
      </div>

      <h3 class="negrita" style="font-size:0.95rem;line-height:1.3">${esc(
        s.publicacion_titulo || 'Publicación'
      )}</h3>

      <div class="fila" style="gap:0.4rem;flex-wrap:wrap;align-items:center;margin-top:0.5rem">
        ${chipEsfuerzo(s.nivel_actual, 'Actual')}
        <span class="texto-suave" aria-hidden="true">${icon('chevron')}</span>
        ${chipEsfuerzo(s.nivel_sugerido, 'Sugerido')}
      </div>

      <div class="mod-acciones" style="margin-top:0.6rem">
        <button type="button" class="btn btn-primario btn-sm" data-aplicar="${esc(
          String(s.id)
        )}">${icon('check')} Aplicar cambio</button>
        <button type="button" class="btn btn-secundario btn-sm" data-descartar="${esc(
          String(s.id)
        )}">${icon('x')} Descartar</button>
        <button type="button" class="btn btn-fantasma btn-sm" data-ver="${esc(
          String(s.publicacion_id)
        )}">${icon('eye')} Ver publicación</button>
      </div>
    </article>`;
  }

  function botones(id) {
    const card = lista.querySelector(`[data-sugerencia="${CSS.escape(String(id))}"]`);
    return card ? [...card.querySelectorAll('button')] : [];
  }

  function quitar(id) {
    sugerencias = sugerencias.filter((s) => String(s.id) !== String(id));
    pintar();
  }

  async function aplicar(id) {
    if (ocupados.has(String(id))) return;
    ocupados.add(String(id));
    const botonesCard = botones(id);
    botonesCard.forEach((b) => (b.disabled = true));
    try {
      const res = await API.adminAplicarSugerencia(id);
      toast(res?.mensaje || 'Nivel de esfuerzo actualizado.', 'exito', 4200);
      quitar(id);
    } catch (e) {
      toast(e?.message || 'No pudimos aplicar la sugerencia.', 'error');
      botonesCard.forEach((b) => (b.disabled = false));
    } finally {
      ocupados.delete(String(id));
    }
  }

  async function descartar(id) {
    if (ocupados.has(String(id))) return;
    ocupados.add(String(id));
    const botonesCard = botones(id);
    botonesCard.forEach((b) => (b.disabled = true));
    try {
      const res = await API.adminDescartarSugerencia(id);
      toast(res?.mensaje || 'Sugerencia descartada.', 'exito');
      quitar(id);
    } catch (e) {
      toast(e?.message || 'No pudimos descartar la sugerencia.', 'error');
      botonesCard.forEach((b) => (b.disabled = false));
    } finally {
      ocupados.delete(String(id));
    }
  }

  lista.addEventListener('click', (ev) => {
    const ver = ev.target.closest('[data-ver]');
    if (ver) navegar(`/detalle/${encodeURIComponent(ver.dataset.ver)}`);
  });

  await cargar();
}
