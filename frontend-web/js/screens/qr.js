/* Validación de presencia por QR + GPS para activar el Nexo Social. */

import { Store } from '../store.js';
import { API } from '../api.js';
import {
  icon,
  esc,
  toast,
  dialogo,
  cargarBoton,
} from '../ui.js';
import { navegar } from '../router.js';

export async function render(contenedor, ctx) {
  if (!Store.sesionActiva) {
    navegar(`/login?volver=${encodeURIComponent(ctx.ruta?.hash || '/qr')}`, {
      reemplazar: true,
    });
    return;
  }

  const institucionId = ctx.query.get('institucion') || '';
  const cupoId = ctx.query.get('cupo') || '';
  const tituloCupo = ctx.query.get('titulo') || '';
  let institucionNombre = '';
  let stream = null;
  let detector = null;
  let reloj = null;
  let validando = false;

  contenedor.innerHTML = `
    <section class="pantalla pantalla-qr">
      <div class="contacto-hero">
        <h1>${icon('qr')} Validar mi presencia</h1>
        <p>Escaneá el QR que te entrega la institución al llegar. Se activa tu Nexo Social por la colaboración de hoy.</p>
      </div>

      ${
        Store.suspendido
          ? `<div class="banner banner-peligro">${icon('alert')}<div><strong>Cuenta suspendida</strong><p>No podés validar presencia mientras la suspensión esté vigente.</p></div></div>`
          : ''
      }

      <div id="qr-preseleccion"></div>

      <div class="qr-caja" id="qr-caja">
        <div class="qr-error" id="qr-espera">
          ${icon('camera')}
          <p>Activá la cámara y apuntá al QR de la institución.</p>
          <button type="button" class="btn btn-primario" id="qr-activar">${icon('camera')} Activar cámara</button>
        </div>
      </div>

      <div class="qr-manual">
        <label class="campo" for="qr-codigo">
          <span class="campo-etiqueta">O ingresá el código manualmente</span>
          <input class="campo-input" id="qr-codigo" autocomplete="off" autocapitalize="characters" placeholder="Ej. QR_1730000000_AB12CD34" ${Store.suspendido ? 'disabled' : ''}>
          <span class="campo-ayuda">Está impreso debajo del código QR. No distingue mayúsculas de minúsculas.</span>
        </label>
        <div id="qr-ubicacion" class="fila texto-suave texto-chico" style="gap:0.35rem;align-items:flex-start">
          ${icon('pin')}
          <span>Vamos a pedir tu ubicación sólo para confirmar que estás en el lugar. No guardamos tu recorrido.</span>
        </div>
        <p class="campo-error" id="qr-error" role="alert" hidden></p>
        <button type="button" class="btn btn-primario btn-block btn-lg mt-1" id="qr-validar" ${
          Store.suspendido ? 'disabled' : ''
        }>${icon('checkcircle')} Validar presencia</button>
        <button type="button" class="btn btn-fantasma btn-block mt-1" data-volver>Volver al voluntariado</button>
      </div>

      <div class="qr-resultado" id="qr-resultado" aria-live="polite"></div>
    </section>
  `;

  const zonaPreseleccion = contenedor.querySelector('#qr-preseleccion');
  const caja = contenedor.querySelector('#qr-caja');
  const codigoInput = contenedor.querySelector('#qr-codigo');
  const errorEl = contenedor.querySelector('#qr-error');
  const validarBoton = contenedor.querySelector('#qr-validar');
  const resultado = contenedor.querySelector('#qr-resultado');
  const ubicacionTexto = contenedor.querySelector('#qr-ubicacion');

  contenedor.querySelector('[data-volver]').addEventListener('click', () => navegar('/voluntariado'));

  if (institucionId) {
    zonaPreseleccion.innerHTML = `<div class="banner banner-info" style="margin-bottom:0.7rem">${icon(
      'town'
    )}<div><strong>${esc(tituloCupo ? 'Ayuda seleccionada' : 'Institución seleccionada')}</strong><p>${
      tituloCupo
        ? `Vas a registrar tu colaboración en “${esc(tituloCupo)}”.`
        : 'Al escanear el QR se registra una visita general.'
    }</p>${
      cupoId
        ? '<button type="button" class="btn btn-secundario btn-sm mt-1" data-quitar-cupo>Quitar necesidad seleccionada</button>'
        : ''
    }</div></div>`;
    zonaPreseleccion.querySelector('[data-quitar-cupo]')?.addEventListener('click', () => {
      navegar(`/qr?institucion=${encodeURIComponent(institucionId)}`, { reemplazar: true });
    });
    cargarNombreInstitucion();
  }

  async function cargarNombreInstitucion() {
    try {
      const todas = await API.instituciones();
      const inst = todas.find((i) => String(i.id) === String(institucionId));
      if (inst?.nombre) {
        institucionNombre = inst.nombre;
        const p = zonaPreseleccion.querySelector('p');
        if (p) {
          p.innerHTML = cupoId
            ? `En ${esc(inst.nombre)}: vas a registrar tu colaboración en “${esc(tituloCupo)}”.`
            : `En ${esc(inst.nombre)}. Al escanear el QR se registra una visita general.`;
        }
      }
    } catch (e) {
      /* El nombre es sólo informativo: si falla, el flujo sigue. */
    }
  }

  function mostrarError(texto) {
    errorEl.textContent = texto || '';
    errorEl.hidden = !texto;
    if (texto) {
      errorEl.setAttribute('tabindex', '-1');
      errorEl.focus();
    }
  }

  function detenerCamara() {
    if (reloj) {
      clearInterval(reloj);
      reloj = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function pintarEspera(mensaje, conBoton = true) {
    const espera = caja.querySelector('#qr-espera');
    if (!espera) return;
    espera.innerHTML = `
      ${icon('camera')}
      <p>${esc(mensaje)}</p>
      ${conBoton ? `<button type="button" class="btn btn-primario" id="qr-activar">${icon('camera')} Activar cámara</button>` : ''}
    `;
    caja.querySelector('#qr-activar')?.addEventListener('click', activarCamara);
  }

  async function activarCamara() {
    mostrarError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      pintarEspera('Este navegador no permite usar la cámara. Ingresá el código manualmente.', false);
      codigoInput.focus();
      return;
    }
    if (!('BarcodeDetector' in window)) {
      pintarEspera(
        'Este navegador no puede leer códigos QR con la cámara. Ingresá el código impreso debajo del QR.',
        false
      );
      codigoInput.focus();
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch (e) {
      pintarEspera(
        'No pudimos abrir la cámara. Revisá los permisos del navegador o ingresá el código manualmente.',
        false
      );
      return;
    }

    try {
      detector = new BarcodeDetector({ formats: ['qr_code'] });
    } catch (e) {
      detector = new BarcodeDetector();
    }

    detenerCamara();
    // El stream se perdió al detener: volvemos a pedirlo.
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch (e) {
      pintarEspera('No pudimos abrir la cámara.', false);
      return;
    }

    caja.innerHTML = `
      <video class="qr-video" id="qr-video" playsinline muted autoplay></video>
      <span class="qr-marco" aria-hidden="true"></span>
      <p class="qr-ayuda">Apuntá al código QR de la institución</p>
    `;
    const video = caja.querySelector('#qr-video');
    video.srcObject = stream;
    try {
      await video.play();
    } catch (e) {}

    reloj = setInterval(async () => {
      if (!video.videoWidth || !detector || validando) return;
      try {
        const codigos = await detector.detect(video);
        if (codigos && codigos.length) {
          const texto = codigos[0].rawValue || '';
          if (!texto) return;
          detenerCamara();
          const codigo = extraerCodigo(texto);
          codigoInput.value = codigo;
          toast('Código QR leído.', 'exito');
          await validar();
        }
      } catch (e) {
        /* Un frame fallido no corta el escaneo. */
      }
    }, 320);
  }

  contenedor.querySelector('#qr-activar')?.addEventListener('click', activarCamara);

  const extraerCodigo = (texto) => {
    const crudo = String(texto || '').trim();
    try {
      const url = new URL(crudo);
      const posible =
        url.searchParams.get('qr') ||
        url.searchParams.get('codigo') ||
        url.searchParams.get('qrCodigoHash');
      if (posible) return posible.trim();
    } catch (e) {
      /* No es una URL: seguimos con el texto. */
    }
    const coincidencia = crudo.match(/QR_[A-Za-z0-9_-]+/);
    return coincidencia ? coincidencia[0] : crudo;
  };

  const pedirUbicacion = () =>
    new Promise((resolver) => {
      if (!navigator.geolocation) return resolver(null);
      let terminado = false;
      const listo = (valor) => {
        if (terminado) return;
        terminado = true;
        resolver(valor);
      };
      const temporizador = setTimeout(() => listo(null), 8000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(temporizador);
          listo({
            latitudUsuario: pos.coords.latitude,
            longitudUsuario: pos.coords.longitude,
          });
        },
        () => {
          clearTimeout(temporizador);
          listo(null);
        },
        { enableHighAccuracy: true, timeout: 7500, maximumAge: 30000 }
      );
    });

  async function validar() {
    if (validando || Store.suspendido) return;
    const codigo = extraerCodigo(codigoInput.value);
    if (!codigo) {
      mostrarError('Escaneá el QR o ingresá el código de la institución.');
      codigoInput.focus();
      return;
    }
    mostrarError('');
    validando = true;
    const restaurar = cargarBoton(validarBoton, 'Validando…');

    ubicacionTexto.innerHTML = `${icon('pin')}<span>Ubicando… Pedimos tu posición para confirmar que estás en el lugar.</span>`;
    const ubicacion = await pedirUbicacion();
    ubicacionTexto.innerHTML = ubicacion
      ? `${icon('checkcircle')}<span>Ubicación obtenida. La usamos sólo para esta validación.</span>`
      : `${icon('info')}<span>No pudimos obtener tu ubicación. Si la institución exige GPS, acercate y volvé a intentar.</span>`;

    try {
      const res = await API.validarQr({
        qrCodigoHash: codigo,
        ...(ubicacion || {}),
        ...(cupoId ? { cupoNecesidadId: cupoId } : {}),
      });
      const datos = res?.datos || {};
      detenerCamara();
      resultado.innerHTML = `<div class="nexo-card">
        <h3>${icon('checkcircle')} ¡Nexo Social activado!</h3>
        <p>${esc(res?.mensaje || 'Tu colaboración quedó registrada.')}</p>
        ${
          datos.fecha_expiracion
            ? `<p class="texto-chico" style="margin-top:0.35rem">Vence el <strong>${esc(
                datos.fecha_expiracion
              )}</strong>.</p>`
            : ''
        }
      </div>`;
      toast('¡Gracias por colaborar! Ya podés intercambiar.', 'exito', 5000);
      await dialogo({
        titulo: 'Nexo Social activado',
        icono: 'heart',
        html: `<p class="modal-texto">${esc(
          res?.mensaje || 'Tu colaboración quedó registrada.'
        )}</p><p class="campo-ayuda">Con tu Nexo activo podés proponer trueques y publicar en el catálogo.</p>`,
        acciones: [
          { texto: 'Ver instituciones', valor: 'volver', clase: 'btn-fantasma' },
          { texto: 'Ir al catálogo', valor: 'catalogo', clase: 'btn-primario', auto: true },
        ],
      }).then((valor) => {
        if (valor === 'catalogo') navegar('/catalogo');
        if (valor === 'volver') navegar('/voluntariado');
      });
      validarBoton.disabled = true;
      codigoInput.value = '';
    } catch (e) {
      restaurar();
      mostrarError(e?.message || 'No pudimos validar tu presencia. Revisá el código e intentá de nuevo.');
    } finally {
      validando = false;
    }
  }

  validarBoton.addEventListener('click', validar);
  codigoInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      validar();
    }
  });

  // La vista previa del cupo se guarda en la URL para que el guard de sesión
  // no la pierda si hay que ingresar.
  if (cupoId && !codigoInput.value) {
    codigoInput.placeholder = 'Escaneá el QR o pegá el código';
  }

  return () => {
    detenerCamara();
  };
}
