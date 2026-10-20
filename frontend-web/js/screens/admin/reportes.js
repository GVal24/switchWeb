/* Denuncias de la comunidad: evaluar, desestimar, suspender o dar de baja. */

import { API } from '../../api.js';
import {
  icon,
  esc,
  toast,
  spinner,
  vacio,
  errorEstado,
  confirmar,
  dialogo,
} from '../../ui.js';
import { navegar } from '../../router.js';

const ESTADOS = {
  PENDIENTE: { etiqueta: 'Pendiente', clase: 'estado-pendiente' },
  DESESTIMADO: { etiqueta: 'Desestimado', clase: '' },
  RESUELTO_SUSPENSION: { etiqueta: 'Suspendido', clase: 'estado-aceptada' },
  RESUELTO_BAN: { etiqueta: 'Baja definitiva', clase: 'estado-rechazada' },
};

export async function render(contenedor) {
  let reportes = [];
  let filtro = 'PENDIENTES';
  const ocupados = new Set();

  contenedor.innerHTML = `
    <section class="pantalla pantalla-reportes">
      <header class="admin-cabecera">
        <h1>${icon('alert')} Denuncias</h1>
        <p>Escuchá a la comunidad y decidí con cuidado. Una sanción afecta la vida de una persona: revisá el contexto.</p>
        <div class="fila" style="gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem">
          <button type="button" class="btn btn-secundario btn-sm" id="rep-refrescar">${icon(
            'refresh'
          )} Actualizar</button>
          <button type="button" class="btn btn-fantasma btn-sm" data-volver>${icon(
            'back'
          )} Panel</button>
        </div>
      </header>

      <div class="admin-toggle" role="group" aria-label="Filtrar denuncias">
        <button type="button" class="chip chip-opcion" data-filtro="PENDIENTES" aria-pressed="true">Pendientes</button>
        <button type="button" class="chip chip-opcion" data-filtro="TODAS" aria-pressed="false">Todas</button>
      </div>

      <div id="rep-lista">${spinner('Cargando denuncias…')}</div>
    </section>
  `;

  const lista = contenedor.querySelector('#rep-lista');

  contenedor.querySelector('[data-volver]').addEventListener('click', () => navegar('/admin'));
  contenedor.querySelector('#rep-refrescar').addEventListener('click', cargar);
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
    const boton = contenedor.querySelector('#rep-refrescar');
    boton.disabled = true;
    lista.innerHTML = spinner('Cargando denuncias…');
    try {
      reportes = await API.adminReportes();
      pintar();
    } catch (e) {
      lista.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar las denuncias.',
        '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      lista.querySelector('[data-reintentar]')?.addEventListener('click', cargar);
    } finally {
      boton.disabled = false;
    }
  }

  function pintar() {
    const visibles =
      filtro === 'PENDIENTES' ? reportes.filter((r) => r.estado === 'PENDIENTE') : reportes;

    if (!visibles.length) {
      lista.innerHTML = vacio(
        'shield',
        reportes.length ? 'No hay denuncias pendientes' : 'Todavía no hay denuncias',
        reportes.length
          ? 'Las denuncias ya fueron evaluadas. Podés verlas en “Todas”.'
          : 'Cuando alguien reporte un problema, va a aparecer acá.',
        ''
      );
      return;
    }

    lista.innerHTML = `<div class="admin-lista">${visibles.map(tarjeta).join('')}</div>`;

    lista.querySelectorAll('[data-desestimar]').forEach((b) =>
      b.addEventListener('click', () => desestimar(b.dataset.desestimar))
    );
    lista.querySelectorAll('[data-suspender]').forEach((b) =>
      b.addEventListener('click', () => suspender(b.dataset.suspender))
    );
    lista.querySelectorAll('[data-baja]').forEach((b) =>
      b.addEventListener('click', () => darDeBaja(b.dataset.baja))
    );
  }

  function tarjeta(r) {
    const estado = ESTADOS[r.estado] || { etiqueta: r.estado, clase: '' };
    const pendiente = r.estado === 'PENDIENTE';
    const reportado = r.reportado_nombre?.trim() || (r.reportado_id ? `Usuario #${r.reportado_id}` : '');
    return `<article class="reporte ${pendiente ? 'pendiente' : ''}" data-reporte="${esc(
      String(r.id)
    )}">
      <div class="reporte-cab">
        <span class="avatar" aria-hidden="true">${esc(
          (r.reportante_nombre || '?').trim().charAt(0).toUpperCase()
        )}</span>
        <div class="crece">
          <p class="negrita" style="font-size:0.86rem">${esc(
            r.reportante_nombre || 'Alguien de la comunidad'
          )}</p>
          <div class="reporte-partes">
            <span>${icon('clock')} ${esc(r.creado_en || '')}</span>
            ${
              reportado
                ? `<span>${icon('user')} Denuncia a <strong>${esc(reportado)}</strong></span>`
                : `<span>${icon('info')} Inconveniente general</span>`
            }
          </div>
        </div>
        <span class="chip ${estado.clase}">${esc(estado.etiqueta)}</span>
      </div>

      <p class="reporte-motivo">${esc(r.motivo || 'Sin detalle')}</p>

      ${
        pendiente
          ? `<div class="reporte-acciones">
              <button type="button" class="btn btn-secundario btn-sm" data-desestimar="${esc(
                String(r.id)
              )}">${icon('x')} Desestimar</button>
              ${
                reportado
                  ? `<button type="button" class="btn btn-primario btn-sm" data-suspender="${esc(
                      String(r.id)
                    )}">${icon('clock')} Suspender</button>
                     <button type="button" class="btn btn-peligro btn-sm" data-baja="${esc(
                       String(r.id)
                     )}">${icon('lock')} Dar de baja</button>`
                  : ''
              }
            </div>`
          : ''
      }
    </article>`;
  }

  function buscar(id) {
    return reportes.find((r) => String(r.id) === String(id));
  }

  function bloquear(id, bloquearlo = true) {
    const card = lista.querySelector(`[data-reporte="${CSS.escape(String(id))}"]`);
    card?.querySelectorAll('button').forEach((b) => (b.disabled = bloquearlo));
    if (bloquearlo) ocupados.add(String(id));
    else ocupados.delete(String(id));
  }

  function aplicarEstado(id, estado) {
    const reporte = buscar(id);
    if (reporte) reporte.estado = estado;
    pintar();
    if (typeof window.__switchActualizarShell === 'function') {
      window.__switchActualizarShell();
    }
  }

  async function desestimar(id) {
    if (ocupados.has(String(id))) return;
    const r = buscar(id);
    const ok = await confirmar({
      titulo: 'Desestimar denuncia',
      texto: `La denuncia de <strong>${esc(
        r?.reportante_nombre || 'esta persona'
      )}</strong> se marcará como revisada sin sanción. ¿Confirmás?`,
      textoOk: 'Desestimar',
      icono: 'checkcircle',
    });
    if (!ok) return;
    bloquear(id);
    try {
      const res = await API.adminDesestimar(id);
      toast(res?.mensaje || 'Denuncia desestimada.', 'exito');
      aplicarEstado(id, 'DESESTIMADO');
    } catch (e) {
      toast(e?.message || 'No pudimos desestimar la denuncia.', 'error');
      bloquear(id, false);
    }
  }

  async function suspender(id) {
    if (ocupados.has(String(id))) return;
    const r = buscar(id);
    const elegido = await dialogo({
      titulo: 'Suspender cuenta',
      icono: 'clock',
      html: `<p class="modal-texto">Vas a suspender a <strong>${esc(
        r?.reportado_nombre || 'esta persona'
      )}</strong>. Durante ese tiempo no podrá publicar, proponer ni enviar mensajes.</p>
      <p class="campo-ayuda">La denuncia quedará marcada como resuelta.</p>`,
      acciones: [
        { texto: '3 días', valor: '3', clase: 'btn-secundario' },
        { texto: '7 días', valor: '7', clase: 'btn-secundario' },
        { texto: '30 días', valor: '30', clase: 'btn-secundario' },
        { texto: 'Cancelar', valor: '', clase: 'btn-fantasma' },
      ],
    });
    if (!elegido) return;
    bloquear(id);
    try {
      const res = await API.adminSuspender(r.reportado_id, Number(elegido), r.id);
      toast(res?.mensaje || `Cuenta suspendida por ${elegido} días.`, 'exito', 4800);
      aplicarEstado(id, 'RESUELTO_SUSPENSION');
    } catch (e) {
      toast(e?.message || 'No pudimos suspender la cuenta.', 'error');
      bloquear(id, false);
    }
  }

  async function darDeBaja(id) {
    if (ocupados.has(String(id))) return;
    const r = buscar(id);
    const ok = await confirmar({
      titulo: 'Dar de baja definitiva',
      texto: `La cuenta de <strong>${esc(
        r?.reportado_nombre || 'esta persona'
      )}</strong> será desactivada de forma permanente. Esta acción es muy delicada: revisá que la denuncia lo justifique.`,
      textoOk: 'Dar de baja',
      peligro: true,
      icono: 'alert',
    });
    if (!ok) return;
    bloquear(id);
    try {
      const res = await API.adminDarDeBaja(r.reportado_id, r.id);
      toast(res?.mensaje || 'La cuenta fue dada de baja.', 'exito', 4800);
      aplicarEstado(id, 'RESUELTO_BAN');
    } catch (e) {
      toast(e?.message || 'No pudimos dar de baja la cuenta.', 'error');
      bloquear(id, false);
    }
  }

  await cargar();
}
