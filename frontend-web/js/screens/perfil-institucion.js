/* Perfil público de una institución y sus indicadores comunitarios. */

import { API } from '../api.js';
import { icon, esc, spinner, errorEstado, vacio } from '../ui.js';
import { navegar } from '../router.js';

export async function render(contenedor, ctx) {
  const id = ctx.params.id;
  contenedor.innerHTML = `<section class="pantalla">${spinner('Cargando perfil institucional…')}</section>`;
  try {
    const perfil = await API.perfilInstitucion(id);
    const cupos = await API.cupos(id);
    const cubiertos = Number(perfil.cupos_cubiertos) || 0;
    const totales = Number(perfil.cupos_totales) || 0;
    const porcentaje = totales ? Math.min(100, Math.round((cubiertos / totales) * 100)) : 0;
    contenedor.innerHTML = `
      <section class="pantalla pantalla-perfil-institucion">
        <header class="perfil-cabecera">
          <span class="inst-icono">${icon('town')}</span>
          <h1 class="perfil-nombre">${esc(perfil.nombre)}</h1>
          <p class="perfil-id">${esc(perfil.tipo)} · ${esc(perfil.direccion)}</p>
          ${perfil.telefono ? `<p>${icon('phone')} ${esc(perfil.telefono)}</p>` : ''}
        </header>
        ${perfil.descripcion ? `<div class="panel"><h2>Sobre la institución</h2><p>${esc(perfil.descripcion)}</p></div>` : ''}
        <div class="perfil-stats">
          ${estadistica('heart', perfil.colaboraciones, 'Colaboraciones')}
          ${estadistica('users', perfil.necesidades_abiertas, 'Necesidades abiertas')}
          ${estadistica('checkcircle', `${cubiertos}/${totales}`, 'Cupos cubiertos')}
        </div>
        <div class="panel mt-1">
          <h2>Avance de necesidades</h2>
          <div class="barra barra-alta"><span style="width:${porcentaje}%"></span></div>
          <p class="campo-ayuda">${porcentaje}% de los cupos publicados ya fueron cubiertos.</p>
        </div>
        <div class="seccion-cabecera mt-2"><h2>Necesidades abiertas</h2></div>
        <div id="perfil-inst-cupos">${cupos.length ? cupos.map((c) => `
          <article class="necesidad">
            <div class="necesidad-cab"><h3 class="necesidad-titulo">${esc(c.titulo)}</h3><span class="cupo-pill">${Number(c.cupo_actual)}/${Number(c.cupo_maximo)}</span></div>
            ${c.descripcion ? `<p class="necesidad-desc">${esc(c.descripcion)}</p>` : ''}
            <button type="button" class="btn btn-primario btn-sm" data-ayudar="${esc(String(c.id))}" data-titulo="${esc(c.titulo)}">${icon('qr')} Ayudar con este pedido</button>
          </article>
        `).join('') : vacio('heart', 'Sin pedidos abiertos', 'La institución no tiene necesidades abiertas en este momento.')}</div>
      </section>
    `;
    contenedor.querySelectorAll('[data-ayudar]').forEach((boton) =>
      boton.addEventListener('click', () => navegar(
        `/qr?institucion=${encodeURIComponent(id)}&cupo=${encodeURIComponent(boton.dataset.ayudar)}&titulo=${encodeURIComponent(boton.dataset.titulo)}`
      ))
    );
  } catch (error) {
    contenedor.innerHTML = `<section class="pantalla">${errorEstado(
      error?.message || 'No pudimos cargar el perfil institucional.',
      '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
    )}</section>`;
    contenedor.querySelector('[data-reintentar]')?.addEventListener('click', () => render(contenedor, ctx));
  }
}

function estadistica(icono, valor, titulo) {
  return `<div class="stat-card">${icon(icono)}<p class="stat-valor">${esc(String(valor ?? 0))}</p><p class="stat-etiqueta">${esc(titulo)}</p></div>`;
}
