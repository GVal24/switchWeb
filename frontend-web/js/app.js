/* Arranque de la PWA: armazón, navegación, rutas y servicio de fondo. */

import { Store } from './store.js';
import { API } from './api.js';
import {
  icon,
  logo,
  esc,
  toast,
  dialogo,
  confirmar,
  cargarBoton,
  cerrarTodosLosDialogos,
} from './ui.js';
import {
  definirRuta,
  iniciarRouter,
  navegar,
  volver,
  refrescarRuta,
  rutaActual,
} from './router.js';

const app = document.getElementById('app');
const main = document.getElementById('contenido');
const nav = document.getElementById('bottomnav');
const banner = document.getElementById('banner-suspension');

const PESTANAS = [
  { ruta: '/voluntariado', icono: 'heart', etiqueta: 'Voluntariado' },
  { ruta: '/catalogo', icono: 'search', etiqueta: 'Catálogo' },
  { ruta: '/perfil', icono: 'user', etiqueta: 'Mi perfil' },
  { ruta: '/accesibilidad', icono: 'accessibility', etiqueta: 'Accesibilidad' },
  { ruta: '/contacto', icono: 'mail', etiqueta: 'Contacto' },
  { ruta: '/admin', icono: 'shield', etiqueta: 'Admin' },
];

const TITULOS = {
  '/voluntariado': ['Voluntariado', 'Instituciones y necesidades'],
  '/catalogo': ['Catálogo P2P', 'Trueques de la comunidad'],
  '/perfil': ['Mi perfil', 'Impacto y reputación'],
  '/accesibilidad': ['Accesibilidad', 'Tu experiencia, a tu manera'],
  '/contacto': ['Contacto', 'Escribinos'],
  '/admin': ['Administración', 'Panel de control'],
  '/login': ['Ingresar', 'Tu cuenta de Switch'],
  '/registro': ['Crear cuenta', 'Sumate a la comunidad'],
  '/detalle': ['Publicación', 'Detalle del trueque'],
  '/publicar': ['Publicar', 'Nuevo trueque'],
  '/trueques': ['Mis trueques', 'Propuestas y confirmaciones'],
  '/chat': ['Conversación', 'Coordinen el trueque'],
  '/qr': ['Escanear QR', 'Validar presencia'],
  '/instituciones/registro': ['Sumar institución', 'Nuevo punto de voluntariado'],
  '/admin/moderacion': ['Moderación', 'Publicaciones pendientes'],
  '/admin/reportes': ['Denuncias', 'Reportes de la comunidad'],
  '/admin/bloqueados': ['Cuentas bloqueadas', 'Suspensiones y bajas'],
  '/admin/contacto': ['Bandeja de entrada', 'Mensajes de la comunidad'],
  '/admin/sugerencias': ['Sugerencias', 'Clasificación de esfuerzo'],
};

let appbar = null;
let btnVolver = null;
let tituloEl = null;
let subtituloEl = null;
let botonAdminNav = null;
let contadoresAdmin = 0;
let timerContadores = null;

/* ---------- armazón ---------- */

function construirBarra() {
  appbar = document.createElement('header');
  appbar.className = 'appbar';
  appbar.innerHTML = `
    <button type="button" class="icon-btn" id="btn-volver" aria-label="Volver" hidden>${icon('back')}</button>
    <button type="button" class="appbar-marca" id="btn-marca" aria-label="Ir al voluntariado">
      ${logo(34)}
      <span>
        <span class="appbar-titulo" id="appbar-titulo">Switch</span>
        <span class="appbar-subtitulo" id="appbar-subtitulo">Voluntariado</span>
      </span>
    </button>
    <div class="appbar-acciones">
      <button type="button" class="icon-btn" id="btn-ayuda" aria-label="Escribinos" title="Escribinos">${icon('mail')}</button>
      <button type="button" class="icon-btn" id="btn-a11y" aria-label="Opciones de accesibilidad" title="Accesibilidad">${icon('accessibility')}</button>
    </div>
  `;
  app.insertBefore(appbar, banner.nextSibling);

  btnVolver = appbar.querySelector('#btn-volver');
  tituloEl = appbar.querySelector('#appbar-titulo');
  subtituloEl = appbar.querySelector('#appbar-subtitulo');

  btnVolver.addEventListener('click', () => {
    const meta = rutaActual();
    if (meta?.seccion) volver(meta.seccion);
    else volver();
  });
  appbar.querySelector('#btn-marca').addEventListener('click', () => navegar('/voluntariado'));
  appbar.querySelector('#btn-ayuda').addEventListener('click', () => navegar('/contacto'));
  appbar.querySelector('#btn-a11y').addEventListener('click', () => navegar('/accesibilidad'));
}

function construirNavegacion() {
  nav.innerHTML = PESTANAS.map(
    (p) => `<button type="button" class="nav-item" data-ruta="${p.ruta}" aria-label="${esc(p.etiqueta)}">
      ${icon(p.icono)}
      <span>${esc(p.etiqueta)}</span>
    </button>`
  ).join('');

  nav.querySelectorAll('.nav-item').forEach((boton) => {
    boton.addEventListener('click', () => {
      const ruta = boton.dataset.ruta;
      if (ruta === '/admin' && !Store.esAdmin) {
        pedirAdmin().then((ok) => {
          if (ok) {
            navegar('/admin');
            actualizarShell();
          }
        });
        return;
      }
      navegar(ruta);
    });
  });

  botonAdminNav = nav.querySelector('[data-ruta="/admin"]');
}

function actualizarBarra(meta) {
  if (!meta) return;
  const clave = meta.camino.match(/^\/admin\/[^/]+$/)
    ? meta.camino
    : meta.camino.startsWith('/detalle')
      ? '/detalle'
      : meta.camino.startsWith('/chat')
        ? '/chat'
        : meta.camino;
  const par = TITULOS[clave] || ['Switch', 'Trueques y voluntariado'];
  let titulo = par[0];
  let subtitulo = par[1];

  if (meta.camino === '/perfil' && Store.sesionActiva) {
    titulo = Store.usuario?.nombreCompleto || 'Mi perfil';
  }
  if (meta.camino === '/chat' && meta.query?.get('nombre')) {
    titulo = meta.query.get('nombre');
    subtitulo = 'Conversación';
  }
  if (meta.camino === '/detalle' && meta.query?.get('titulo')) {
    subtitulo = meta.query.get('titulo');
  }

  tituloEl.textContent = titulo;
  subtituloEl.textContent = subtitulo;

  const mostrarVolver = !!meta.volver;
  btnVolver.hidden = !mostrarVolver;
  appbar.classList.toggle('con-volver', mostrarVolver);

  document.title = `Switch · ${titulo}`;

  actualizarNavegacion(meta.seccion);
}

function actualizarNavegacion(seccion) {
  nav.querySelectorAll('.nav-item').forEach((boton) => {
    const activo = boton.dataset.ruta === seccion;
    boton.classList.toggle('activo', activo);
    if (activo) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  });
}

function actualizarBanderaSuspension() {
  if (!banner) return;
  if (!Store.suspendido || !Store.sesionActiva) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  const hasta = Store.usuario?.suspendidoHasta;
  banner.hidden = false;
  banner.innerHTML = `${icon('alert')}
    <span><strong>Cuenta suspendida.</strong> Podés recorrer la plataforma, pero no publicar, proponer trueques ni escribir por chat.${hasta ? ` Hasta el ${esc(hasta)}.` : ''}</span>`;
  banner.onclick = () => {
    dialogo({
      titulo: 'Cuenta suspendida',
      icono: 'alert',
      html: `<p class="modal-texto">
        ${hasta ? `La suspensión vence el <strong>${esc(hasta)}</strong>.` : 'Tu cuenta está suspendida por una penalización.'}
      </p>
      <p class="modal-texto">Durante la penalización podés entrar y recorrer la plataforma: ver el catálogo,
      las instituciones, tu perfil, tus publicaciones, tus propuestas y leer tus conversaciones.</p>
      <p class="modal-texto">No podés publicar, subir imágenes, proponer, aceptar ni rechazar trueques,
      escribir por chat, escanear el QR de una institución ni denunciar a otro usuario.</p>`,
      acciones: [{ texto: 'Entendido', valor: 'ok', clase: 'btn-primario', auto: true }],
    });
  };
}

function actualizarBadgeAdmin(total) {
  if (!botonAdminNav) return;
  let badge = botonAdminNav.querySelector('.badge-num');
  if (!total) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'badge-num';
    botonAdminNav.appendChild(badge);
  }
  badge.textContent = total > 99 ? '99+' : String(total);
  badge.setAttribute('aria-label', `${total} pendientes de administración`);
}

async function actualizarContadoresAdmin() {
  if (!Store.esAdmin) {
    actualizarBadgeAdmin(0);
    return;
  }
  const [moderacion, contacto, panel] = await Promise.allSettled([
    API.adminModeracionStats(),
    API.adminContactoPendientes(),
    API.adminEstadisticas(),
  ]);
  const mod = moderacion.status === 'fulfilled' ? Number(moderacion.value?.pendientes || 0) : 0;
  const con = contacto.status === 'fulfilled' ? Number(contacto.value || 0) : 0;
  const rep = panel.status === 'fulfilled' ? Number(panel.value?.reportesPendientes || 0) : 0;
  contadoresAdmin = mod + con + rep;
  actualizarBadgeAdmin(contadoresAdmin);
}

function actualizarShell() {
  actualizarBanderaSuspension();
  const meta = rutaActual();
  if (meta) actualizarBarra(meta);
  if (Store.esAdmin) {
    clearTimeout(timerContadores);
    timerContadores = setTimeout(actualizarContadoresAdmin, 400);
  } else {
    actualizarBadgeAdmin(0);
  }
}

/* ---------- login de administración ---------- */

function formularioAdmin(error = '') {
  return `
    <p class="modal-texto">Ingresá con tu cuenta de administración. Esta sesión es independiente
    de tu cuenta de vecino y se cierra al cerrar el navegador.</p>
    ${error ? `<div class="banner banner-peligro">${icon('alert')}<span>${esc(error)}</span></div>` : ''}
    <label class="campo">
      <span class="campo-etiqueta">DNI <span class="req">*</span></span>
      <input class="campo-input" id="admin-dni" inputmode="numeric" autocomplete="username" maxlength="9" placeholder="Sin puntos">
    </label>
    <label class="campo">
      <span class="campo-etiqueta">Contraseña <span class="req">*</span></span>
      <input class="campo-input" id="admin-pass" type="password" autocomplete="current-password" placeholder="Tu contraseña">
    </label>
    <p class="campo-ayuda">Solo cuentas con rol ADMIN pueden entrar al panel.</p>
  `;
}

function pedirAdmin() {
  return new Promise((resolver) => {
    if (Store.esAdmin) return resolver(true);
    let dlg = null;
    let cerrado = false;

    const abrir = (error = '') => {
      if (dlg) dlg.remove();
      dlg = document.createElement('dialog');
      dlg.className = 'modal';
      dlg.innerHTML = `
        <form class="modal-caja" method="dialog" novalidate>
          <header class="modal-encabezado">
            <span class="modal-icono">${icon('shield')}</span>
            <h2 class="modal-titulo">Acceso de administración</h2>
            <button type="button" class="icon-btn modal-cerrar" aria-label="Cerrar">${icon('x')}</button>
          </header>
          <div class="modal-cuerpo" data-cuerpo>${formularioAdmin(error)}</div>
          <footer class="modal-acciones">
            <button type="button" class="btn btn-fantasma" data-cancelar>Cancelar</button>
            <button type="submit" class="btn btn-primario" data-entrar>Entrar al panel</button>
          </footer>
        </form>`;
      document.getElementById('dialog-root').appendChild(dlg);
      dlg.showModal();

      const cerrar = (valor) => {
        if (cerrado) return;
        cerrado = true;
        if (dlg?.open) dlg.close();
        dlg?.remove();
        resolver(valor);
      };

      dlg.querySelector('.modal-cerrar').addEventListener('click', () => cerrar(false));
      dlg.querySelector('[data-cancelar]').addEventListener('click', () => cerrar(false));
      dlg.addEventListener('cancel', (ev) => {
        ev.preventDefault();
        cerrar(false);
      });

      dlg.querySelector('form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const dni = dlg.querySelector('#admin-dni').value.trim();
        const password = dlg.querySelector('#admin-pass').value;
        if (!dni || !password) {
          abrir('Ingresá DNI y contraseña.');
          return;
        }
        const boton = dlg.querySelector('[data-entrar]');
        const restaurar = cargarBoton(boton, 'Verificando…');
        try {
          const datos = await API.login(dni, password);
          if (datos.rol !== 'ADMIN') {
            abrir('Esta cuenta no tiene permisos de administración.');
            return;
          }
          Store.guardarAdminToken(datos.token);
          toast('Acceso de administración concedido.', 'exito');
          cerrar(true);
        } catch (e) {
          restaurar();
          abrir(e?.message || 'No pudimos iniciar sesión. Probá de nuevo.');
        }
      });

      setTimeout(() => dlg.querySelector('#admin-dni')?.focus(), 60);
    };

    abrir();
  });
}

function cerrarAdmin() {
  Store.cerrarAdmin();
  actualizarBadgeAdmin(0);
  toast('Sesión de administración cerrada.', 'info');
  navegar('/perfil', { reemplazar: true });
}

/* ---------- rutas ---------- */

function registrarRutas() {
  definirRuta('/voluntariado', () => import('./screens/voluntariado.js'), {
    seccion: '/voluntariado',
    titulo: 'Voluntariado',
    volver: false,
  });
  definirRuta('/catalogo', () => import('./screens/catalogo.js'), {
    seccion: '/catalogo',
    titulo: 'Catálogo P2P',
    volver: false,
  });
  definirRuta('/perfil', () => import('./screens/perfil.js'), {
    seccion: '/perfil',
    titulo: 'Mi perfil',
    volver: false,
  });
  definirRuta('/accesibilidad', () => import('./screens/accesibilidad.js'), {
    seccion: '/accesibilidad',
    titulo: 'Accesibilidad',
    volver: false,
  });
  definirRuta('/contacto', () => import('./screens/contacto.js'), {
    seccion: '/contacto',
    titulo: 'Contacto',
    volver: false,
  });
  definirRuta('/login', () => import('./screens/login.js'), { titulo: 'Ingresar' });
  definirRuta('/registro', () => import('./screens/registro.js'), { titulo: 'Crear cuenta' });
  definirRuta('/detalle/:id', () => import('./screens/detalle.js'), {
    seccion: '/catalogo',
    titulo: 'Publicación',
  });
  definirRuta('/publicar', () => import('./screens/crear-publicacion.js'), {
    requiereSesion: true,
    titulo: 'Publicar',
  });
  definirRuta('/trueques', () => import('./screens/trueques.js'), {
    requiereSesion: true,
    seccion: '/perfil',
    titulo: 'Mis trueques',
  });
  definirRuta('/chat/:receptorId', () => import('./screens/chat.js'), {
    requiereSesion: true,
    titulo: 'Conversación',
  });
  definirRuta('/qr', () => import('./screens/qr.js'), {
    requiereSesion: true,
    titulo: 'Escanear QR',
  });
  definirRuta('/instituciones/registro', () => import('./screens/registro-institucion.js'), {
    seccion: '/voluntariado',
    titulo: 'Sumar institución',
  });
  definirRuta('/admin', () => import('./screens/admin/dashboard.js'), {
    requiereAdmin: true,
    seccion: '/admin',
    titulo: 'Administración',
    volver: false,
  });
  definirRuta('/admin/moderacion', () => import('./screens/admin/moderacion.js'), {
    requiereAdmin: true,
    seccion: '/admin',
    titulo: 'Moderación',
  });
  definirRuta('/admin/reportes', () => import('./screens/admin/reportes.js'), {
    requiereAdmin: true,
    seccion: '/admin',
    titulo: 'Denuncias',
  });
  definirRuta('/admin/bloqueados', () => import('./screens/admin/bloqueados.js'), {
    requiereAdmin: true,
    seccion: '/admin',
    titulo: 'Cuentas bloqueadas',
  });
  definirRuta('/admin/contacto', () => import('./screens/admin/contacto-admin.js'), {
    requiereAdmin: true,
    seccion: '/admin',
    titulo: 'Bandeja de entrada',
  });
  definirRuta('/admin/sugerencias', () => import('./screens/admin/sugerencias.js'), {
    requiereAdmin: true,
    seccion: '/admin',
    titulo: 'Sugerencias',
  });
}

/* ---------- sesión ---------- */

async function validarSesion() {
  if (!Store.sesionActiva) return;
  try {
    const perfil = await API.perfil();
    Store.guardarSesion({ ...Store.usuario, ...perfil, token: Store.token });
    actualizarShell();
  } catch (e) {
    if (e?.estado === 401 || e?.estado === 403) {
      Store.borrarSesion();
      actualizarShell();
      if (rutaActual()?.ruta?.requiereSesion) {
        toast('Tu sesión venció. Ingresá de nuevo.', 'info');
        navegar('/login');
      }
    }
  }
}

/* ---------- service worker ---------- */

async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registro = await navigator.serviceWorker.register('sw.js');
    registro.addEventListener('updatefound', () => {
      const nuevo = registro.installing;
      if (!nuevo) return;
      nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Hay una versión nueva de Switch. Cerrá y abrí la app para actualizarla.', 'info', 7000);
        }
      });
    });
  } catch (e) {
    console.warn('No se pudo registrar el service worker:', e);
  }
}

/* ---------- arranque ---------- */

function conectarEventos() {
  document.addEventListener('switch:sesion', () => {
    actualizarShell();
    refrescarRuta();
  });
  document.addEventListener('switch:admin', () => {
    actualizarShell();
  });

  window.addEventListener('online', () => toast('Volviste a estar en línea.', 'exito', 2400));
  window.addEventListener('offline', () => toast('Sin conexión. Algunas acciones van a fallar.', 'error', 5000));

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      const abierto = document.querySelector('dialog[open]');
      if (!abierto && rutaActual()?.volver) {
        btnVolver?.click();
      }
    }
  });
}

function iniciar() {
  Store.cargarAccesibilidad();
  Store.cargarSesion();
  Store.aplicarAccesibilidad();

  construirBarra();
  construirNavegacion();
  registrarRutas();
  conectarEventos();

  iniciarRouter({
    contenedor: main,
    alNavegar: actualizarBarra,
    pedirAdmin,
    alError: () => actualizarBadgeAdmin(contadoresAdmin),
  });

  actualizarShell();
  validarSesion();
  registrarServiceWorker();
}

window.__switchCerrarAdmin = cerrarAdmin;
window.__switchPedirAdmin = pedirAdmin;
window.__switchActualizarShell = actualizarShell;

iniciar();
