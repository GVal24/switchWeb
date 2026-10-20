/* Bandeja de contacto: leer, responder y archivar mensajes de la comunidad. */

import { API } from '../../api.js';
import {
  icon,
  esc,
  toast,
  spinner,
  vacio,
  errorEstado,
  confirmar,
  pedirTexto,
} from '../../ui.js';
import { navegar } from '../../router.js';

const ASUNTOS = {
  PREGUNTA: 'Pregunta',
  COMENTARIO: 'Comentario',
  CONTACTO: 'Contacto',
};

export async function render(contenedor) {
  let mensajes = [];
  let pendientes = 0;
  let filtro = 'PENDIENTES';
  const ocupados = new Set();

  contenedor.innerHTML = `
    <section class="pantalla pantalla-contacto-admin">
      <header class="admin-cabecera">
        <h1>${icon('mail')} Bandeja de entrada</h1>
        <p>Mensajes que la comunidad envía desde Contacto. Respondé con claridad y sin pedir datos sensibles.</p>
        <div class="fila" style="gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem">
          <button type="button" class="btn btn-secundario btn-sm" id="con-refrescar">${icon(
            'refresh'
          )} Actualizar</button>
          <button type="button" class="btn btn-fantasma btn-sm" data-volver>${icon(
            'back'
          )} Panel</button>
        </div>
      </header>

      <div class="admin-toggle" role="group" aria-label="Filtrar mensajes">
        <button type="button" class="chip chip-opcion" data-filtro="PENDIENTES" aria-pressed="true">Sin responder <span id="con-pendientes"></span></button>
        <button type="button" class="chip chip-opcion" data-filtro="TODOS" aria-pressed="false">Todos</button>
      </div>

      <div id="con-lista" aria-live="polite">${spinner('Cargando mensajes…')}</div>
    </section>
  `;

  const lista = contenedor.querySelector('#con-lista');
  const contadorPendientes = contenedor.querySelector('#con-pendientes');

  contenedor.querySelector('[data-volver]').addEventListener('click', () => navegar('/admin'));
  contenedor.querySelector('#con-refrescar').addEventListener('click', cargar);
  contenedor.querySelectorAll('[data-filtro]').forEach((b) =>
    b.addEventListener('click', () => {
      filtro = b.dataset.filtro;
      contenedor.querySelectorAll('[data-filtro]').forEach((otro) =>
        otro.setAttribute('aria-pressed', String(otro === b))
      );
      pintar();
    })
  );

  async function cargar() {
    const boton = contenedor.querySelector('#con-refrescar');
    boton.disabled = true;
    lista.innerHTML = spinner('Cargando mensajes…');
    try {
      const res = await API.adminContacto(false);
      mensajes = res.mensajes || [];
      pendientes = Number(res.pendientes || 0);
      contadorPendientes.textContent = pendientes ? `(${pendientes})` : '';
      pintar();
    } catch (e) {
      lista.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar la bandeja.',
        '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      lista.querySelector('[data-reintentar]')?.addEventListener('click', cargar);
    } finally {
      boton.disabled = false;
    }
  }

  function pintar() {
    const visibles =
      filtro === 'PENDIENTES' ? mensajes.filter((m) => !m.respuesta) : mensajes;

    if (!visibles.length) {
      lista.innerHTML = vacio(
        'mailopen',
        mensajes.length ? 'No hay mensajes sin responder' : 'La bandeja está vacía',
        mensajes.length
          ? 'Los mensajes ya respondidos están en “Todos”.'
          : 'Cuando alguien escriba desde Contacto, va a aparecer acá.',
        ''
      );
      return;
    }

    lista.innerHTML = `<div class="admin-lista">${visibles.map(tarjeta).join('')}</div>`;
    lista.querySelectorAll('[data-responder]').forEach((b) =>
      b.addEventListener('click', () => responder(b.dataset.responder))
    );
    lista.querySelectorAll('[data-leer]').forEach((b) =>
      b.addEventListener('click', () => marcarLeido(b.dataset.leer))
    );
    lista.querySelectorAll('[data-borrar]').forEach((b) =>
      b.addEventListener('click', () => borrar(b.dataset.borrar))
    );
  }

  function tarjeta(m) {
    const nuevo = !m.respuesta;
    const nombre = m.autor_nombre || 'Visitante';
    const datos = [
      m.autor_dni ? `DNI ${m.autor_dni}` : '',
      m.autor_telefono ? `Tel. ${m.autor_telefono}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return `<article class="mensaje-admin ${nuevo ? 'nuevo' : ''}" data-mensaje="${esc(
      String(m.id)
    )}">
      <div class="mensaje-admin-cab">
        <span class="avatar" aria-hidden="true">${esc(
          String(nombre).trim().charAt(0).toUpperCase() || '?'
        )}</span>
        <div class="crece">
          <p class="negrita" style="font-size:0.86rem">${esc(nombre)}</p>
          <p class="texto-suave texto-chico">${esc(
            ASUNTOS[m.asunto] || m.asunto || 'Contacto'
          )} · ${esc(m.creado_legible || '')}</p>
        </div>
        ${nuevo ? '<span class="chip estado-pendiente">Sin responder</span>' : ''}
        ${
          !m.leido && nuevo
            ? `<button type="button" class="icon-btn" data-leer="${esc(
                String(m.id)
              )}" aria-label="Marcar como leído">${icon('eye')}</button>`
            : ''
        }
      </div>

      ${datos ? `<p class="texto-suave texto-chico" style="margin-top:0.3rem">${esc(datos)}</p>` : ''}
      <p class="mensaje-admin-texto">${esc(m.mensaje || '')}</p>

      ${
        m.respuesta
          ? `<div class="mensaje-respuesta"><strong>Respuesta${
              m.respondio_nombre ? ` · ${esc(m.respondio_nombre)}` : ''
            }</strong>${esc(m.respuesta)}${
              m.respondido_legible
                ? `<br><span class="texto-chico" style="opacity:0.8">${esc(
                    m.respondido_legible
                  )}</span>`
                : ''
            }</div>`
          : ''
      }

      <div class="mensaje-admin-pie">
        <button type="button" class="btn ${nuevo ? 'btn-primario' : 'btn-secundario'} btn-sm" data-responder="${esc(
          String(m.id)
        )}">${icon('send')} ${m.respuesta ? 'Responder de nuevo' : 'Responder'}</button>
        <button type="button" class="btn btn-fantasma btn-sm" data-borrar="${esc(
          String(m.id)
        )}">${icon('trash')} Eliminar</button>
      </div>
    </article>`;
  }

  function buscar(id) {
    return mensajes.find((m) => String(m.id) === String(id));
  }

  function actualizarPendientes() {
    pendientes = mensajes.filter((m) => !m.respuesta).length;
    contadorPendientes.textContent = pendientes ? `(${pendientes})` : '';
  }

  async function responder(id) {
    if (ocupados.has(String(id))) return;
    const m = buscar(id);
    if (!m) return;
    const respuesta = await pedirTexto({
      titulo: 'Responder mensaje',
      texto: `<strong>${esc(m.autor_nombre || 'Visitante')}</strong> escribió: “${esc(
        m.mensaje || ''
      )}”`,
      etiqueta: 'Tu respuesta',
      max: 2000,
      requerido: true,
      textoOk: 'Guardar respuesta',
    });
    if (!respuesta) return;
    ocupados.add(String(id));
    const card = lista.querySelector(`[data-mensaje="${CSS.escape(String(id))}"]`);
    card?.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      const res = await API.adminResponderContacto(id, respuesta);
      const actualizado = res?.datos || {};
      m.respuesta = actualizado.respuesta ?? respuesta;
      m.leido = true;
      m.respondido_en = actualizado.respondido_en || new Date().toISOString();
      m.respondido_legible = actualizado.respondido_legible || 'Ahora';
      m.respondio_nombre = actualizado.respondio_nombre || 'Administración';
      toast(res?.mensaje || 'Respuesta guardada.', 'exito');
      actualizarPendientes();
      pintar();
      if (typeof window.__switchActualizarShell === 'function') {
        window.__switchActualizarShell();
      }
    } catch (e) {
      toast(e?.message || 'No pudimos guardar la respuesta.', 'error');
      card?.querySelectorAll('button').forEach((b) => (b.disabled = false));
    } finally {
      ocupados.delete(String(id));
    }
  }

  async function marcarLeido(id) {
    const m = buscar(id);
    if (!m || m.leido) return;
    m.leido = true;
    pintar();
    try {
      await API.adminLeerContacto(id);
    } catch (e) {
      /* El estado local alcanza para la bandeja. */
    }
  }

  async function borrar(id) {
    const m = buscar(id);
    const ok = await confirmar({
      titulo: 'Eliminar mensaje',
      texto: `Se va a eliminar el mensaje de <strong>${esc(
        m?.autor_nombre || 'Visitante'
      )}</strong>. Esta acción no se puede deshacer.`,
      textoOk: 'Eliminar',
      peligro: true,
      icono: 'trash',
    });
    if (!ok) return;
    try {
      const res = await API.adminBorrarContacto(id);
      mensajes = mensajes.filter((otro) => String(otro.id) !== String(id));
      toast(res?.mensaje || 'Mensaje eliminado.', 'exito');
      actualizarPendientes();
      pintar();
      if (typeof window.__switchActualizarShell === 'function') {
        window.__switchActualizarShell();
      }
    } catch (e) {
      toast(e?.message || 'No pudimos eliminar el mensaje.', 'error');
    }
  }

  await cargar();
}
