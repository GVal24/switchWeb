/* Mis trueques: propuestas recibidas y enviadas, con aceptación, rechazo y
   confirmación de entrega con calificación. */

import { Store } from '../store.js';
import { API } from '../api.js';
import {
  icon,
  esc,
  avatar,
  toast,
  hoja,
  confirmar,
  spinner,
  vacio,
  errorEstado,
  estadoPropuesta,
  fechaHora,
  cargarBoton,
} from '../ui.js';
import { navegar } from '../router.js';

export async function render(contenedor, ctx) {
  if (!Store.sesionActiva) {
    navegar('/login?volver=/trueques', { reemplazar: true });
    return;
  }

  let tab = ctx.query.get('tab') === 'enviadas' ? 'enviadas' : 'recibidas';
  let datos = { recibidas: [], enviadas: [] };
  let carga = 0;

  contenedor.innerHTML = `
    <section class="pantalla pantalla-trueques">
      <div class="banner banner-info" style="margin-bottom:0.6rem">
        ${icon('swap')}
        <div>
          <strong>Trueques sin dinero</strong>
          <p>Cuando ambas partes confirman la entrega, el trueque queda completado y suma a su reputación.</p>
        </div>
      </div>

      ${
        Store.suspendido
          ? `<div class="banner banner-aviso">${icon('alert')}<div><strong>Cuenta suspendida</strong><p>Podés consultar tus trueques, pero no responder ni confirmar hasta que se resuelva.</p></div></div>`
          : ''
      }

      <div class="trueques-tabs" role="tablist" aria-label="Propuestas">
        <button type="button" role="tab" data-tab="recibidas">${icon('mail')} Recibidas <span class="badge-num" data-cuenta="recibidas" style="position:static;margin-left:0.25rem" hidden>0</span></button>
        <button type="button" role="tab" data-tab="enviadas">${icon('send')} Enviadas <span class="badge-num" data-cuenta="enviadas" style="position:static;margin-left:0.25rem" hidden>0</span></button>
      </div>

      <div id="trueques-lista" aria-live="polite" aria-busy="true">${spinner('Cargando trueques…')}</div>

      <button type="button" class="btn btn-fantasma btn-block mt-1" data-refrescar>${icon('refresh')} Actualizar</button>
    </section>
  `;

  const lista = contenedor.querySelector('#trueques-lista');

  const pintarTabs = () => {
    contenedor.querySelectorAll('[data-tab]').forEach((b) => {
      const activa = b.dataset.tab === tab;
      b.setAttribute('aria-selected', String(activa));
      b.tabIndex = activa ? 0 : -1;
    });
    const recibidas = datos.recibidas.filter((p) => p.estado === 'PENDIENTE').length;
    const enviadas = datos.enviadas.filter((p) => p.estado === 'ACEPTADA').length;
    actualizarCuenta('recibidas', recibidas);
    actualizarCuenta('enviadas', enviadas);
  };

  const actualizarCuenta = (nombre, cantidad) => {
    const el = contenedor.querySelector(`[data-cuenta="${nombre}"]`);
    if (!el) return;
    el.textContent = String(cantidad);
    el.hidden = cantidad === 0;
  };

  contenedor.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      if (tab === b.dataset.tab) return;
      tab = b.dataset.tab;
      try {
        history.replaceState(null, '', `#/trueques${tab === 'enviadas' ? '?tab=enviadas' : ''}`);
      } catch (e) {}
      pintarTabs();
      pintarLista();
    })
  );

  contenedor.querySelector('[data-refrescar]').addEventListener('click', () => cargar(true));

  async function cargar(manual = false) {
    const miCarga = ++carga;
    lista.setAttribute('aria-busy', 'true');
    lista.innerHTML = spinner('Cargando trueques…');
    try {
      datos = await API.misPropuestas();
      if (miCarga !== carga) return;
      pintarTabs();
      pintarLista();
      if (manual) toast('Lista actualizada.', 'exito');
    } catch (e) {
      if (miCarga !== carga) return;
      lista.setAttribute('aria-busy', 'false');
      lista.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar tus trueques.',
        '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      lista.querySelector('[data-reintentar]')?.addEventListener('click', () => cargar(true));
    }
  }

  function pintarLista() {
    lista.setAttribute('aria-busy', 'false');
    const propuestas = tab === 'recibidas' ? datos.recibidas : datos.enviadas;

    if (!propuestas.length) {
      lista.innerHTML = vacio(
        'swap',
        tab === 'recibidas' ? 'Todavía no recibiste propuestas' : 'Todavía no enviaste propuestas',
        tab === 'recibidas'
          ? 'Cuando alguien quiera algo tuyo, va a aparecer acá para que lo aceptes o rechaces.'
          : 'Explorá el catálogo y proponé un intercambio por algo que te sirva.',
        '<button type="button" class="btn btn-primario" data-ir-catalogo>Explorar el catálogo</button>'
      );
      lista.querySelector('[data-ir-catalogo]')?.addEventListener('click', () => navegar('/catalogo'));
      return;
    }

    lista.innerHTML = propuestas.map((p) => tarjeta(p, tab)).join('');

    lista.querySelectorAll('[data-aceptar]').forEach((b) =>
      b.addEventListener('click', () => responder(b.dataset.aceptar, 'ACEPTADA'))
    );
    lista.querySelectorAll('[data-rechazar]').forEach((b) =>
      b.addEventListener('click', () => responder(b.dataset.rechazar, 'RECHAZADA'))
    );
    lista.querySelectorAll('[data-confirmar]').forEach((b) =>
      b.addEventListener('click', () => confirmarEntrega(b.dataset.confirmar))
    );
    lista.querySelectorAll('[data-chat]').forEach((b) =>
      b.addEventListener('click', () =>
        navegar(
          `/chat/${encodeURIComponent(b.dataset.chat)}?nombre=${encodeURIComponent(
            b.dataset.nombre || 'Vecino de Switch'
          )}`
        )
      )
    );
  }

  function tarjeta(p, origen) {
    const estado = estadoPropuesta(p.estado);
    const items = normalizarItems(p.items_ofrecidos);
    const esRecibida = origen === 'recibidas';
    const otroId = esRecibida ? p.ofertante_id : p.dueno_id;
    const otroNombre = (esRecibida ? p.ofertante_nombre : p.dueno_nombre) || 'Vecino de Switch';
    const confirmacionPropia = esRecibida ? p.confirmacion_dueno : p.confirmacion_ofertante;
    const confirmacionAjena = esRecibida ? p.confirmacion_ofertante : p.confirmacion_dueno;
    const estadoTx = String(p.estado || '').toUpperCase();
    const suspendido = Store.suspendido;

    const acciones = [];
    if (estadoTx === 'PENDIENTE' && esRecibida) {
      acciones.push(
        `<button type="button" class="btn btn-primario btn-sm" data-aceptar="${esc(
          String(p.id)
        )}" ${suspendido ? 'disabled' : ''}>${icon('check')} Aceptar</button>`,
        `<button type="button" class="btn btn-peligro btn-sm" data-rechazar="${esc(
          String(p.id)
        )}" ${suspendido ? 'disabled' : ''}>${icon('x')} Rechazar</button>`
      );
    }
    if (estadoTx === 'ACEPTADA' && !confirmacionPropia) {
      acciones.push(
        `<button type="button" class="btn btn-primario btn-sm" data-confirmar="${esc(
          String(p.id)
        )}" ${suspendido ? 'disabled' : ''}>${icon('checkcircle')} Confirmar entrega</button>`
      );
    }

    return `
      <article class="trueque-card">
        <div class="trueque-cab">
          ${avatar(otroNombre)}
          <div class="crece">
            <p class="trueque-titulo">${esc(p.titulo_deseado || 'Intercambio')}</p>
            <p class="trueque-sub">${esRecibida ? 'De' : 'Para'} ${esc(otroNombre)} · ${
      esRecibida ? 'pidió algo tuyo' : 'pediste algo suyo'
    }</p>
          </div>
          <span class="chip ${estado.clase}">${esc(estado.etiqueta)}</span>
        </div>

        <div class="trueque-items">
          ${items
            .map(
              (it) =>
                `<span class="trueque-item">${icon('gift')} ${esc(
                  typeof it === 'string' ? it : it?.titulo || 'Publicación'
                )}</span>`
            )
            .join('') || '<span class="trueque-item">Sin detalle de ítems</span>'}
        </div>

        ${
          estadoTx === 'ACEPTADA'
            ? `<div class="trueque-pie">
                <span class="confirmacion-estado ${confirmacionPropia ? 'listo' : ''}">${icon(
                confirmacionPropia ? 'checkcircle' : 'clock'
              )} ${confirmacionPropia ? 'Confirmaste' : 'Falta tu confirmación'}</span>
                <span class="confirmacion-estado ${confirmacionAjena ? 'listo' : ''}">${icon(
                confirmacionAjena ? 'checkcircle' : 'clock'
              )} ${confirmacionAjena ? 'La otra parte confirmó' : 'La otra parte no confirmó'}</span>
              </div>`
            : ''
        }

        <div class="trueque-pie">
          ${acciones.join('')}
          <button type="button" class="btn btn-secundario btn-sm" data-chat="${esc(
            String(otroId)
          )}" data-nombre="${esc(otroNombre)}">${icon('message')} Chat</button>
        </div>
        <div class="trueque-fecha mt-1">${icon('clock')} ${esc(fechaHora(p.creado_en))}</div>
      </article>
    `;
  }

  async function responder(id, estado) {
    const aceptar = estado === 'ACEPTADA';
    const ok = await confirmar({
      titulo: aceptar ? 'Aceptar el trueque' : 'Rechazar la propuesta',
      texto: aceptar
        ? 'Si aceptás, la otra persona va a poder coordinar la entrega por chat. Después ambas partes confirman que se concretó.'
        : 'La propuesta va a quedar cerrada y la otra persona recibirá el aviso. Después podés charlar por chat si querés.',
      textoOk: aceptar ? 'Aceptar trueque' : 'Rechazar',
      peligro: !aceptar,
      icono: aceptar ? 'checkcircle' : 'xcircle',
    });
    if (!ok) return;
    try {
      const res = await API.responder(id, estado);
      toast(res?.mensaje || (aceptar ? 'Trueque aceptado.' : 'Propuesta rechazada.'), 'exito');
      cargar();
    } catch (e) {
      toast(e?.message || 'No pudimos registrar la respuesta.', 'error', 5000);
    }
  }

  function confirmarEntrega(id) {
    const { cuerpo, cerrar } = hoja({
      titulo: 'Confirmar entrega',
      html: `
        <p class="modal-texto">¿El trueque se concretó? Podés dejar una calificación para ayudar a la reputación de la otra persona.</p>
        <p class="campo-etiqueta">Tu calificación (opcional)</p>
        <div class="fila" style="gap:0.35rem;justify-content:center;margin:0.2rem 0 0.8rem" role="group" aria-label="Calificación de 1 a 5 estrellas">
          ${[1, 2, 3, 4, 5]
            .map(
              (n) =>
                `<button type="button" class="icon-btn" data-estrella="${n}" aria-label="${n} ${
                  n === 1 ? 'estrella' : 'estrellas'
                }" aria-pressed="false" style="width:2.8rem;height:2.8rem">${icon('star')}</button>`
            )
            .join('')}
        </div>
        <label class="campo" for="confirmar-comentario">
          <span class="campo-etiqueta">Comentario (opcional)</span>
          <textarea class="campo-input" id="confirmar-comentario" rows="3" maxlength="300" placeholder="¿Cómo fue coordinar con esta persona?"></textarea>
        </label>
        <div id="confirmar-error"></div>
        <button type="button" class="btn btn-primario btn-block btn-lg" data-confirmar-si>${icon('checkcircle')} Confirmar entrega</button>
        <button type="button" class="btn btn-fantasma btn-block mt-1" data-confirmar-sin>Confirmar sin calificar</button>
      `,
    });

    let puntaje = 0;
    const estrellas = [...cuerpo.querySelectorAll('[data-estrella]')];
    const pintarEstrellas = () => {
      estrellas.forEach((b) => {
        const activa = Number(b.dataset.estrella) <= puntaje;
        b.setAttribute('aria-pressed', String(activa));
        b.style.color = activa ? 'var(--naranja)' : '';
      });
    };
    estrellas.forEach((b) =>
      b.addEventListener('click', () => {
        puntaje = Number(b.dataset.estrella);
        pintarEstrellas();
      })
    );

    const errorEl = cuerpo.querySelector('#confirmar-error');
    const hacer = async (conPuntaje) => {
      errorEl.innerHTML = '';
      const boton = cuerpo.querySelector(conPuntaje ? '[data-confirmar-si]' : '[data-confirmar-sin]');
      const restaurar = cargarBoton(boton, 'Confirmando…');
      try {
        const comentario = cuerpo.querySelector('#confirmar-comentario').value.trim();
        const res = await API.confirmar(
          id,
          conPuntaje ? puntaje || undefined : undefined,
          conPuntaje && comentario ? comentario : undefined
        );
        cerrar();
        toast(res?.mensaje || 'Confirmación registrada.', 'exito', 4500);
        cargar();
      } catch (e) {
        restaurar();
        errorEl.innerHTML = `<div class="banner banner-peligro" style="margin-top:0.6rem">${icon(
          'alert'
        )}<span>${esc(e?.message || 'No pudimos confirmar.')}</span></div>`;
      }
    };

    cuerpo.querySelector('[data-confirmar-si]').addEventListener('click', () => hacer(true));
    cuerpo.querySelector('[data-confirmar-sin]').addEventListener('click', () => hacer(false));
  }

  function normalizarItems(valor) {
    if (Array.isArray(valor)) return valor;
    if (typeof valor === 'string') {
      try {
        const parsed = JSON.parse(valor);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  pintarTabs();
  await cargar();
}
