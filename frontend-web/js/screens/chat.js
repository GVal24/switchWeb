/* Conversación uno a uno. Se actualiza sola cada pocos segundos y permite
   coordinar la entrega de un trueque. */

import { Store } from '../store.js';
import { API } from '../api.js';
import {
  icon,
  esc,
  avatar,
  toast,
  spinner,
  vacio,
  errorEstado,
  hora,
} from '../ui.js';
import { navegar } from '../router.js';
import { reportarUsuario } from '../reportes.js';

export async function render(contenedor, ctx) {
  if (!Store.sesionActiva) {
    navegar(`/login?volver=${encodeURIComponent(ctx.ruta?.hash || '/catalogo')}`, {
      reemplazar: true,
    });
    return;
  }

  const receptorId = ctx.params.receptorId;
  const nombre = ctx.query.get('nombre') || (String(receptorId).startsWith('inst_') ? 'Institución' : 'Vecino de Switch');
  const receptorEsUsuario =
    !Store.suspendido &&
    /^\d+$/.test(String(receptorId)) &&
    Number(receptorId) !== Number(Store.usuario?.id);
  let mensajes = [];
  let carga = 0;
  let enviando = false;
  let intervalo = null;
  let firma = '';

  contenedor.innerHTML = `
    <section class="pantalla pantalla-chat">
      <div class="dueno-fila" style="margin-bottom:0.7rem">
        ${avatar(nombre, 'avatar-lg')}
        <div class="crece">
          <div class="dueno-nombre-fila">
            <p class="dueno-nombre">${esc(nombre)}</p>
            ${
              receptorEsUsuario
                ? `<button type="button" class="icon-btn reporte-usuario" data-reportar-usuario aria-label="Reportar a ${esc(
                    nombre
                  )}">${icon('flag')}</button>`
                : ''
            }
          </div>
          <p class="texto-suave texto-chico">${icon('message')} Conversación de Switch</p>
        </div>
      </div>

      ${
        Store.suspendido
          ? `<div class="banner banner-aviso">${icon('alert')}<div><strong>Cuenta suspendida</strong><p>Podés leer la conversación, pero no enviar mensajes hasta que se resuelva.</p></div></div>`
          : ''
      }

      <div id="chat-zona" aria-live="polite" aria-busy="true">${spinner('Cargando mensajes…')}</div>

      <div class="chat-compositor" ${
        Store.suspendido ? 'aria-hidden="true" style="display:none"' : ''
      }>
        <textarea class="campo-input" id="chat-texto" rows="1" maxlength="1000" placeholder="Escribí un mensaje…" aria-label="Mensaje para ${esc(
          nombre
        )}"></textarea>
        <button type="button" class="chat-enviar" id="chat-enviar" aria-label="Enviar mensaje" disabled>${icon('send')}</button>
      </div>
      <p class="campo-ayuda" id="chat-ayuda" style="text-align:center">Enter envía · Shift + Enter agrega un salto de línea</p>
    </section>
  `;

  const zona = contenedor.querySelector('#chat-zona');
  const texto = contenedor.querySelector('#chat-texto');
  const enviar = contenedor.querySelector('#chat-enviar');
  const ayuda = contenedor.querySelector('#chat-ayuda');

  contenedor.querySelector('[data-reportar-usuario]')?.addEventListener('click', () =>
    reportarUsuario(receptorId, nombre)
  );

  if (Store.suspendido) {
    ayuda.hidden = true;
  }

  const ajustarAltura = () => {
    if (!texto) return;
    texto.style.height = 'auto';
    texto.style.height = Math.min(texto.scrollHeight, 112) + 'px';
    enviar.disabled = enviando || !texto.value.trim();
  };

  if (texto) {
    texto.addEventListener('input', ajustarAltura);
    texto.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        mandar();
      }
    });
    enviar.addEventListener('click', mandar);
  }

  function alFinal(antes) {
    const principal = document.getElementById('contenido');
    if (!principal) return;
    const cercaDelFinal =
      principal.scrollHeight - principal.scrollTop - principal.clientHeight < 160;
    if (antes || cercaDelFinal) {
      requestAnimationFrame(() => {
        principal.scrollTop = principal.scrollHeight;
      });
    }
  }

  async function cargar({ silencioso = false } = {}) {
    const miCarga = ++carga;
    if (!silencioso) {
      zona.setAttribute('aria-busy', 'true');
      zona.innerHTML = spinner('Cargando mensajes…');
    }
    try {
      const lista = await API.mensajes(receptorId);
      if (miCarga !== carga) return;
      const nuevaFirma = JSON.stringify(
        lista.map((m) => [m.id, m.texto, m.leido, m.creado_en])
      );
      const antes = mensajes.length === 0;
      const previaCantidad = mensajes.length;
      if (nuevaFirma === firma && silencioso) return;
      firma = nuevaFirma;
      mensajes = lista;
      pintar(antes || lista.length > previaCantidad);
    } catch (e) {
      if (miCarga !== carga) return;
      if (silencioso) return;
      zona.setAttribute('aria-busy', 'false');
      zona.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar la conversación.',
        '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      zona.querySelector('[data-reintentar]')?.addEventListener('click', () => cargar());
    }
  }

  function pintar(irAlFinal) {
    zona.setAttribute('aria-busy', 'false');
    if (!mensajes.length) {
      zona.innerHTML = vacio(
        'message',
        'Todavía no hay mensajes',
        'Rompe el hielo: contá qué te interesa, coordiná un horario o preguntá lo que necesites.'
      );
      return;
    }

    const miId = String(Store.usuario?.id ?? '');
    zona.innerHTML = `
      <div class="chat-lista">
        ${mensajes
          .map((m) => {
            const mia = String(m.emisor_id) === miId;
            return `<div class="burbuja ${mia ? 'burbuja-mia' : 'burbuja-otra'}">
              <span style="white-space:pre-wrap">${esc(m.texto || '')}</span>
              <span class="burbuja-hora">${esc(hora(m.creado_en))}${mia ? ' · vos' : ''}</span>
            </div>`;
          })
          .join('')}
      </div>
    `;
    alFinal(irAlFinal);
  }

  async function mandar() {
    if (enviando || Store.suspendido) return;
    const contenido = texto.value.trim();
    if (!contenido) return;
    enviando = true;
    ajustarAltura();
    enviar.innerHTML = '<span class="spinner spinner-chico" aria-hidden="true"></span>';
    try {
      await API.enviarMensaje(receptorId, nombre, contenido);
      texto.value = '';
      enviando = false;
      ajustarAltura();
      enviar.innerHTML = icon('send');
      zona.querySelector('.estado-error')?.remove();
      await cargar({ silencioso: true });
      pintar(true);
    } catch (e) {
      enviando = false;
      enviar.innerHTML = icon('send');
      ajustarAltura();
      const exceso = /habilitaci[oó]n|nexo/i.test(e?.message || '');
      zona.insertAdjacentHTML(
        'beforeend',
        `<div class="banner banner-peligro mt-1">${icon('alert')}<div><strong>No se pudo enviar</strong><p>${esc(
          e?.message || 'Probá de nuevo.'
        )}</p>${
          exceso
            ? '<button type="button" class="btn btn-secundario btn-sm mt-1" data-voluntariado>Renovar mi habilitación</button>'
            : ''
        }</div></div>`
      );
      zona.querySelector('[data-voluntariado]')?.addEventListener('click', () => navegar('/voluntariado'));
      toast('El mensaje no se envió.', 'error');
      texto.focus();
    }
  }

  await cargar();
  ajustarAltura();

  const refrescar = () => {
    if (document.visibilityState === 'visible') cargar({ silencioso: true });
  };
  intervalo = setInterval(refrescar, 6000);
  document.addEventListener('visibilitychange', refrescar);

  return () => {
    if (intervalo) clearInterval(intervalo);
    document.removeEventListener('visibilitychange', refrescar);
  };
}
