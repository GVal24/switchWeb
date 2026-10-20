/* Registro de vecinos y vecinas: datos -> código al teléfono -> aceptación
   de los documentos legales. */

import { Store } from '../store.js';
import { API } from '../api.js';
import { icon, logo, esc, toast, cargarBoton } from '../ui.js';
import { navegar } from '../router.js';
import { verLegal } from './login.js';

const PASOS = [
  { n: 1, texto: 'Tus datos' },
  { n: 2, texto: 'Verificación' },
  { n: 3, texto: 'Acuerdos' },
];

export async function render(contenedor) {
  if (Store.sesionActiva) {
    toast('Ya tenés una sesión iniciada.', 'info');
    navegar('/perfil', { reemplazar: true });
    return;
  }

  const estado = {
    paso: 1,
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    password: '',
    telefonoVerificado: '',
    tokenVerificacion: '',
    codigoMock: '',
    expiraEn: null,
    finCooldown: 0,
  };

  let temporizador = null;

  contenedor.innerHTML = `
    <section class="pantalla pantalla-login" style="justify-content:flex-start;padding-top:0.5rem">
      <div class="login-hero" style="margin-bottom:0.6rem">
        <div class="login-isotipo" style="width:2.7rem;height:2.7rem">${logo(34)}</div>
        <h1 class="login-titulo" style="font-size:1.35rem">Crear cuenta</h1>
        <p class="login-bajada">Unite a la red de intercambio y voluntariado de tu barrio.</p>
      </div>

      <div class="login-tarjeta card">
        <ol class="pasos" aria-label="Pasos del registro">
          ${PASOS.map(
            (p, i) => `
            ${i ? '<li class="paso-sep" aria-hidden="true"></li>' : ''}
            <li class="paso" data-paso="${p.n}">
              <span class="paso-num">${p.n}</span>
              <span>${p.texto}</span>
            </li>`
          ).join('')}
        </ol>
        <div id="reg-cuerpo"></div>
      </div>

      <p class="login-pie" style="margin-top:0.8rem">
        ¿Ya tenés cuenta? <button type="button" data-ingresar>Ingresá</button>
      </p>
      <p class="login-pie" style="margin-top:0">
        ¿Representás una institución? <button type="button" data-inst>Registrala acá</button>
      </p>
    </section>
  `;

  const cuerpo = contenedor.querySelector('#reg-cuerpo');

  contenedor.querySelector('[data-ingresar]').addEventListener('click', () => navegar('/login'));
  contenedor.querySelector('[data-inst]').addEventListener('click', () =>
    navegar('/instituciones/registro')
  );

  const marcarPasos = () => {
    contenedor.querySelectorAll('.paso').forEach((li) => {
      const n = Number(li.dataset.paso);
      li.classList.toggle('activo', n === estado.paso);
      li.classList.toggle('listo', n < estado.paso);
      const num = li.querySelector('.paso-num');
      if (n < estado.paso) num.innerHTML = icon('check');
      else num.textContent = String(n);
    });
  };

  const irAPaso = (n) => {
    estado.paso = n;
    marcarPasos();
    pintar();
    cuerpo.querySelector('input, button')?.focus();
  };

  const errorDe = (texto) => {
    const el = cuerpo.querySelector('[data-error]');
    if (!el) return;
    el.textContent = texto || '';
    el.hidden = !texto;
    if (texto) {
      el.setAttribute('tabindex', '-1');
      el.focus();
    }
  };

  const actualizarReenvio = () => {
    const boton = cuerpo.querySelector('[data-reenviar]');
    if (!boton) return;
    const restan = Math.ceil((estado.finCooldown - Date.now()) / 1000);
    if (restan > 0) {
      boton.disabled = true;
      boton.textContent = `Reenviar en ${restan}s`;
    } else {
      boton.disabled = false;
      boton.textContent = 'Reenviar código';
      if (temporizador) {
        clearInterval(temporizador);
        temporizador = null;
      }
    }
  };

  const arrancarCooldown = (segundos = 45) => {
    estado.finCooldown = Date.now() + segundos * 1000;
    if (temporizador) clearInterval(temporizador);
    temporizador = setInterval(actualizarReenvio, 1000);
    actualizarReenvio();
  };

  async function enviarCodigo({ reenvio = false } = {}) {
    const boton = cuerpo.querySelector('[data-enviar]') || cuerpo.querySelector('[data-reenviar]');
    const restaurar = cargarBoton(boton, reenvio ? 'Reenviando…' : 'Enviando…');
    try {
      const res = await API.pedirOtp(estado.telefono);
      const info = res.datos || {};
      estado.codigoMock = info.codigoMock || '';
      estado.expiraEn = info.expiraEn || null;
      arrancarCooldown(45);
      estado.paso = 2;
      marcarPasos();
      pintar();
      const bloque = cuerpo.querySelector('[data-mock]');
      if (bloque && estado.codigoMock) {
        const entrada = cuerpo.querySelector('#reg-otp');
        if (entrada) entrada.value = estado.codigoMock;
      }
      if (bloque) bloque.scrollIntoView({ block: 'nearest' });
      toast(info.codigoMock ? 'Código generado en modo de prueba.' : 'Te enviamos el código.', 'exito');
    } catch (e) {
      restaurar();
      errorDe(e?.message || 'No pudimos enviar el código. Probá de nuevo.');
    }
  }

  function pintar() {
    if (estado.paso === 1) {
      cuerpo.innerHTML = `
        <p class="campo-error" data-error role="alert" hidden></p>
        <form id="form-datos" novalidate>
          <div class="fila" style="gap:0.6rem">
            <label class="campo crece" for="reg-nombre">
              <span class="campo-etiqueta">Nombre <span class="req">*</span></span>
              <input class="campo-input" id="reg-nombre" autocomplete="given-name" maxlength="60" value="${esc(estado.nombre)}" required>
            </label>
            <label class="campo crece" for="reg-apellido">
              <span class="campo-etiqueta">Apellido <span class="req">*</span></span>
              <input class="campo-input" id="reg-apellido" autocomplete="family-name" maxlength="60" value="${esc(estado.apellido)}" required>
            </label>
          </div>

          <label class="campo" for="reg-dni">
            <span class="campo-etiqueta">DNI <span class="req">*</span></span>
            <input class="campo-input" id="reg-dni" inputmode="numeric" autocomplete="off" maxlength="9" placeholder="Sin puntos" value="${esc(estado.dni)}" required>
            <span class="campo-ayuda">Lo usamos sólo para verificar tu identidad. No se muestra en el catálogo.</span>
          </label>

          <label class="campo" for="reg-telefono">
            <span class="campo-etiqueta">Teléfono celular <span class="req">*</span></span>
            <input class="campo-input" id="reg-telefono" type="tel" inputmode="tel" autocomplete="tel" maxlength="18" placeholder="Ej. 11 2345 6789" value="${esc(estado.telefono)}" required>
            <span class="campo-ayuda">Te mandamos un código para confirmar que es tuyo. Nunca se publica.</span>
          </label>

          <label class="campo" for="reg-pass">
            <span class="campo-etiqueta">Contraseña <span class="req">*</span></span>
            <span class="campo-con-icono">
              <input class="campo-input" id="reg-pass" type="password" autocomplete="new-password" maxlength="72" placeholder="Al menos 6 caracteres" required>
              <button type="button" class="icon-btn" data-ver="reg-pass" aria-label="Mostrar contraseña">${icon('eye')}</button>
            </span>
          </label>

          <label class="campo" for="reg-pass2">
            <span class="campo-etiqueta">Repetir contraseña <span class="req">*</span></span>
            <span class="campo-con-icono">
              <input class="campo-input" id="reg-pass2" type="password" autocomplete="new-password" maxlength="72" placeholder="Otra vez, para confirmar" required>
              <button type="button" class="icon-btn" data-ver="reg-pass2" aria-label="Mostrar contraseña">${icon('eye')}</button>
            </span>
          </label>

          <label class="check-row" for="reg-mayor">
            <input type="checkbox" id="reg-mayor" ${estado.mayor ? 'checked' : ''}>
            <span><span class="negrita">Tengo 18 años o más</span><br><span class="texto-suave texto-chico">Switch es sólo para personas mayores de edad.</span></span>
          </label>

          <button type="submit" class="btn btn-primario btn-block btn-lg mt-1">Continuar</button>
        </form>
      `;

      cuerpo.querySelectorAll('[data-ver]').forEach((b) =>
        b.addEventListener('click', () => {
          const input = cuerpo.querySelector('#' + b.dataset.ver);
          const visible = input.type === 'text';
          input.type = visible ? 'password' : 'text';
          b.innerHTML = icon(visible ? 'eye' : 'eyeoff');
          b.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
        })
      );

      cuerpo.querySelector('#form-datos').addEventListener('submit', (ev) => {
        ev.preventDefault();
        estado.nombre = cuerpo.querySelector('#reg-nombre').value.trim();
        estado.apellido = cuerpo.querySelector('#reg-apellido').value.trim();
        estado.dni = cuerpo.querySelector('#reg-dni').value.replace(/\D/g, '');
        estado.telefono = cuerpo.querySelector('#reg-telefono').value.replace(/\D/g, '');
        estado.password = cuerpo.querySelector('#reg-pass').value;
        const pass2 = cuerpo.querySelector('#reg-pass2').value;
        estado.mayor = cuerpo.querySelector('#reg-mayor').checked;

        if (estado.nombre.length < 2) return errorDe('Ingresá tu nombre.');
        if (estado.apellido.length < 2) return errorDe('Ingresá tu apellido.');
        if (estado.dni.length < 6) return errorDe('El DNI no parece válido. Revisalo.');
        if (estado.telefono.length < 10) {
          return errorDe('Ingresá el número completo, con código de área y sin el 0 inicial.');
        }
        if (estado.password.length < 6) {
          return errorDe('La contraseña necesita al menos 6 caracteres.');
        }
        if (estado.password !== pass2) return errorDe('Las contraseñas no coinciden.');
        if (!estado.mayor) return errorDe('Tenés que declarar que sos mayor de 18 años.');

        enviarCodigo();
      });
      return;
    }

    if (estado.paso === 2) {
      cuerpo.innerHTML = `
        <p class="campo-error" data-error role="alert" hidden></p>
        <div class="banner banner-info" style="margin-bottom:0.8rem">
          ${icon('message')}
          <div><strong>Código enviado</strong><p>Al ${esc(estado.telefono)}. Ingresá los 6 dígitos que recibiste.</p></div>
        </div>
        ${
          estado.codigoMock
            ? `<div class="otp-mock" data-mock>${icon('flash')}<div>Modo de prueba: tu código es <strong>${esc(
                estado.codigoMock
              )}</strong></div></div>`
            : ''
        }
        <form id="form-otp" novalidate>
          <label class="campo" for="reg-otp">
            <span class="campo-etiqueta">Código de verificación</span>
            <input class="campo-input campo-otp" id="reg-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required>
          </label>
          <button type="submit" class="btn btn-primario btn-block btn-lg mt-1">Verificar</button>
          <button type="button" class="btn btn-fantasma btn-block mt-1" data-reenviar>Reenviar código</button>
          <button type="button" class="btn-texto btn-block mt-1" data-atras>Volver a mis datos</button>
        </form>
        <p class="campo-ayuda" style="text-align:center;margin-top:0.6rem">Si no llega, revisá que el número esté bien escrito o pedí un código nuevo. No compartas el código con nadie.</p>
      `;

      const entrada = cuerpo.querySelector('#reg-otp');
      entrada.addEventListener('input', () => {
        entrada.value = entrada.value.replace(/\D/g, '').slice(0, 6);
      });
      if (estado.codigoMock) entrada.value = estado.codigoMock;
      actualizarReenvio();
      if (estado.finCooldown > Date.now()) {
        if (!temporizador) temporizador = setInterval(actualizarReenvio, 1000);
      }

      cuerpo.querySelector('[data-reenviar]').addEventListener('click', () => enviarCodigo({ reenvio: true }));
      cuerpo.querySelector('[data-atras]').addEventListener('click', () => irAPaso(1));

      cuerpo.querySelector('#form-otp').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        errorDe('');
        const codigo = entrada.value.trim();
        if (codigo.length !== 6) return errorDe('El código tiene 6 dígitos.');

        const boton = cuerpo.querySelector('button[type="submit"]');
        const restaurar = cargarBoton(boton, 'Verificando…');
        try {
          const datos = await API.verificarOtp(estado.telefono, codigo);
          estado.tokenVerificacion = datos.tokenVerificacion;
          estado.telefonoVerificado = estado.telefono;
          if (temporizador) {
            clearInterval(temporizador);
            temporizador = null;
          }
          toast('Teléfono verificado.', 'exito');
          irAPaso(3);
        } catch (e) {
          restaurar();
          errorDe(e?.message || 'El código no es válido. Probá de nuevo.');
        }
      });
      return;
    }

    cuerpo.innerHTML = `
      <div class="banner banner-exito" style="margin-bottom:0.8rem">
        ${icon('checkcircle')}
        <div><strong>Teléfono verificado</strong><p>${esc(estado.nombre)} ${esc(estado.apellido)} · DNI ${esc(
      estado.dni
    )}</p></div>
      </div>
      <p class="campo-error" data-error role="alert" hidden></p>
      <p class="modal-texto">Para crear tu cuenta necesitamos que aceptes los dos documentos que rigen el uso de Switch. Podés leerlos completos antes de aceptar.</p>

      <div class="fila" style="gap:0.5rem;margin-bottom:0.6rem">
        <button type="button" class="btn btn-secundario crece" data-ver="terminos">${icon('clipboard')} Términos</button>
        <button type="button" class="btn btn-secundario crece" data-ver="privacidad">${icon('shield')} Privacidad</button>
      </div>

      <label class="check-row" for="reg-acepto-term">
        <input type="checkbox" id="reg-acepto-term">
        <span><span class="negrita">Acepto los Términos y Condiciones</span><br><span class="texto-suave texto-chico">Reglas de publicación, trueques, validaciones y sanciones.</span></span>
      </label>
      <label class="check-row" for="reg-acepto-priv">
        <input type="checkbox" id="reg-acepto-priv">
        <span><span class="negrita">Acepto la Política de Privacidad</span><br><span class="texto-suave texto-chico">Cómo cuidamos tus datos personales.</span></span>
      </label>

      <button type="button" class="btn btn-primario btn-block btn-lg mt-1" id="reg-crear">Crear mi cuenta</button>
      <button type="button" class="btn btn-fantasma btn-block mt-1" data-volver-otp>Volver a la verificación</button>
    `;

    const term = cuerpo.querySelector('#reg-acepto-term');
    const priv = cuerpo.querySelector('#reg-acepto-priv');
    const crear = cuerpo.querySelector('#reg-crear');

    const refrescarBoton = () => {
      crear.disabled = !(term.checked && priv.checked);
    };
    term.addEventListener('change', refrescarBoton);
    priv.addEventListener('change', refrescarBoton);
    refrescarBoton();

    cuerpo.querySelectorAll('[data-ver]').forEach((b) =>
      b.addEventListener('click', () => verLegal(b.dataset.ver))
    );
    cuerpo.querySelector('[data-volver-otp]').addEventListener('click', () => irAPaso(2));

    crear.addEventListener('click', async () => {
      errorDe('');
      if (!term.checked || !priv.checked) {
        return errorDe('Necesitás aceptar los dos documentos para continuar.');
      }
      const restaurar = cargarBoton(crear, 'Creando tu cuenta…');
      try {
        const res = await API.registro({
          dni: estado.dni,
          nombre: estado.nombre,
          apellido: estado.apellido,
          telefono: estado.telefonoVerificado || estado.telefono,
          password: estado.password,
          esMayorEdad: true,
          aceptoTerminos: true,
          aceptoPrivacidad: true,
          tokenVerificacion: estado.tokenVerificacion,
        });

        let sesion = null;
        try {
          sesion = await API.login(estado.dni, estado.password);
        } catch (e) {
          /* La cuenta quedó creada: si el ingreso automático falla, se
             completa desde la pantalla de ingreso. */
        }

        if (sesion && sesion.token && sesion.rol !== 'ADMIN') {
          Store.guardarSesion(sesion);
          document.dispatchEvent(new CustomEvent('switch:sesion'));
          toast(`¡Bienvenido/a a Switch, ${sesion.nombre || estado.nombre}!`, 'exito', 4500);
          navegar('/perfil', { reemplazar: true });
        } else {
          toast(res?.mensaje || 'Cuenta creada. Ahora ingresá con tu DNI y contraseña.', 'exito', 5000);
          navegar('/login', { reemplazar: true });
        }
      } catch (e) {
        restaurar();
        errorDe(e?.message || 'No pudimos crear la cuenta. Revisá los datos e intentá de nuevo.');
      }
    });
  }

  marcarPasos();
  pintar();

  return () => {
    if (temporizador) clearInterval(temporizador);
  };
}
