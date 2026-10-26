/* Panel privado de instituciones donde la persona tiene membresía vigente. */

import { API } from '../api.js';
import { icon, esc, spinner, vacio, errorEstado, toast, cargarBoton, confirmar } from '../ui.js';
import { navegar } from '../router.js';

const PRIORIDADES = ['GENERAL', 'PRIORITARIA', 'URGENTE'];

export async function render(contenedor, ctx) {
  contenedor.innerHTML = `<section class="pantalla">${spinner('Cargando tus instituciones…')}</section>`;
  let instituciones;
  try {
    instituciones = await API.miPanelInstitucional();
  } catch (error) {
    contenedor.innerHTML = `<section class="pantalla">${errorEstado(
      error?.message || 'No pudimos cargar tus instituciones.',
      '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
    )}</section>`;
    contenedor.querySelector('[data-reintentar]')?.addEventListener('click', () => render(contenedor, ctx));
    return;
  }

  if (!instituciones.length) {
    contenedor.innerHTML = `
      <section class="pantalla">
        ${vacio('town', 'No tenés acceso institucional asignado', 'La administración de Switch debe asignarte como responsable. Una vez asignada, desde acá podés administrar pedidos y delegados.', '<button type="button" class="btn btn-secundario" data-voluntariado>Ver instituciones</button>')}
      </section>`;
    contenedor.querySelector('[data-voluntariado]')?.addEventListener('click', () => navegar('/voluntariado'));
    return;
  }

  contenedor.innerHTML = `
    <section class="pantalla pantalla-gestion-instituciones">
      <header class="admin-cabecera">
        <h1>${icon('town')} Gestión institucional</h1>
        <p>Estadísticas, pedidos y accesos para cada institución que administrás.</p>
        <button type="button" class="btn btn-fantasma btn-sm mt-1" data-refrescar>${icon('refresh')} Actualizar</button>
      </header>
      <div id="gestion-inst-lista">${instituciones.map(tarjeta).join('')}</div>
    </section>
  `;

  const lista = contenedor.querySelector('#gestion-inst-lista');
  lista.addEventListener('submit', procesarFormulario);
  lista.addEventListener('click', procesarAccion);
  contenedor.querySelector('[data-refrescar]').addEventListener('click', () => render(contenedor, ctx));

  function tarjeta(inst) {
    const esResponsable = inst.rol_membresia === 'RESPONSABLE';
    const cuposTotal = Number(inst.cupos_totales) || 0;
    const cuposCubiertos = Number(inst.cupos_cubiertos) || 0;
    return `
      <article class="panel mt-1">
        <div class="seccion-cabecera">
          <div><h2>${esc(inst.nombre)}</h2><p class="texto-suave">${esc(inst.tipo)} · ${esc(inst.direccion)}</p></div>
          <span class="chip">${esResponsable ? 'Responsable' : 'Delegado/a'}</span>
        </div>
        <div class="perfil-stats">
          ${kpi('heart', inst.colaboraciones, 'Colaboraciones')}
          ${kpi('users', inst.necesidades_abiertas, 'Pedidos abiertos')}
          ${kpi('checkcircle', `${cuposCubiertos}/${cuposTotal}`, 'Cupos cubiertos')}
        </div>
        <button type="button" class="btn btn-fantasma btn-sm" data-perfil="${esc(String(inst.id))}">${icon('eye')} Ver perfil público</button>
        <div class="seccion-cabecera mt-1"><h3>Necesidades</h3></div>
        ${inst.necesidades.length ? inst.necesidades.map((n) => formularioNecesidad(inst.id, n)).join('') : '<p class="campo-ayuda">Todavía no cargaste pedidos.</p>'}
        <form class="panel" data-crear-necesidad="${esc(String(inst.id))}">
          <h3>Agregar necesidad</h3>
          ${camposNecesidad()}
          <button type="submit" class="btn btn-primario btn-sm">${icon('plus')} Publicar pedido</button>
        </form>
        ${esResponsable ? `
          <div class="seccion-cabecera mt-1"><h3>Delegados</h3></div>
          ${inst.delegados.length ? inst.delegados.map((d) => `
            <div class="fila" style="justify-content:space-between">
              <span>${esc(d.nombre)} ${esc(d.apellido)} · DNI ${esc(d.dni)}</span>
              <button type="button" class="btn btn-peligro btn-sm" data-quitar-delegado="${esc(String(d.membresia_id))}" data-inst="${esc(String(inst.id))}">${icon('x')} Revocar</button>
            </div>
          `).join('') : '<p class="campo-ayuda">Todavía no hay delegados.</p>'}
          <form class="fila mt-1" data-agregar-delegado="${esc(String(inst.id))}">
            <label class="campo crece"><span class="campo-etiqueta">Agregar cuenta existente por DNI</span><input class="campo-input" name="dni" inputmode="numeric" maxlength="10" required></label>
            <button type="submit" class="btn btn-secundario btn-sm">${icon('user')} Agregar</button>
          </form>
        ` : ''}
      </article>
    `;
  }

  function formularioNecesidad(institucionId, necesidad) {
    const completa = Number(necesidad.cupo_actual) >= Number(necesidad.cupo_maximo);
    return `
      <form class="necesidad panel" data-editar-necesidad="${esc(String(institucionId))}" data-necesidad="${esc(String(necesidad.id))}">
        <div class="necesidad-cab">
          <strong>${esc(necesidad.titulo)}</strong>
          <span class="cupo-pill ${completa ? 'completo' : ''}">${Number(necesidad.cupo_actual)}/${Number(necesidad.cupo_maximo)} ${completa ? 'cubierto' : ''}</span>
        </div>
        ${camposNecesidad(necesidad)}
        <div class="fila" style="gap:0.4rem">
          <button type="submit" class="btn btn-secundario btn-sm">${icon('check')} Guardar cambios</button>
          <button type="button" class="btn btn-fantasma btn-sm" data-pausar="${esc(String(necesidad.id))}" data-inst="${esc(String(institucionId))}" data-pausada="${necesidad.pausado_manualmente ? 'true' : 'false'}">${icon(necesidad.pausado_manualmente ? 'refresh' : 'clock')} ${necesidad.pausado_manualmente ? 'Reactivar' : 'Pausar'}</button>
        </div>
      </form>
    `;
  }

  function camposNecesidad(necesidad = {}) {
    return `
      <label class="campo"><span class="campo-etiqueta">Título</span><input class="campo-input" name="titulo" maxlength="100" required value="${esc(necesidad.titulo || '')}"></label>
      <label class="campo"><span class="campo-etiqueta">Descripción</span><textarea class="campo-input" name="descripcion" maxlength="500" rows="2">${esc(necesidad.descripcion || '')}</textarea></label>
      <div class="fila-campos">
        <label class="campo"><span class="campo-etiqueta">Prioridad</span><select class="campo-input" name="prioridad">${PRIORIDADES.map((p) => `<option value="${p}" ${p === (necesidad.prioridad || 'GENERAL') ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
        <label class="campo"><span class="campo-etiqueta">Cupo máximo</span><input class="campo-input" type="number" name="cupoMaximo" min="1" max="999" required value="${esc(String(necesidad.cupo_maximo || 1))}"></label>
      </div>
    `;
  }

  function kpi(icono, valor, etiqueta) {
    return `<div class="stat-card">${icon(icono)}<p class="stat-valor">${esc(String(valor ?? 0))}</p><p class="stat-etiqueta">${esc(etiqueta)}</p></div>`;
  }

  async function procesarFormulario(event) {
    const form = event.target;
    if (!form.matches('[data-crear-necesidad], [data-editar-necesidad], [data-agregar-delegado]')) return;
    event.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    const restaurar = cargarBoton(boton, 'Guardando…');
    try {
      if (form.matches('[data-agregar-delegado]')) {
        await API.agregarDelegado(form.dataset.agregarDelegado, form.elements.dni.value.trim());
        toast('Delegado agregado correctamente.', 'exito');
      } else {
        const payload = {
          titulo: form.elements.titulo.value.trim(),
          descripcion: form.elements.descripcion.value.trim(),
          prioridad: form.elements.prioridad.value,
          cupoMaximo: Number(form.elements.cupoMaximo.value),
        };
        if (form.matches('[data-crear-necesidad]')) {
          await API.crearNecesidad(form.dataset.crearNecesidad, payload);
          toast('Pedido publicado correctamente.', 'exito');
        } else {
          await API.actualizarNecesidad(form.dataset.editarNecesidad, form.dataset.necesidad, payload);
          toast('Pedido actualizado correctamente.', 'exito');
        }
      }
      await render(contenedor, ctx);
    } catch (error) {
      restaurar();
      toast(error?.message || 'No pudimos guardar los cambios.', 'error', 5000);
    }
  }

  async function procesarAccion(event) {
    const botonPerfil = event.target.closest('[data-perfil]');
    if (botonPerfil) {
      navegar(`/instituciones/${encodeURIComponent(botonPerfil.dataset.perfil)}`);
      return;
    }
    const botonPausa = event.target.closest('[data-pausar]');
    if (botonPausa) {
      const pausada = botonPausa.dataset.pausada !== 'true';
      try {
        await API.pausarNecesidad(botonPausa.dataset.inst, botonPausa.dataset.pausar, pausada);
        toast(pausada ? 'Pedido pausado.' : 'Pedido reactivado.', 'exito');
        await render(contenedor, ctx);
      } catch (error) {
        toast(error?.message || 'No pudimos cambiar el estado del pedido.', 'error', 5000);
      }
      return;
    }
    const quitar = event.target.closest('[data-quitar-delegado]');
    if (quitar) {
      const ok = await confirmar({
        titulo: 'Revocar acceso',
        texto: 'La persona ya no podrá gestionar esta institución. Su cuenta Switch no se verá afectada.',
        textoOk: 'Revocar acceso',
        peligro: true,
        icono: 'alert',
      });
      if (!ok) return;
      try {
        await API.quitarDelegado(quitar.dataset.inst, quitar.dataset.quitarDelegado);
        toast('Acceso revocado.', 'exito');
        await render(contenedor, ctx);
      } catch (error) {
        toast(error?.message || 'No pudimos revocar el acceso.', 'error', 5000);
      }
    }
  }
}
