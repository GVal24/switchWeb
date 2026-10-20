/* Contacto: mensajes para el equipo de Switch, con o sin sesión. */

import { Store } from '../store.js';
import { API } from '../api.js';
import { icon, esc, toast, cargarBoton, dialogo } from '../ui.js';
import { navegar } from '../router.js';
import { verLegal } from './login.js';

const ASUNTOS = [
  { valor: 'PREGUNTA', etiqueta: 'Pregunta', icono: 'help' },
  { valor: 'COMENTARIO', etiqueta: 'Comentario', icono: 'message' },
  { valor: 'CONTACTO', etiqueta: 'Problema técnico', icono: 'alert' },
];
const MAXIMO = 2000;

export async function render(contenedor) {
  let asunto = 'PREGUNTA';
  let enviando = false;

  contenedor.innerHTML = `
    <section class="pantalla pantalla-contacto">
      <header class="contacto-hero">
        <h1>${icon('mail')} Hablemos</h1>
        <p>¿Tenés una duda, una idea o algo no funciona? Escribinos y te respondemos. No compartas contraseñas ni códigos de verificación.</p>
      </header>

      ${
        Store.suspendido
          ? `<div class="banner banner-aviso">${icon('info')}<div><strong>Tu cuenta está suspendida</strong><p>Igual podés escribirnos para consultar o pedir una revisión.</p></div></div>`
          : ''
      }

      <form id="contacto-form" novalidate>
        ${
          Store.sesionActiva
            ? `<div class="banner banner-info">${icon('user')}<div><strong>${
                esc(Store.usuario?.nombre || 'Tu cuenta')
              }</strong><p>Te vamos a responder al teléfono registrado o por este mismo medio.</p></div></div>`
            : `<label class="campo" for="contacto-nombre">
                <span class="campo-etiqueta">Tu nombre</span>
                <input class="campo-input" id="contacto-nombre" name="nombre" maxlength="100" autocomplete="name" placeholder="Cómo querés que te llamemos">
              </label>`
        }

        <div class="campo">
          <span class="campo-etiqueta">¿Sobre qué querés escribir?</span>
          <div class="contacto-opciones" role="group" aria-label="Asunto del mensaje">
            ${ASUNTOS.map(
              (a) => `<button type="button" class="chip chip-opcion" data-asunto="${
                a.valor
              }" aria-pressed="${a.valor === asunto}">${icon(a.icono)} ${a.etiqueta}</button>`
            ).join('')}
          </div>
        </div>

        <label class="campo" for="contacto-mensaje">
          <span class="campo-etiqueta">Tu mensaje <span class="req">*</span></span>
          <textarea class="campo-input" id="contacto-mensaje" name="mensaje" rows="6" maxlength="${MAXIMO}" required placeholder="Contanos qué necesitás con el mayor detalle posible…"></textarea>
          <span class="contador-texto"><span id="contacto-contador">0</span>/${MAXIMO}</span>
        </label>

        <p class="campo-error" id="contacto-error" role="alert" hidden></p>

        <button type="submit" class="btn btn-primario btn-block btn-lg" id="contacto-enviar">${icon(
          'send'
        )} Enviar mensaje</button>
      </form>

      <div class="contacto-info">
        ${icon('shield')}
        <p>Usamos tus datos sólo para responderte. Si el problema es sobre otra persona, contanos qué pasó sin incluir datos sensibles de terceros.</p>
      </div>

      <div class="fila mt-2" style="gap:0.4rem;flex-wrap:wrap">
        <button type="button" class="btn btn-secundario btn-sm" data-legal="terminos">${icon(
          'shield'
        )} Términos</button>
        <button type="button" class="btn btn-secundario btn-sm" data-legal="privacidad">${icon(
          'lock'
        )} Privacidad</button>
        <button type="button" class="btn btn-fantasma btn-sm" data-volver>Volver</button>
      </div>
    </section>
  `;

  const form = contenedor.querySelector('#contacto-form');
  const mensaje = contenedor.querySelector('#contacto-mensaje');
  const contador = contenedor.querySelector('#contacto-contador');
  const errorEl = contenedor.querySelector('#contacto-error');
  const enviar = contenedor.querySelector('#contacto-enviar');

  contenedor.querySelectorAll('[data-asunto]').forEach((b) =>
    b.addEventListener('click', () => {
      asunto = b.dataset.asunto;
      contenedor.querySelectorAll('[data-asunto]').forEach((otro) => {
        otro.setAttribute('aria-pressed', String(otro === b));
        otro.classList.toggle('activo', otro === b);
      });
    })
  );

  const actualizarContador = () => {
    contador.textContent = String(mensaje.value.length);
  };
  mensaje.addEventListener('input', actualizarContador);

  const mostrarError = (texto) => {
    errorEl.textContent = texto || '';
    errorEl.hidden = !texto;
    if (texto) errorEl.focus();
  };

  contenedor.querySelectorAll('[data-legal]').forEach((b) =>
    b.addEventListener('click', () => verLegal(b.dataset.legal))
  );
  contenedor.querySelector('[data-volver]').addEventListener('click', () => {
    if (history.length > 1) navegar('/catalogo');
    else navegar('/catalogo');
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviando) return;
    const texto = mensaje.value.trim();
    if (!texto) {
      mostrarError('Escribí tu mensaje antes de enviarlo.');
      mensaje.focus();
      return;
    }
    mostrarError('');
    enviando = true;
    const restaurar = cargarBoton(enviar, 'Enviando…');
    try {
      const payload = { asunto, mensaje: texto };
      if (!Store.sesionActiva) {
        const nombre = contenedor.querySelector('#contacto-nombre')?.value.trim();
        if (nombre) payload.nombre = nombre;
      }
      const res = await API.contacto(payload);
      toast('Mensaje enviado. Gracias por escribirnos.', 'exito', 4500);
      await dialogo({
        titulo: 'Mensaje enviado',
        icono: 'checkcircle',
        html: `<p class="modal-texto">${esc(
          res?.mensaje || 'Recibimos tu mensaje y te vamos a responder.'
        )}</p><p class="campo-ayuda">Podés seguir usando Switch mientras tanto.</p>`,
        acciones: [
          { texto: 'Enviar otro', valor: 'otro', clase: 'btn-secundario' },
          { texto: 'Listo', valor: 'cerrar', clase: 'btn-primario', auto: true },
        ],
      });
      form.reset();
      mensaje.value = '';
      contador.textContent = '0';
      asunto = 'PREGUNTA';
      contenedor.querySelectorAll('[data-asunto]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.asunto === 'PREGUNTA'))
      );
      enviando = false;
      restaurar();
    } catch (e) {
      mostrarError(e?.message || 'No pudimos enviar el mensaje. Probá de nuevo.');
      enviando = false;
      restaurar();
    }
  });

  return () => {};
}
