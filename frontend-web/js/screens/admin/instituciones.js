/* Asignación administrativa de responsables a instituciones registradas. */

import { API } from '../../api.js';
import { icon, esc, spinner, vacio, errorEstado, toast, cargarBoton, confirmar } from '../../ui.js';
import { navegar } from '../../router.js';

export async function render(contenedor) {
  let instituciones = [];
  contenedor.innerHTML = `
    <section class="pantalla pantalla-admin-instituciones">
      <header class="admin-cabecera">
        <h1>${icon('town')} Responsables institucionales</h1>
        <p>Asigná una cuenta existente como responsable. La responsabilidad anterior se revoca al transferirla.</p>
        <div class="fila" style="gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem">
          <button type="button" class="btn btn-secundario btn-sm" data-refrescar>${icon('refresh')} Actualizar</button>
          <button type="button" class="btn btn-fantasma btn-sm" data-volver>${icon('back')} Panel</button>
        </div>
      </header>
      <div id="instituciones-admin-lista" aria-live="polite">${spinner('Cargando instituciones…')}</div>
    </section>
  `;

  const lista = contenedor.querySelector('#instituciones-admin-lista');
  contenedor.querySelector('[data-volver]').addEventListener('click', () => navegar('/admin'));
  contenedor.querySelector('[data-refrescar]').addEventListener('click', cargar);
  lista.addEventListener('submit', asignar);

  async function cargar() {
    lista.innerHTML = spinner('Cargando instituciones…');
    try {
      instituciones = await API.adminInstituciones();
      pintar();
    } catch (error) {
      lista.innerHTML = errorEstado(
        error?.message || 'No pudimos cargar las instituciones.',
        '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      lista.querySelector('[data-reintentar]')?.addEventListener('click', cargar);
    }
  }

  function pintar() {
    if (!instituciones.length) {
      lista.innerHTML = vacio(
        'town',
        'Todavía no hay instituciones',
        'Cuando se registre una institución, vas a poder asignar su responsable desde acá.'
      );
      return;
    }

    lista.innerHTML = instituciones.map((institucion) => `
      <article class="panel mt-1">
        <h2>${esc(institucion.nombre)}</h2>
        <p class="texto-suave">${esc(institucion.tipo)} · ${esc(institucion.direccion)}</p>
        <p>
          <strong>Responsable actual:</strong>
          ${institucion.responsable_id
            ? `${esc(institucion.responsable_nombre)} · DNI ${esc(institucion.responsable_dni)}`
            : 'Sin asignar'}
        </p>
        <form data-institucion="${esc(String(institucion.id))}">
          <label class="campo">
            <span class="campo-etiqueta">${institucion.responsable_id ? 'Transferir responsabilidad al DNI' : 'Asignar responsable por DNI'}</span>
            <input class="campo-input" name="dni" inputmode="numeric" autocomplete="off" maxlength="10" pattern="[0-9. -]{8,10}" required aria-label="DNI de la cuenta responsable">
          </label>
          <button type="submit" class="btn btn-primario btn-sm">${icon('user')} ${institucion.responsable_id ? 'Transferir' : 'Asignar'}</button>
        </form>
      </article>
    `).join('');
  }

  async function asignar(event) {
    if (!event.target.matches('form[data-institucion]')) return;
    event.preventDefault();
    const form = event.target;
    const institucion = instituciones.find((item) => String(item.id) === form.dataset.institucion);
    if (institucion?.responsable_id) {
      const confirmado = await confirmar({
        titulo: 'Transferir responsabilidad',
        texto: `La persona responsable actual de ${esc(institucion.nombre)} va a perder ese acceso. ¿Querés continuar?`,
        textoOk: 'Transferir',
        peligro: true,
        icono: 'alert',
      });
      if (!confirmado) return;
    }
    const boton = form.querySelector('[type="submit"]');
    const restaurar = cargarBoton(boton, 'Asignando…');
    try {
      const dni = form.elements.dni.value.trim();
      const respuesta = await API.adminAsignarResponsable(form.dataset.institucion, dni);
      toast(respuesta?.mensaje || 'Responsable asignado correctamente.', 'exito');
      await cargar();
    } catch (error) {
      restaurar();
      toast(error?.message || 'No pudimos asignar el responsable.', 'error', 5000);
    }
  }

  await cargar();
}
