/* Utilidades de interfaz compartidas: iconos, avisos, diálogos, formatos. */

const SVG_NS = 'http://www.w3.org/2000/svg';

const ICONOS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  flag: '<path d="M5 21V5"/><path d="M5 5c5-4 9 4 14 0v10c-5 4-9-4-14 0z" fill="currentColor"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 4.3 2c-.9.7-1.8 1.3-1.8 2.8"/><circle cx="12" cy="17.2" r=".8" fill="currentColor" stroke="none"/>',
  texto: '<path d="M5 6h14M12 6v13M8 19h8"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1.2a2.4 2.4 0 0 0 0-4.8h-1a2 2 0 0 1 0-4h4.6A4.2 4.2 0 0 0 21 8c0-2.8-4-5-9-5z"/><circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="6.8" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="9" r="1" fill="currentColor" stroke="none"/>',
  swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  message: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m4 12 6 6L20 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2"/><path d="M6.1 6.1C3.5 8 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 15.5c2.4.6 4 2.3 4 5.5"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V2.5h6V4"/><path d="m9 13 2 2 4-4"/>',
  mailopen: '<path d="M3 9V6l9-4 9 4v3"/><path d="M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9"/><path d="m3 10 9 6 9-6"/>',
  sliders: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  accessibility: '<circle cx="12" cy="4.5" r="2"/><path d="M4 8h16"/><path d="M12 8v6"/><path d="m8 21 4-7 4 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="8" r="0.8" fill="currentColor"/>',
  alert: '<path d="M12 3 2 21h20z"/><path d="M12 9v5"/><circle cx="12" cy="17.5" r="0.8" fill="currentColor"/>',
  town: '<path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01M15 10h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  flash: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9z"/><path d="M10 21h4"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18"/><path d="M12 8c-3 0-5-1.5-5-3.5S9 2 12 8zM12 8c3 0 5-1.5 5-3.5S15 2 12 8z"/>',
  checkcircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  xcircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
};

export function icon(nombre, clase = '') {
  const contenido = ICONOS[nombre] || ICONOS.info;
  return `<svg class="icono ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${contenido}</svg>`;
}

export function logo(tam = 36, extraClase = '') {
  return `<svg class="isotipo ${extraClase}" width="${tam}" height="${tam}" viewBox="0 0 48 48" role="img" aria-label="Switch">
    <g fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round">
      <path d="M38.5 24a14.5 14.5 0 0 1-24.7 10.3"/>
      <path d="M9.5 24A14.5 14.5 0 0 1 34.2 13.7"/>
    </g>
    <path d="M37.6 8.4v7h-7z" fill="currentColor"/>
    <path d="M10.4 39.6v-7h7z" fill="currentColor"/>
    <text x="24" y="30.6" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-size="18.5" font-weight="900" fill="var(--logo-s)" stroke="none">S</text>
  </svg>`;
}

export function esc(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function iniciales(nombre) {
  const partes = String(nombre || 'S').trim().split(/\s+/);
  return ((partes[0] || '')[0] || 'S') + ((partes[1] || '')[0] || '');
}

export function avatar(nombre, clase = '') {
  return `<span class="avatar ${clase}" aria-hidden="true">${esc(iniciales(nombre).toUpperCase())}</span>`;
}

/* ---------- avisos ---------- */

export function toast(mensaje, tipo = 'info', duracion = 3600) {
  const raiz = document.getElementById('toast-root');
  if (!raiz) return;
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  const icono = tipo === 'error' ? 'xcircle' : tipo === 'exito' ? 'checkcircle' : 'info';
  el.innerHTML = `${icon(icono)}<span>${esc(mensaje)}</span><button class="toast-cerrar" type="button" aria-label="Cerrar aviso">${icon('x')}</button>`;
  raiz.appendChild(el);
  const cerrar = () => {
    el.classList.add('saliendo');
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('.toast-cerrar').addEventListener('click', cerrar);
  setTimeout(cerrar, duracion);
}

export function anunciar(texto) {
  const el = document.getElementById('anuncio');
  if (el) el.textContent = texto;
}

/* ---------- diálogos ---------- */

let dialogosAbiertos = 0;

function montarDialogo(html, clase, { estatico = false } = {}) {
  const raiz = document.getElementById('dialog-root');
  const previo = document.activeElement;
  const dlg = document.createElement('dialog');
  dlg.className = clase;
  dlg.innerHTML = html;
  raiz.appendChild(dlg);
  dialogosAbiertos++;
  document.documentElement.classList.add('con-dialogo');

  const limpiar = () => {
    dialogosAbiertos = Math.max(0, dialogosAbiertos - 1);
    if (dialogosAbiertos === 0) document.documentElement.classList.remove('con-dialogo');
    dlg.remove();
    if (previo && previo.focus) {
      try { previo.focus({ preventScroll: true }); } catch (e) {}
    }
  };

  dlg.addEventListener('click', (ev) => {
    if (!estatico && ev.target === dlg) dlg.close('cancelar');
  });
  dlg.addEventListener('close', limpiar);

  dlg.showModal();
  setTimeout(() => {
    const auto = dlg.querySelector('[autofocus], .modal-auto');
    if (auto) auto.focus();
  }, 40);
  return dlg;
}

/**
 * Abre un diálogo modal y devuelve una promesa con el valor de la acción elegida.
 * acciones: [{ texto, valor, clase, auto }]
 */
export function dialogo({ titulo, html, acciones = [], clase = 'modal', icono, estatico = false, ancho }) {
  return new Promise((resolver) => {
    const botones = acciones
      .map(
        (a, i) =>
          `<button type="button" class="btn ${a.clase || 'btn-secundario'}" data-valor="${esc(a.valor ?? '')}" ${a.auto ? 'autofocus' : ''}>${esc(a.texto)}</button>`
      )
      .join('');
    const dlg = montarDialogo(
      `<div class="modal-caja" ${ancho ? `style="max-width:${ancho}"` : ''}>
        <header class="modal-encabezado">
          ${icono ? `<span class="modal-icono">${icon(icono)}</span>` : ''}
          <h2 class="modal-titulo" id="modal-titulo">${esc(titulo)}</h2>
          <button type="button" class="icon-btn modal-cerrar" aria-label="Cerrar">${icon('x')}</button>
        </header>
        <div class="modal-cuerpo">${html || ''}</div>
        ${acciones.length ? `<footer class="modal-acciones">${botones}</footer>` : ''}
      </div>`,
      clase,
      { estatico }
    );
    const terminar = (valor) => {
      if (!dlg.open) return;
      dlg.close();
      resolver(valor);
    };
    dlg.querySelectorAll('[data-valor]').forEach((b) =>
      b.addEventListener('click', () => terminar(b.dataset.valor))
    );
    const cerrar = dlg.querySelector('.modal-cerrar');
    if (cerrar) cerrar.addEventListener('click', () => terminar(null));
    dlg.addEventListener('close', () => resolver(null), { once: true });
  });
}

export async function confirmar({ titulo, texto, textoOk = 'Confirmar', peligro = false, icono }) {
  const valor = await dialogo({
    titulo,
    html: `<p class="modal-texto">${texto}</p>`,
    icono,
    acciones: [
      { texto: 'Cancelar', valor: 'no', clase: 'btn-fantasma' },
      { texto: textoOk, valor: 'si', clase: peligro ? 'btn-peligro' : 'btn-primario', auto: true },
    ],
  });
  return valor === 'si';
}

export async function pedirTexto({
  titulo,
  texto = '',
  etiqueta = 'Comentario',
  valor = '',
  multilinea = true,
  max = 200,
  textoOk = 'Enviar',
  requerido = false,
  peligro = false,
}) {
  const id = 'campo-dialogo-' + Math.random().toString(36).slice(2, 8);
  const campo = multilinea
    ? `<textarea id="${id}" class="campo-input" rows="4" maxlength="${max}" placeholder="${esc(etiqueta)}"></textarea>`
    : `<input id="${id}" class="campo-input" type="text" maxlength="${max}" placeholder="${esc(etiqueta)}" value="${esc(valor)}">`;
  const dlg = montarDialogo(
    `<div class="modal-caja">
      <header class="modal-encabezado">
        <h2 class="modal-titulo">${esc(titulo)}</h2>
        <button type="button" class="icon-btn modal-cerrar" aria-label="Cerrar">${icon('x')}</button>
      </header>
      <div class="modal-cuerpo">
        ${texto ? `<p class="modal-texto">${texto}</p>` : ''}
        <label class="campo" for="${id}">
          <span class="campo-etiqueta">${esc(etiqueta)}</span>
          ${campo}
          <span class="campo-ayuda"><span data-contador>0</span> / ${max} caracteres</span>
        </label>
        <p class="campo-error" data-error hidden></p>
      </div>
      <footer class="modal-acciones">
        <button type="button" class="btn btn-fantasma" data-no>Cancelar</button>
        <button type="button" class="btn ${peligro ? 'btn-peligro' : 'btn-primario'}" data-si>${esc(textoOk)}</button>
      </footer>
    </div>`,
    'modal'
  );
  const input = dlg.querySelector('#' + id);
  const contador = dlg.querySelector('[data-contador]');
  const error = dlg.querySelector('[data-error]');
  input.value = valor;
  const actualizar = () => {
    if (contador) contador.textContent = String(input.value.length);
    const falta = requerido && input.value.trim() === '';
    dlg.querySelector('[data-si]').disabled = falta;
    if (!falta && error) error.hidden = true;
  };
  input.addEventListener('input', actualizar);
  actualizar();
  input.focus();

  return new Promise((resolver) => {
    const cerrarCon = (v) => {
      if (dlg.open) dlg.close();
      resolver(v);
    };
    dlg.querySelector('[data-no]').addEventListener('click', () => cerrarCon(null));
    dlg.querySelector('.modal-cerrar').addEventListener('click', () => cerrarCon(null));
    dlg.querySelector('[data-si]').addEventListener('click', () => {
      const v = input.value.trim();
      if (requerido && !v) return;
      cerrarCon(v);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !multilinea) dlg.querySelector('[data-si]').click();
    });
    dlg.addEventListener('close', () => resolver(null), { once: true });
  });
}

/** Hoja inferior (bottom sheet). Devuelve { dlg, cuerpo, cerrar }. */
export function hoja({ titulo, html, clase = '' }) {
  const dlg = montarDialogo(
    `<div class="hoja-caja ${clase}">
      <div class="hoja-agarre" aria-hidden="true"></div>
      <header class="hoja-encabezado">
        <h2 class="modal-titulo">${esc(titulo)}</h2>
        <button type="button" class="icon-btn" aria-label="Cerrar">${icon('x')}</button>
      </header>
      <div class="hoja-cuerpo">${html || ''}</div>
    </div>`,
    'hoja'
  );
  const cerrar = () => { if (dlg.open) dlg.close(); };
  dlg.querySelector('.modal-cerrar, .hoja-encabezado .icon-btn').addEventListener('click', cerrar);
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) cerrar(); });
  return { dlg, cuerpo: dlg.querySelector('.hoja-cuerpo'), cerrar };
}

/* ---------- piezas de estado ---------- */

export function spinner(texto = 'Cargando…') {
  return `<div class="estado-carga" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><span>${esc(texto)}</span></div>`;
}

export function spinnerInline() {
  return '<span class="spinner spinner-chico" aria-hidden="true"></span>';
}

export function vacio(icono, titulo, texto, accion = '') {
  return `<div class="estado-vacio">
    <span class="estado-vacio-icono">${icon(icono)}</span>
    <h3>${esc(titulo)}</h3>
    ${texto ? `<p>${esc(texto)}</p>` : ''}
    ${accion}
  </div>`;
}

export function errorEstado(texto, accion = '') {
  return `<div class="estado-error">
    <span class="estado-vacio-icono">${icon('alert')}</span>
    <h3>Algo salió mal</h3>
    <p>${esc(texto)}</p>
    ${accion || '<button class="btn btn-secundario" data-reintentar>Reintentar</button>'}
  </div>`;
}

/* ---------- formatos y etiquetas ---------- */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fecha(valor) {
  if (!valor) return '';
  if (typeof valor === 'string' && /\d{1,2}\/\d{1,2}\/\d{4}/.test(valor)) return valor;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function fechaHora(valor) {
  if (!valor) return '';
  if (typeof valor === 'string' && /\d{1,2}:\d{2}/.test(valor) && /\//.test(valor)) return valor;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return `${fecha(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function hora(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const ESFUERZOS = {
  SIMPLE: { etiqueta: 'Simple', clase: 'esfuerzo-simple', color: 'var(--verde)' },
  MEDIO: { etiqueta: 'Medio', clase: 'esfuerzo-medio', color: 'var(--azul)' },
  ALTO: { etiqueta: 'Alto', clase: 'esfuerzo-alto', color: 'var(--naranja)' },
};

export function esfuerzo(nivel) {
  return ESFUERZOS[String(nivel || '').toUpperCase()] || ESFUERZOS.SIMPLE;
}

export function chipEsfuerzo(nivel, prefijo = 'Esfuerzo') {
  const e = esfuerzo(nivel);
  return `<span class="chip ${e.clase}">${esc(prefijo)} ${esc(e.etiqueta)}</span>`;
}

export const PRIORIDADES = {
  GENERAL: { etiqueta: 'Prioridad general', clase: 'prioridad-general' },
  PRIORITARIA: { etiqueta: 'Prioritaria', clase: 'prioridad-prioritaria' },
  URGENTE: { etiqueta: 'Urgente', clase: 'prioridad-urgente' },
};

export function prioridad(valor) {
  return PRIORIDADES[String(valor || '').toUpperCase()] || PRIORIDADES.GENERAL;
}

export const ESTADOS_PROPUESTA = {
  PENDIENTE: { etiqueta: 'Pendiente', clase: 'estado-pendiente' },
  ACEPTADA: { etiqueta: 'Aceptada', clase: 'estado-aceptada' },
  COMPLETADO: { etiqueta: 'Completado', clase: 'estado-completado' },
  RECHAZADA: { etiqueta: 'Rechazada', clase: 'estado-rechazada' },
  CANCELADA: { etiqueta: 'Cancelada', clase: 'estado-rechazada' },
};

export function estadoPropuesta(valor) {
  return ESTADOS_PROPUESTA[String(valor || '').toUpperCase()] || {
    etiqueta: String(valor || '—'),
    clase: 'estado-pendiente',
  };
}

export const ASUNTOS = {
  PREGUNTA: 'Pregunta',
  COMENTARIO: 'Comentario',
  CONTACTO: 'Contacto',
};

export function tituloDesdePublicacion(pub) {
  return pub?.titulo || 'Publicación';
}

export function idPublicacion(pub) {
  return pub?.id ?? pub?.publicacion_id ?? pub?.publicacionId ?? '';
}

export function idOferente(pub) {
  return pub?.oferente_id ?? pub?.oferenteId ?? pub?.usuario_id ?? pub?.usuarioId ?? '';
}

export function nombreOferente(pub) {
  return pub?.oferente_nombre ?? pub?.oferenteNombre ?? pub?.autor_nombre ?? 'Vecino de Switch';
}

export function urlImagen(valor) {
  if (!valor) return '';
  let url = String(valor);
  if (url.startsWith('/')) {
    const api = window.SWITCH_CONFIG.apiBase;
    url = api.replace(/\/api$/, '') + url;
  } else if (url.startsWith('http://') && window.location.protocol === 'https:') {
    const api = new URL(window.SWITCH_CONFIG.apiBase, window.location.href);
    const imagen = new URL(url);
    if (imagen.host === api.host) {
      imagen.protocol = 'https:';
      url = imagen.href;
    }
  }
  return url;
}

/** Devuelve el HTML de una imagen con placeholder accesible si falla. */
export function imagenPublicacion(pub, clase = 'pub-imagen', alto = 150) {
  const url = urlImagen(pub?.imagen_url ?? pub?.imagenUrl);
  const icono = iconoPorTitulo(pub?.titulo, pub?.tipo_item ?? pub?.tipoItem);
  const fallback = `<span class="pub-imagen-fallback" aria-hidden="true">
      <span class="pub-imagen-icono">${icon(icono)}</span>
      <span class="pub-imagen-marca">Switch P2P · Trueque colaborativo</span>
    </span>`;
  return `<div class="${clase}${url ? '' : ' pub-imagen-vacia'}" style="--alto-imagen:${alto}px">
    ${fallback}
    ${url ? `<img src="${esc(url)}" alt="Foto de ${esc(pub?.titulo || 'la publicación')}" loading="lazy" decoding="async" onerror="this.remove()">` : ''}
  </div>`;
}

function iconoPorTitulo(titulo, tipo) {
  const t = String(titulo || '').toLowerCase();
  if (/libro|manual|cuento|revista/.test(t)) return 'mailopen';
  if (/herramienta|taladro|destornillador|llave|pintura/.test(t)) return 'sliders';
  if (/ropa|campera|abrigo|pantal|remera/.test(t)) return 'gift';
  if (/bici|moto|auto|monopat/.test(t)) return 'refresh';
  if (/clase|curso|taller|servicio|reparaci/.test(t) || String(tipo).toUpperCase() === 'SERVICIO') return 'sparkles';
  return 'gift';
}

export function debounce(fn, ms = 400) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function scrollArriba() {
  const main = document.getElementById('contenido');
  if (main) main.scrollTo({ top: 0, behavior: 'instant' in main.scrollTo ? 'instant' : 'auto' });
}

export function enfocar(selector, raiz = document) {
  const el = raiz.querySelector(selector);
  if (el && el.focus) {
    try { el.focus({ preventScroll: false }); } catch (e) {}
  }
  return el;
}

export function cerrarTodosLosDialogos() {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
}

export function cargarBoton(boton, textoCargando) {
  if (!boton) return () => {};
  const original = boton.innerHTML;
  boton.disabled = true;
  boton.classList.add('cargando');
  boton.innerHTML = `${spinnerInline()} <span>${esc(textoCargando)}</span>`;
  return () => {
    boton.innerHTML = original;
    boton.disabled = false;
    boton.classList.remove('cargando');
  };
}
