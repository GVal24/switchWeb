/* Detalle de una publicación: información, dueño/a, propuesta de trueque,
   mensaje, reporte y sugerencia de esfuerzo. */

import { Store } from '../store.js';
import { API } from '../api.js';
import {
  icon,
  esc,
  avatar,
  toast,
  hoja,
  pedirTexto,
  spinner,
  vacio,
  errorEstado,
  chipEsfuerzo,
  esfuerzo,
  imagenPublicacion,
  idPublicacion,
  getIdOferente,
  nombreOferente,
  fecha,
  cargarBoton,
} from '../ui.js';
import { window.location.hash } from '../router.js';

const EXPLICACION = {
  SIMPLE: 'Poco traslado y dedicación. Ideal para empezar a intercambiar.',
  MEDIO: 'Requiere coordinar horarios y algo de tiempo de tu parte.',
  ALTO: 'Compromiso importante de tiempo, traslado o dedicación.',
};

export async function render(contenedor, ctx) {
  const id = ctx.params.id;

  contenedor.innerHTML = `<section class="pantalla">${spinner('Abriendo la publicación…')}</section>`;

  let pub;
  try {
    const todas = await API.catalogo();
    pub = todas.find((p) => String(idPublicacion(p)) === String(id));
  } catch (e) {
    contenedor.innerHTML = `<section class="pantalla">${errorEstado(
      e?.message || 'No pudimos cargar la publicación.',
      '<button class="btn btn-secundario" data-volver-cat>Volver al catálogo</button>'
    )}</section>`;
    contenedor.querySelector('[data-volver-cat]')?.addEventListener('click', () => window.location.hash('/catalogo'));
    return;
  }

  if (!pub) {
    contenedor.innerHTML = `<section class="pantalla">${vacio(
      'search',
      'Esta publicación ya no está disponible',
      'Puede que la hayan intercambiado o retirado del catálogo.',
      '<button class="btn btn-primario" data-volver-cat>Ver otras publicaciones</button>'
    )}</section>`;
    contenedor.querySelector('[data-volver-cat]')?.addEventListener('click', () => window.location.hash('/catalogo'));
    return;
  }

  const duenoId = pub.usuario_id || pub.oferente_id || pub.dueno_id || (typeof getIdOferente === 'function' ? getIdOferente(pub) : '') || '';
  const esMia =
    Store.sesionActiva && duenoId !== '' && Number(duenoId) === Number(Store.usuario?.id);
  const nivel = String(pub.nivel_esfuerzo || 'SIMPLE').toUpperCase();
  const infoNivel = esfuerzo(nivel);
  const tipo = String(pub.tipo_item || 'OBJETO').toUpperCase();
  const dueno = nombreOferente(pub);
  const calif = Number(pub.oferente_calificacion);
  const resenas = Number(pub.oferente_resenas);
  const trueques = Number(pub.oferente_trueques);
  const voluntariados = Number(pub.oferente_voluntariados);
  const rutaActual = `/detalle/${encodeURIComponent(id)}`;

  contenedor.innerHTML = `
    <section class="pantalla pantalla-detalle">
      <div class="detalle-hero">
        ${imagenPublicacion(pub, 'pub-imagen', 300)}
      </div>

      <div class="detalle-cabecera">
        <h1 class="detalle-titulo">${esc(pub.titulo || 'Publicación')}</h1>
      </div>
      <div class="fila" style="gap:0.35rem;flex-wrap:wrap">
        ${chipEsfuerzo(nivel)}
        <span class="chip">${icon(tipo === 'SERVICIO' ? 'sparkles' : 'gift')} ${
    tipo === 'SERVICIO' ? 'Servicio' : 'Objeto'
  }</span>
        ${pub.creado_en ? `<span class="chip">${icon('clock')}${esc(fecha(pub.creado_en))}</span>` : ''}
      </div>

      <div class="detalle-sec">
        <p class="detalle-sec-titulo">Descripción</p>
        <p class="detalle-texto">${esc(pub.descripcion || 'Sin descripción.')}</p>
      </div>

      <div class="detalle-sec">
        <p class="detalle-sec-titulo">Nivel de esfuerzo</p>
        <div class="nivel-auto" style="margin-top:0;border-color:var(--borde-fuerte);background:var(--tarjeta-2)">
          ${icon('flash')}
          <div>
            <strong>${esc(infoNivel.etiqueta)}</strong>
            <span class="texto-suave">${esc(EXPLICACION[nivel] || EXPLICACION.SIMPLE)}</span>
          </div>
        </div>
        ${
          !esMia
            ? `<button type="button" class="sugerir mt-1" id="btn-sugerir">${icon('edit')} ¿No coincide? Sugerí otro nivel</button>`
            : ''
        }
      </div>

      <div class="detalle-sec">
        <p class="detalle-sec-titulo">Quien ofrece</p>
        <div class="dueno-fila">
          ${avatar(dueno, 'avatar-lg')}
          <div class="crece">
            <button type="button" class="dueno-nombre" data-ver-usuario="${esc(duenoId)}" style="border:0;background:none;padding:0;text-align:left;cursor:pointer;color:inherit;font-weight:inherit;">
              ${esc(dueno)}${esMia ? ' (vos)' : ''}
            </button>
            <div class="dueno-meta">
              ${icon('swap')} ${Number.isFinite(trueques) ? trueques : 0} trueques
              ${icon('heart')} ${Number.isFinite(voluntariados) ? voluntariados : 0} voluntariados
              ${
                Number.isFinite(calif) && resenas > 0
                  ? `${icon('star')} ${calif.toFixed(1)} (${resenas})`
                  : `${icon('star')} Sin reseñas todavía`
              }
            </div>
          </div>
        </div>
      </div>

      <div id="detalle-aviso"></div>
      <div class="acciones-detalle" id="detalle-acciones"></div>

      <div class="mt-1" style="text-align:center">
        <button type="button" class="btn-texto" data-volver-cat>${icon('back')} Volver al catálogo</button>
      </div>
    </section>
  `;

  const aviso = contenedor.querySelector('#detalle-aviso');
  const acciones = contenedor.querySelector('#detalle-acciones');
  contenedor.querySelector('[data-volver-cat]').addEventListener('click', () => window.location.hash('/catalogo'));

  contenedor.querySelector('[data-ver-usuario]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (duenoId) window.location.hash(`/usuario/${encodeURIComponent(duenoId)}`);
  });

  if (esMia) {
    aviso.innerHTML = `<div class="banner banner-info">${icon('info')}<div><strong>Esta publicación es tuya</strong><p>No podés proponerte un trueque a vos mismo. Podés ver el estado de tus intercambios.</p></div></div>`;
    acciones.innerHTML = `
      <button type="button" class="btn btn-secundario btn-block" data-mis-trueques>${icon('swap')} Ver mis trueques</button>
      <button type="button" class="btn btn-fantasma btn-block" data-publicar>${icon('plus')} Publicar otra cosa</button>
    `;
    acciones.querySelector('[data-mis-trueques]').addEventListener('click', () => window.location.hash('/trueques'));
    acciones.querySelector('[data-publicar]').addEventListener('click', () => window.location.hash('/publicar'));
    return;
  }

  if (!Store.sesionActiva) {
    acciones.innerHTML = `
      <button type="button" class="btn btn-primario btn-block btn-lg" data-login>${icon('lock')} Ingresá para proponer un trueque</button>
      <button type="button" class="btn btn-secundario btn-block" data-login-chat>${icon('message')} Consultar por mensaje</button>
    `;
    acciones.querySelector('[data-login]').addEventListener('click', () =>
      window.location.hash(`/login?volver=${encodeURIComponent(rutaActual)}`)
    );
    acciones.querySelector('[data-login-chat]').addEventListener('click', () =>
      window.location.hash(`/login?volver=${encodeURIComponent(rutaActual)}`)
    );
    return;
  }

  if (Store.suspendido) {
    aviso.innerHTML = `<div class="banner banner-aviso">${icon('alert')}<div><strong>Tu cuenta está suspendida</strong><p>${
      Store.usuario?.avisoSuspension ||
      'Podés recorrer el catálogo, pero no proponer trueques, enviar mensajes ni reportar hasta que se resuelva.'
    }</p></div></div>`;
    acciones.innerHTML = `<button type="button" class="btn btn-secundario btn-block" data-voluntariado>${icon('heart')} Ir a voluntariado</button>`;
    acciones.querySelector('[data-voluntariado]').addEventListener('click', () => window.location.hash('/voluntariado'));
    return;
  }

  acciones.innerHTML = `
    <button type="button" class="btn btn-primario btn-block btn-lg" id="btn-proponer">${icon('swap')} Proponer un trueque</button>
    <button type="button" class="btn btn-secundario btn-block" id="btn-chat">${icon('message')} Enviar un mensaje</button>
    <button type="button" class="btn btn-fantasma btn-block" id="btn-reportar">${icon('alert')} Reportar esta publicación</button>
  `;

  acciones.querySelector('#btn-proponer').addEventListener('click', () => abrirPropuesta(pub));
  acciones.querySelector('#btn-chat').addEventListener('click', () =>
    window.location.hash(`/chat/${encodeURIComponent(duenoId)}?nombre=${encodeURIComponent(dueno)}`)
  );
  acciones.querySelector('#btn-reportar').addEventListener('click', () => reportar(pub, dueno));

  contenedor.querySelector('#btn-sugerir')?.addEventListener('click', () => sugerir(pub));

  async function abrirPropuesta(publicacion) {
    const { cuerpo, cerrar } = hoja({
      titulo: 'Proponer un trueque',
      html: spinner('Cargando tus publicaciones…'),
    });
    try {
      const mias = await API.misPublicaciones();
      if (!mias.length) {
        cuerpo.innerHTML = `${vacio(
          'gift',
          'Todavía no tenés publicaciones activas',
          'Para proponer un trueque necesitás ofrecer algo tuyo. Publicá un objeto o servicio y volvé a intentarlo.',
          '<button type="button" class="btn btn-primario" data-ir-publicar>Publicar algo</button>'
        )}`;
        cuerpo.querySelector('[data-ir-publicar]').addEventListener('click', () => {
          cerrar();
          window.location.hash('/publicar');
        });
        return;
      }

      cuerpo.innerHTML = `
        <p class="modal-texto">Vas a pedir <strong>${esc(publicacion.titulo || 'esta publicación')}</strong>. Marcá qué de lo tuyo querés ofrecer (podés elegir más de uno).</p>
        <div class="fila" style="gap:0.3rem;align-items:flex-start;margin-bottom:0.6rem">
          <span class="chip">${icon('info')} Propuesta sujeta a revisión del dueño</span>
        </div>
        <div id="lista-ofrecidas">
          ${mias
            .map(
              (m) => `
            <label class="fila-opcion" for="of-${esc(String(idPublicacion(m)))}">
              <input type="checkbox" id="of-${esc(String(idPublicacion(m)))}" value="${esc(
                String(idPublicacion(m))
              )}">
              <div class="crece">
                <p class="titulo">${esc(m.titulo || 'Publicación')}</p>
                <p class="sub">${esc(esfuerzo(m.nivel_esfuerzo).etiqueta)} ·${
                String(m.tipo_item).toUpperCase() === 'SERVICIO' ? 'Servicio' : 'Objeto'
              }</p>
              </div>
            </label>`
            )
            .join('')}
        </div>
        <div id="error-propuesta"></div>
        <button type="button" class="btn btn-primario btn-block btn-lg mt-1" id="enviar-propuesta" disabled>Enviar propuesta</button>
        <p class="campo-ayuda" style="text-align:center;margin-top:0.5rem">Tu propuesta se envía al dueño/a. También podés coordinar por chat.</p>
      `;

      const checks = [...cuerpo.querySelectorAll('#lista-ofrecidas input[type="checkbox"]')];
      const boton = cuerpo.querySelector('#enviar-propuesta');
      const errorEl = cuerpo.querySelector('#error-propuesta');
      checks.forEach((c) =>
        c.addEventListener('change', () => {
          boton.disabled = !checks.some((x) => x.checked);
        })
      );

      boton.addEventListener('click', async () => {
        const ids = checks.filter((c) => c.checked).map((c) => Number(c.value));
        if (!ids.length) return;
        errorEl.innerHTML = '';
        const restaurar = cargarBoton(boton, 'Enviando propuesta…');
        try {
          await API.proponer(idPublicacion(publicacion), ids);
          cerrar();
          toast('¡Propuesta enviada! El dueño la va a revisar.', 'exito', 4500);
          window.location.hash('/trueques');
        } catch (e) {
          restaurar();
          const faltaNexo = /nexo|habilitaci[oó]n/i.test(e?.message || '');
          errorEl.innerHTML = `<div class="banner banner-peligro" style="margin-top:0.6rem">${icon(
            'alert'
          )}<div><strong>No se pudo enviar</strong><p>${esc(e?.message || 'Probá de nuevo.')}</p>${
            faltaNexo
              ? '<button type="button" class="btn btn-secundario btn-sm mt-1" data-voluntariado>Renovar mi habilitación</button>'
              : ''
          }</div></div>`;
          errorEl.querySelector('[data-voluntariado]')?.addEventListener('click', () => {
            cerrar();
            window.location.hash('/voluntariado');
          });
        }
      });
    } catch (e) {
      cuerpo.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar tus publicaciones.',
        '<button type="button" class="btn btn-secundario" data-cerrar-hoja>Cerrar</button>'
      );
      cuerpo.querySelector('[data-cerrar-hoja]')?.addEventListener('click', cerrar);
    }
  }

  function sugerir(publicacion) {
    const { cuerpo, cerrar } = hoja({
      titulo: 'Sugerir nivel de esfuerzo',
      html: `
        <p class="modal-texto">Si creés que el nivel no refleja el trabajo real, contale al equipo de Switch. La sugerencia la revisa la administración.</p>
        ${['SIMPLE', 'MEDIO', 'ALTO']
          .map(
            (n) => `
          <button type="button" class="fila-opcion" data-nivel="${n}">
            <span class="icono">${icon('flash')}</span>
            <span class="crece">
              <span class="titulo">${esc(esfuerzo(n).etiqueta)}</span>
              <span class="sub">${esc(EXPLICACION[n])}</span>
            </span>
            ${icon('chevron')}
          </button>`
          )
          .join('')}
        <p class="campo-ayuda" style="margin-top:0.5rem">Sólo se puede sugerir una vez por publicación.</p>
      `,
    });
    cuerpo.querySelectorAll('[data-nivel]').forEach((b) =>
      b.addEventListener('click', async () => {
        const nivel = b.dataset.nivel;
        b.disabled = true;
        try {
          await API.sugerirEsfuerzo(idPublicacion(publicacion), nivel);
          cerrar();
          toast('Gracias: tu sugerencia quedó registrada.', 'exito');
        } catch (e) {
          b.disabled = false;
          toast(e?.message || 'No pudimos registrar la sugerencia.', 'error');
        }
      })
    );
  }

  async function reportar(publicacion, nombreDueno) {
    const motivo = await pedirTexto({
      titulo: 'Reportar publicación',
      texto: `Contanos qué pasa con <strong>${esc(
        publicacion.titulo || 'esta publicación'
      )}</strong>. La administración revisa todos los reportes.`,
      etiqueta: 'Motivo del reporte',
      max: 500,
      requerido: true,
      textoOk: 'Enviar reporte',
      peligro: true,
    });
    if (!motivo) return;
    try {
      await API.reportar(duenoId, nombreDueno, motivo);
      toast('Reporte enviado. Gracias por cuidar la comunidad.', 'exito', 4200);
    } catch (e) {
      toast(e?.message || 'No pudimos enviar el reporte.', 'error');
    }
  }
}