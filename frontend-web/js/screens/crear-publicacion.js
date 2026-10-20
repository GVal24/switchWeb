/* Publicar un objeto o servicio en el catálogo P2P. El nivel de esfuerzo lo
   calcula el servidor; acá sólo mostramos una previsualización. */

import { Store } from '../store.js';
import { API } from '../api.js';
import {
  icon,
  esc,
  toast,
  chipEsfuerzo,
  esfuerzo,
  cargarBoton,
  debounce,
} from '../ui.js';
import { navegar } from '../router.js';

const MAX_IMAGEN = 10 * 1024 * 1024;
const TIPOS = [
  { valor: 'OBJETO', texto: 'Objeto', icono: 'gift' },
  { valor: 'SERVICIO', texto: 'Servicio u oficio', icono: 'sparkles' },
];

export async function render(contenedor) {
  if (!Store.sesionActiva) {
    navegar('/login?volver=/publicar', { reemplazar: true });
    return;
  }

  if (Store.suspendido) {
    contenedor.innerHTML = `
      <section class="pantalla">
        <div class="banner banner-peligro">${icon('alert')}<div><strong>No podés publicar por ahora</strong><p>${
          Store.usuario?.avisoSuspension ||
          'Tu cuenta está suspendida. Cuando se resuelva vas a poder volver a publicar.'
        }</p></div></div>
        <button type="button" class="btn btn-secundario btn-block mt-1" data-voluntariado>${icon('heart')} Ir a voluntariado</button>
        <button type="button" class="btn btn-fantasma btn-block mt-1" data-perfil>Volver a mi perfil</button>
      </section>`;
    contenedor.querySelector('[data-voluntariado]').addEventListener('click', () => navegar('/voluntariado'));
    contenedor.querySelector('[data-perfil]').addEventListener('click', () => navegar('/perfil'));
    return;
  }

  contenedor.innerHTML = `
    <section class="pantalla pantalla-publicar">
      <div class="banner banner-info" style="margin-bottom:0.8rem">
        ${icon('heart')}
        <div>
          <strong>Publicar requiere Nexo Social activo</strong>
          <p>Se activa colaborando en una institución comunitaria. <button type="button" class="btn-texto" data-voluntariado>Ver instituciones</button></p>
        </div>
      </div>

      <form id="form-publicar" novalidate>
        <div class="form-tarjeta">
          <p class="form-seccion">${icon('gift')} ¿Qué vas a ofrecer?</p>
          <div class="fila" style="gap:0.45rem;margin-bottom:0.8rem">
            ${TIPOS.map(
              (t, i) => `
              <button type="button" class="chip-opcion crece" data-tipo="${t.valor}" aria-pressed="${
                i === 0 ? 'true' : 'false'
              }" style="justify-content:center">${icon(t.icono)} ${esc(t.texto)}</button>`
            ).join('')}
          </div>

          <label class="campo" for="pub-titulo">
            <span class="campo-etiqueta">Título <span class="req">*</span></span>
            <input class="campo-input" id="pub-titulo" maxlength="100" placeholder="Ej. Bicicleta rodado 26 en buen estado" required>
            <span class="campo-ayuda"><span id="cont-titulo">0</span> / 100 caracteres</span>
          </label>

          <label class="campo" for="pub-desc">
            <span class="campo-etiqueta">Descripción <span class="req">*</span></span>
            <textarea class="campo-input" id="pub-desc" rows="5" maxlength="1000" placeholder="Contá el estado, qué incluye, si necesita reparaciones o cómo coordinamos la entrega." required></textarea>
            <span class="campo-ayuda"><span id="cont-desc">0</span> / 1000 caracteres</span>
          </label>

          <div class="nivel-auto" id="nivel-preview">
            ${icon('sparkles')}
            <div>
              <strong>Nivel de esfuerzo automático</strong>
              <span class="texto-suave">Escribí el título y la descripción y te mostramos cómo lo clasificaría Switch.</span>
            </div>
          </div>
        </div>

        <div class="form-tarjeta">
          <p class="form-seccion">${icon('camera')} Foto (opcional, pero ayuda mucho)</p>
          <input type="file" id="pub-archivo" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
          <div class="foto-drop" id="pub-foto" role="button" tabindex="0" aria-label="Elegir una foto de la publicación">
            <span style="display:flex;flex-direction:column;align-items:center;gap:0.3rem">${icon('image')}<span>Tocá para elegir una foto</span><span class="texto-suave texto-chico">JPG, PNG, WEBP o GIF · hasta 10 MB</span></span>
          </div>
          <p class="campo-ayuda">Las fotos pasan por una revisión de moderación antes de mostrarse. Si no ponés foto, igual revisamos el texto.</p>
          <div id="pub-foto-estado"></div>
        </div>

        <p class="campo-error" id="pub-error" role="alert" hidden></p>

        <button type="submit" class="btn btn-primario btn-block btn-lg mt-1">Publicar</button>
        <p class="campo-ayuda" style="text-align:center;margin-top:0.6rem">Tu publicación queda en revisión y aparece en el catálogo cuando la aprueban. Sólo para mayores de 18 años.</p>
      </form>
    </section>
  `;

  const form = contenedor.querySelector('#form-publicar');
  const titulo = contenedor.querySelector('#pub-titulo');
  const desc = contenedor.querySelector('#pub-desc');
  const errorEl = contenedor.querySelector('#pub-error');
  const nivelBox = contenedor.querySelector('#nivel-preview');
  const archivo = contenedor.querySelector('#pub-archivo');
  const drop = contenedor.querySelector('#pub-foto');
  const estadoFoto = contenedor.querySelector('#pub-foto-estado');

  const estado = {
    tipo: 'OBJETO',
    archivo: null,
    previewUrl: '',
    subida: null,
  };

  contenedor.querySelector('[data-voluntariado]')?.addEventListener('click', () => navegar('/voluntariado'));

  const mostrarError = (texto) => {
    errorEl.textContent = texto || '';
    errorEl.hidden = !texto;
    if (texto) {
      errorEl.setAttribute('tabindex', '-1');
      errorEl.focus();
    }
  };

  contenedor.querySelectorAll('[data-tipo]').forEach((b) =>
    b.addEventListener('click', () => {
      estado.tipo = b.dataset.tipo;
      contenedor.querySelectorAll('[data-tipo]').forEach((x) =>
        x.setAttribute('aria-pressed', String(x.dataset.tipo === estado.tipo))
      );
      previsualizar();
    })
  );

  const actualizarContadores = () => {
    contenedor.querySelector('#cont-titulo').textContent = String(titulo.value.length);
    contenedor.querySelector('#cont-desc').textContent = String(desc.value.length);
  };
  titulo.addEventListener('input', actualizarContadores);
  desc.addEventListener('input', actualizarContadores);

  const previsualizar = debounce(async () => {
    if (!document.body.contains(nivelBox)) return;
    if (titulo.value.trim().length < 3 || desc.value.trim().length < 5) return;
    nivelBox.innerHTML = `${icon('sparkles')}<div><strong>Calculando…</strong><span class="texto-suave">Un segundo.</span></div>`;
    const nivel = await API.clasificarEsfuerzo(titulo.value.trim(), desc.value.trim(), estado.tipo);
    if (!document.body.contains(nivelBox)) return;
    nivelBox.innerHTML = `${icon('sparkles')}<div><strong>Nivel estimado: ${esc(
      esfuerzo(nivel).etiqueta
    )}</strong><span class="texto-suave">La clasificación final la confirma el servidor al publicar.</span></div>`;
  }, 650);

  titulo.addEventListener('input', previsualizar);
  desc.addEventListener('input', previsualizar);

  const liberarPreview = () => {
    if (estado.previewUrl) URL.revokeObjectURL(estado.previewUrl);
    estado.previewUrl = '';
  };

  const pintarFoto = () => {
    liberarPreview();
    if (!estado.archivo) {
      drop.classList.remove('tiene-foto');
      drop.innerHTML = `
        <span style="display:flex;flex-direction:column;align-items:center;gap:0.3rem">${icon('image')}<span>Tocá para elegir una foto</span><span class="texto-suave texto-chico">JPG, PNG, WEBP o GIF · hasta 10 MB</span></span>`;
      return;
    }
    estado.previewUrl = URL.createObjectURL(estado.archivo);
    drop.classList.add('tiene-foto');
    drop.innerHTML = `
      <img src="${estado.previewUrl}" alt="Vista previa de la foto elegida">
      <span class="foto-quitar icon-btn" role="button" tabindex="0" aria-label="Quitar la foto">${icon('x')}</span>`;
    const quitar = drop.querySelector('.foto-quitar');
    const limpiar = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      estado.archivo = null;
      estado.subida = null;
      archivo.value = '';
      estadoFoto.innerHTML = '';
      pintarFoto();
    };
    quitar.addEventListener('click', limpiar);
    quitar.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') limpiar(ev);
    });
  };

  drop.addEventListener('click', () => archivo.click());
  drop.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      archivo.click();
    }
  });

  archivo.addEventListener('change', () => {
    const file = archivo.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      mostrarError('Elegí una foto JPG, PNG, WEBP o GIF.');
      archivo.value = '';
      return;
    }
    if (file.size > MAX_IMAGEN) {
      mostrarError('La foto no puede superar los 10 MB.');
      archivo.value = '';
      return;
    }
    mostrarError('');
    estado.archivo = file;
    estado.subida = null;
    estadoFoto.innerHTML = '';
    pintarFoto();
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mostrarError('');
    const t = titulo.value.trim();
    const d = desc.value.trim();
    if (t.length < 3) return mostrarError('Poné un título de al menos 3 caracteres.');
    if (d.length < 10) return mostrarError('Contá un poco más en la descripción (al menos 10 caracteres).');

    const boton = form.querySelector('button[type="submit"]');
    const restaurar = cargarBoton(boton, 'Publicando…');

    try {
      if (estado.archivo && !estado.subida) {
        estadoFoto.innerHTML = `<div class="estado-carga">${icon('upload')}<span>Subiendo la foto…</span></div>`;
        try {
          estado.subida = await API.subirImagen(estado.archivo);
        } catch (e) {
          estadoFoto.innerHTML = `<div class="banner banner-peligro">${icon('alert')}<span>${esc(
            e?.message || 'No pudimos subir la foto. Probá con otra.'
          )}</span></div>`;
          throw e;
        }
        estadoFoto.innerHTML = `<div class="banner banner-info">${icon('checkcircle')}<div><strong>Foto recibida</strong><p>${
          estado.subida.aviso || 'Queda en revisión junto con la publicación.'
        }</p></div></div>`;
      }

      const payload = {
        titulo: t,
        descripcion: d,
        tipoItem: estado.tipo,
      };
      if (estado.subida) {
        payload.nombreArchivoImagen = estado.subida.nombreArchivo;
        payload.imagenUrl = estado.subida.url;
      }

      const res = await API.publicar(payload);
      const mensaje = res?.mensaje || '¡Publicación creada! Queda en revisión.';
      toast(mensaje, 'exito', 5200);
      navegar('/perfil?tab=publicaciones', { reemplazar: true });
    } catch (e) {
      restaurar();
      const faltaNexo = /nexo/i.test(e?.message || '');
      if (faltaNexo) {
        errorEl.innerHTML = `${esc(e.message)} <button type="button" class="btn-texto" data-ir-voluntariado>Colaborar ahora</button>`;
        errorEl.hidden = false;
        errorEl.querySelector('[data-ir-voluntariado]')?.addEventListener('click', () => navegar('/voluntariado'));
      } else {
        mostrarError(e?.message || 'No pudimos publicar. Probá de nuevo.');
      }
    }
  });

  return () => liberarPreview();
}
