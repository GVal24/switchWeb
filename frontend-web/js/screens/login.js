/* Ingreso de vecinos y vecinas. El acceso de administración está en la
   pestaña Admin del armazón. */

import { Store } from '../store.js';
import { API } from '../api.js';
import {
  icon,
  logo,
  esc,
  avatar,
  toast,
  dialogo,
  cargarBoton,
} from '../ui.js';
import { navegar } from '../router.js';

export async function render(contenedor, ctx) {
  if (Store.sesionActiva) {
    pintarSesion(contenedor);
    return;
  }

  const destino = ctx.query.get('volver') || '';
  const volverA = destino.startsWith('#') ? destino : '/perfil';

  contenedor.innerHTML = `
    <section class="pantalla pantalla-login">
      <div class="login-hero">
        <div class="login-isotipo">${logo(46)}</div>
        <h1 class="login-titulo">Switch</h1>
        <p class="login-bajada">Trueques y voluntariado entre vecinos. Lo que te sobra puede ser justo lo que otro necesita.</p>
      </div>

      <div class="login-tarjeta card">
        <div class="login-pestanas" role="tablist" aria-label="Acceso">
          <button type="button" role="tab" aria-selected="true" tabindex="0">Ingresar</button>
          <button type="button" role="tab" aria-selected="false" tabindex="-1" data-ir-registro>Crear cuenta</button>
        </div>

        <form id="form-login" novalidate>
          <p class="campo-error" id="login-error" role="alert" hidden></p>

          <label class="campo" for="login-dni">
            <span class="campo-etiqueta">DNI <span class="req">*</span></span>
            <input class="campo-input" id="login-dni" name="dni" inputmode="numeric" autocomplete="username" maxlength="9" placeholder="Sin puntos" required>
          </label>

          <label class="campo" for="login-pass">
            <span class="campo-etiqueta">Contraseña <span class="req">*</span></span>
            <span class="campo-con-icono">
              <input class="campo-input" id="login-pass" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required>
              <button type="button" class="icon-btn" id="ver-pass" aria-label="Mostrar contraseña">${icon('eye')}</button>
            </span>
          </label>

          <button type="submit" class="btn btn-primario btn-block btn-lg">Ingresar</button>

          <div class="login-seguro">${icon('lock')}<span>Tus datos viajan cifrados. La contraseña nunca se muestra a nadie.</span></div>
        </form>

        <p class="login-pie">
          <button type="button" data-ver="terminos">Términos y Condiciones</button>
          ·
          <button type="button" data-ver="privacidad">Política de Privacidad</button>
          <br>
          ¿Olvidaste tu contraseña? <button type="button" data-ir-reset>Recuperarla</button>
        </p>
      </div>

      <div class="login-seguro" style="justify-content:center;margin-top:1rem">
        ${icon('shield')}
        <span>¿Sos parte de la administración? <button type="button" class="btn-texto" data-admin>Entrá al panel</button></span>
      </div>

      <p class="login-pie" style="margin-top:0.8rem">
        El registro es exclusivo para personas mayores de 18 años.
      </p>
    </section>
  `;

  const form = contenedor.querySelector('#form-login');
  const errorEl = contenedor.querySelector('#login-error');
  const inputDni = contenedor.querySelector('#login-dni');
  const inputPass = contenedor.querySelector('#login-pass');

  const mostrarError = (texto) => {
    errorEl.textContent = texto;
    errorEl.hidden = !texto;
  };

  contenedor.querySelector('#ver-pass').addEventListener('click', (ev) => {
    const boton = ev.currentTarget;
    const visible = inputPass.type === 'text';
    inputPass.type = visible ? 'password' : 'text';
    boton.innerHTML = icon(visible ? 'eye' : 'eyeoff');
    boton.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
    inputPass.focus();
  });

  contenedor.querySelector('[data-ir-registro]').addEventListener('click', () => navegar('/registro'));
  contenedor.querySelector('[data-ir-reset]').addEventListener('click', recuperarPassword);
  contenedor.querySelectorAll('[data-ver]').forEach((b) =>
    b.addEventListener('click', () => verLegal(b.dataset.ver))
  );
  contenedor.querySelector('[data-admin]').addEventListener('click', async () => {
    const ok = await window.__switchPedirAdmin?.();
    if (ok) {
      document.dispatchEvent(new CustomEvent('switch:admin'));
      window.__switchActualizarShell?.();
      navegar('/admin');
    }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mostrarError('');
    const dni = inputDni.value.replace(/\D/g, '');
    const password = inputPass.value;

    if (!dni) {
      mostrarError('Ingresá tu DNI.');
      inputDni.focus();
      return;
    }
    if (!password) {
      mostrarError('Ingresá tu contraseña.');
      inputPass.focus();
      return;
    }

    const boton = form.querySelector('button[type="submit"]');
    const restaurar = cargarBoton(boton, 'Ingresando…');
    try {
      const datos = await API.login(dni, password);

      if (datos.rol === 'ADMIN') {
        Store.guardarAdminToken(datos.token);
        document.dispatchEvent(new CustomEvent('switch:admin'));
        toast('Acceso de administración concedido.', 'exito');
        navegar('/admin', { reemplazar: true });
        return;
      }

      Store.guardarSesion(datos);
      document.dispatchEvent(new CustomEvent('switch:sesion'));
      toast(datos.mensaje || `¡Hola de nuevo, ${datos.nombre || 'vecino/a'}!`, 'exito');
      navegar(volverA, { reemplazar: true });
    } catch (e) {
      restaurar();
      mostrarError(e?.message || 'No pudimos ingresar. Probá de nuevo.');
      anunciarError(errorEl);
    }
  });
}

async function recuperarPassword() {
  const dniIngresado = await pedirDatoReset({
    titulo: 'Recuperar contraseña',
    etiqueta: 'DNI',
    tipo: 'text',
    inputmode: 'numeric',
    ayuda: 'Te enviaremos un código al teléfono asociado a tu cuenta.',
    autocompletar: 'username',
  });
  if (dniIngresado === null) return;

  const dni = dniIngresado.replace(/\D/g, '');
  if (dni.length !== 8) {
    toast('Ingresá un DNI válido de 8 dígitos.', 'aviso');
    return;
  }

  try {
    const solicitud = await API.solicitarResetPassword({ dni });
    if (solicitud.codigoMock) {
      toast(`Modo de prueba: el código es ${solicitud.codigoMock}.`, 'info');
    }

    const codigo = await pedirDatoReset({
      titulo: 'Verificar teléfono',
      etiqueta: 'Código de 6 dígitos',
      tipo: 'text',
      inputmode: 'numeric',
      ayuda: 'Si el DNI está registrado, enviamos un código al teléfono asociado.',
      autocompletar: 'one-time-code',
      maxLength: 6,
    });
    if (codigo === null) return;

    const verificacion = await API.verificarResetPassword({
      dni,
      codigo: codigo.replace(/\D/g, ''),
    });
    const nuevaPassword = await pedirDatoReset({
      titulo: 'Elegir contraseña nueva',
      etiqueta: 'Nueva contraseña (mínimo 6 caracteres)',
      tipo: 'password',
      autocompletar: 'new-password',
    });
    if (nuevaPassword === null) return;
    if (nuevaPassword.length < 6) {
      toast('La contraseña debe tener al menos 6 caracteres.', 'aviso');
      return;
    }

    const confirmacion = await pedirDatoReset({
      titulo: 'Confirmar contraseña',
      etiqueta: 'Repetí la contraseña nueva',
      tipo: 'password',
      autocompletar: 'new-password',
    });
    if (confirmacion === null) return;
    if (confirmacion !== nuevaPassword) {
      toast('Las contraseñas no coinciden.', 'aviso');
      return;
    }

    await API.confirmarResetPassword({
      token: verificacion.token,
      nuevaPassword,
    });
    toast('Contraseña actualizada. Ya podés ingresar.', 'exito');
  } catch (e) {
    toast(e?.message || 'No pudimos restablecer la contraseña. Probá de nuevo.', 'error');
  }
}

let contadorDialogosReset = 0;

function pedirDatoReset({
  titulo,
  etiqueta,
  tipo = 'text',
  inputmode,
  ayuda,
  autocompletar = 'off',
  maxLength = 100,
}) {
  const id = `reset-dato-${++contadorDialogosReset}`;
  const tipoInput = tipo === 'password' ? 'password' : 'text';
  const modal = dialogo({
    titulo,
    icono: 'lock',
    html: `<p class="modal-texto">${esc(ayuda || '')}</p>
      <label class="campo" for="${id}">
        <span class="campo-etiqueta">${esc(etiqueta)}</span>
        <input class="campo-input" id="${id}" type="${tipoInput}"
          ${inputmode ? `inputmode="${inputmode}"` : ''}
          autocomplete="${autocompletar}" maxlength="${maxLength}" required>
      </label>`,
    acciones: [
      { texto: 'Cancelar', valor: 'cancelar', clase: 'btn-fantasma' },
      { texto: 'Continuar', valor: 'continuar', clase: 'btn-primario', auto: true },
    ],
  });
  const campo = document.getElementById(id);
  campo?.focus();
  return modal.then((accion) => (accion === 'continuar' ? campo?.value ?? '' : null));
}

function anunciarError(el) {
  el.hidden = false;
  el.setAttribute('tabindex', '-1');
  el.focus();
}

function pintarSesion(contenedor) {
  const u = Store.usuario || {};
  const nombre = u.nombreCompleto || 'Vecino de Switch';
  contenedor.innerHTML = `
    <section class="pantalla pantalla-login">
      <div class="login-hero">
        <div class="login-isotipo">${logo(46)}</div>
        <h1 class="login-titulo">Ya estás dentro</h1>
        <p class="login-bajada">Sesión iniciada como ${esc(nombre)}.</p>
      </div>
      <div class="login-tarjeta card">
        <div class="fila" style="gap:0.7rem;margin-bottom:0.8rem">
          ${avatar(nombre, 'avatar-lg')}
          <div class="crece">
            <p class="negrita">${esc(nombre)}</p>
            <p class="texto-suave texto-chico">DNI ${esc(u.dni || '—')} · ${esc(u.rol === 'ADMIN' ? 'Administración' : 'Vecino/a')}</p>
          </div>
        </div>
        <div class="banner banner-exito">${icon('checkcircle')}<div><strong>Sesión activa</strong><p>Podés publicar, proponer trueques y escribir por chat.</p></div></div>
        <button type="button" class="btn btn-primario btn-block" data-perfil>Ir a mi perfil</button>
        <button type="button" class="btn btn-secundario btn-block mt-1" data-catalogo>Explorar el catálogo</button>
        <button type="button" class="btn btn-fantasma btn-block mt-1" data-salir>Cerrar sesión</button>
      </div>
    </section>
  `;

  contenedor.querySelector('[data-perfil]').addEventListener('click', () => navegar('/perfil'));
  contenedor.querySelector('[data-catalogo]').addEventListener('click', () => navegar('/catalogo'));
  contenedor.querySelector('[data-salir]').addEventListener('click', () => {
    Store.cerrarSesion();
    document.dispatchEvent(new CustomEvent('switch:sesion'));
    toast('Cerraste sesión. ¡Hasta pronto!', 'info');
    navegar('/voluntariado', { reemplazar: true });
  });
}

export async function verLegal(id) {
  dialogo({
    titulo: 'Documento legal',
    html: `<div class="estado-carga"><span class="spinner" aria-hidden="true"></span><span>Cargando documento…</span></div>`,
    acciones: [{ texto: 'Cerrar', valor: 'ok', clase: 'btn-secundario' }],
  });
  const raiz = document.getElementById('dialog-root');
  try {
    const doc = await API.legal(id);
    const cuerpo = (doc.secciones || [])
      .map(
        (s) => `<h3>${esc(s.titulo)}</h3>${(s.cuerpo || [])
          .map((p) => `<p>${esc(p)}</p>`)
          .join('')}`
      )
      .join('');
    const abierto = raiz.querySelector('dialog[open] .modal-cuerpo');
    if (abierto) {
      abierto.innerHTML = `
        <p class="campo-ayuda">Versión ${esc(doc.version || '—')} · Vigente desde ${esc(doc.vigenteDesde || '—')}</p>
        <div class="terminos-caja" style="max-height:none">
          <p>${esc(doc.intro || '')}</p>
          ${cuerpo}
        </div>`;
      const titulo = raiz.querySelector('dialog[open] .modal-titulo');
      if (titulo) titulo.textContent = doc.titulo || 'Documento legal';
    }
  } catch (e) {
    const abierto = raiz.querySelector('dialog[open] .modal-cuerpo');
    if (abierto) {
      abierto.innerHTML = `<div class="banner banner-peligro">${icon('alert')}<span>${esc(
        e?.message || 'No pudimos cargar el documento. Revisá tu conexión.'
      )}</span></div>`;
    }
  }
}
