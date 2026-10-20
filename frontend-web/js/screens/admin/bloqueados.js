/* Cuentas suspendidas o dadas de baja: revisar el motivo y reactivar. */

import { API } from '../../api.js';
import {
  icon,
  esc,
  toast,
  spinner,
  vacio,
  errorEstado,
  confirmar,
} from '../../ui.js';
import { navegar } from '../../router.js';

export async function render(contenedor) {
  let cuentas = [];
  let filtro = '';
  let ocupado = null;

  contenedor.innerHTML = `
    <section class="pantalla pantalla-bloqueados">
      <header class="admin-cabecera">
        <h1>${icon('lock')} Cuentas bloqueadas</h1>
        <p>Revisá las suspensiones temporales y las bajas definitivas. Dar de alta no borra el historial ni las publicaciones.</p>
        <div class="fila" style="gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem">
          <button type="button" class="btn btn-secundario btn-sm" id="blo-refrescar">${icon(
            'refresh'
          )} Actualizar</button>
          <button type="button" class="btn btn-fantasma btn-sm" data-volver>${icon(
            'back'
          )} Panel</button>
        </div>
      </header>

      <div class="buscador" role="search" style="margin-bottom:0.7rem">
        ${icon('search')}
        <input id="blo-buscar" type="search" placeholder="Buscar por nombre o DNI…" aria-label="Buscar cuentas bloqueadas" autocomplete="off">
      </div>

      <div id="blo-lista" aria-live="polite">${spinner('Cargando cuentas…')}</div>
    </section>
  `;

  const lista = contenedor.querySelector('#blo-lista');
  const buscador = contenedor.querySelector('#blo-buscar');

  contenedor.querySelector('[data-volver]').addEventListener('click', () => navegar('/admin'));
  contenedor.querySelector('#blo-refrescar').addEventListener('click', cargar);
  buscador.addEventListener('input', () => {
    filtro = buscador.value.trim().toLowerCase();
    pintar();
  });

  async function cargar() {
    const boton = contenedor.querySelector('#blo-refrescar');
    boton.disabled = true;
    lista.innerHTML = spinner('Cargando cuentas…');
    try {
      cuentas = await API.adminBloqueados();
      pintar();
    } catch (e) {
      lista.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar las cuentas bloqueadas.',
        '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      lista.querySelector('[data-reintentar]')?.addEventListener('click', cargar);
    } finally {
      boton.disabled = false;
    }
  }

  function pintar() {
    const visibles = cuentas.filter((c) => {
      if (!filtro) return true;
      return `${c.nombre || ''} ${c.apellido || ''} ${c.dni || ''}`
        .toLowerCase()
        .includes(filtro);
    });

    if (!visibles.length) {
      lista.innerHTML = vacio(
        'shield',
        filtro ? 'No encontramos esa cuenta' : 'No hay cuentas bloqueadas',
        filtro
          ? 'Probá con otro nombre o DNI.'
          : 'No hay suspensiones ni bajas activas en este momento.',
        filtro
          ? '<button type="button" class="btn btn-secundario" data-limpiar>Limpiar búsqueda</button>'
          : ''
      );
      lista.querySelector('[data-limpiar]')?.addEventListener('click', () => {
        buscador.value = '';
        filtro = '';
        pintar();
      });
      return;
    }

    lista.innerHTML = `<div class="admin-lista">${visibles.map(tarjeta).join('')}</div>`;
    lista.querySelectorAll('[data-reactivar]').forEach((b) =>
      b.addEventListener('click', () => reactivar(b.dataset.reactivar))
    );
  }

  function tarjeta(c) {
    const esBaja = c.deshabilitado === true || c.activo === false;
    const vencida = c.suspension_vencida === true;
    const activa = c.suspendido === true;
    const nombre = `${c.nombre || ''} ${c.apellido || ''}`.trim() || 'Cuenta sin nombre';
    const dias = Number(c.dias_restantes) || 0;

    const estado = esBaja
      ? { texto: 'Baja definitiva', clase: 'deshabilitado', icono: 'xcircle' }
      : vencida
        ? { texto: 'Suspensión vencida', clase: 'suspendido', icono: 'clock' }
        : {
            texto: `Suspendida${dias ? ` · ${dias} día${dias === 1 ? '' : 's'}` : ''}`,
            clase: 'suspendido',
            icono: 'clock',
          };

    return `<article class="bloqueado ${estado.clase}" data-cuenta="${esc(String(c.id))}">
      <div class="bloqueado-cab">
        <span class="avatar" aria-hidden="true">${esc(
          (c.nombre || '?').trim().charAt(0).toUpperCase()
        )}</span>
        <div class="crece">
          <p class="bloqueado-nombre">${esc(nombre)}</p>
          <p class="bloqueado-datos">
            DNI ${esc(c.dni || '—')} · ${esc(c.rol || 'VECINO')}<br>
            Miembro desde ${esc(c.creado_legible || '—')}
            ${
              c.suspendido_hasta_legible
                ? `<br>Hasta ${esc(c.suspendido_hasta_legible)}`
                : ''
            }
          </p>
        </div>
        <span class="chip ${esBaja ? 'estado-rechazada' : 'estado-pendiente'}">${icon(
          estado.icono
        )} ${esc(estado.texto)}</span>
      </div>

      ${
        c.motivo_suspension
          ? `<p class="bloqueado-motivo"><strong>Motivo:</strong> ${esc(
              c.motivo_suspension
            )}</p>`
          : ''
      }

      <div class="bloqueado-pie">
        <button type="button" class="btn ${esBaja ? 'btn-peligro' : 'btn-primario'} btn-sm" data-reactivar="${esc(
          String(c.id)
        )}">${icon('refresh')} ${
      esBaja ? 'Reactivar cuenta' : vencida ? 'Dar de alta' : 'Levantar suspensión'
    }</button>
      </div>
    </article>`;
  }

  async function reactivar(id) {
    if (ocupado) return;
    const cuenta = cuentas.find((c) => String(c.id) === String(id));
    const esBaja = cuenta?.deshabilitado === true || cuenta?.activo === false;
    const nombre = `${cuenta?.nombre || ''} ${cuenta?.apellido || ''}`.trim() || 'esta cuenta';
    const ok = await confirmar({
      titulo: esBaja ? 'Reactivar cuenta' : 'Levantar suspensión',
      texto: esBaja
        ? `La cuenta de <strong>${esc(
            nombre
          )}</strong> vuelve a estar activa. Sus publicaciones anteriores siguen sujetas a moderación.`
        : `Se levanta la suspensión de <strong>${esc(
            nombre
          )}</strong> antes de la fecha prevista. ¿Confirmás?`,
      textoOk: esBaja ? 'Reactivar' : 'Levantar',
      icono: 'refresh',
    });
    if (!ok) return;

    ocupado = String(id);
    const card = lista.querySelector(`[data-cuenta="${CSS.escape(String(id))}"]`);
    card?.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      const res = await API.adminReactivar(id);
      toast(res?.mensaje || 'La cuenta fue reactivada.', 'exito', 4500);
      cuentas = cuentas.filter((c) => String(c.id) !== String(id));
      pintar();
      if (typeof window.__switchActualizarShell === 'function') {
        window.__switchActualizarShell();
      }
    } catch (e) {
      toast(e?.message || 'No pudimos reactivar la cuenta.', 'error');
      card?.querySelectorAll('button').forEach((b) => (b.disabled = false));
    } finally {
      ocupado = null;
    }
  }

  await cargar();
}
