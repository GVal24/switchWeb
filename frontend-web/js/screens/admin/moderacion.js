/* Moderación: revisión humana de imágenes y textos antes de publicarse. */

import { API } from '../../api.js';
import {
  icon,
  esc,
  toast,
  spinner,
  vacio,
  errorEstado,
  dialogo,
  confirmar,
  pedirTexto,
} from '../../ui.js';
import { navegar } from '../../router.js';

export async function render(contenedor) {
  let pendientes = [];
  let stats = null;
  let filtro = 'TODOS';
  const urls = new Set();
  const cargandoImagen = new Set();

  contenedor.innerHTML = `
    <section class="pantalla pantalla-moderacion">
      <header class="admin-cabecera">
        <h1>${icon('image')} Moderación</h1>
        <p>Revisá cada publicación antes de que sea visible. La imagen y el texto pueden llegar a contenido prohibido.</p>
        <div class="fila" style="gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem">
          <button type="button" class="btn btn-secundario btn-sm" id="mod-refrescar">${icon(
            'refresh'
          )} Actualizar</button>
          <button type="button" class="btn btn-fantasma btn-sm" data-volver>${icon(
            'back'
          )} Panel</button>
        </div>
      </header>

      <div id="mod-stats"></div>
      <div class="admin-toggle" id="mod-filtros" role="group" aria-label="Filtrar por tipo de revisión">
        <button type="button" class="chip chip-opcion" data-filtro="TODOS" aria-pressed="true">Todas</button>
        <button type="button" class="chip chip-opcion" data-filtro="IMAGEN" aria-pressed="false">Con imagen</button>
        <button type="button" class="chip chip-opcion" data-filtro="TEXTO" aria-pressed="false">Sólo texto</button>
      </div>
      <div id="mod-lista">${spinner('Cargando publicaciones pendientes…')}</div>
    </section>
  `;

  const lista = contenedor.querySelector('#mod-lista');
  const zonaStats = contenedor.querySelector('#mod-stats');

  contenedor.querySelector('[data-volver]').addEventListener('click', () => navegar('/admin'));
  contenedor.querySelector('#mod-refrescar').addEventListener('click', cargar);

  contenedor.querySelectorAll('[data-filtro]').forEach((b) =>
    b.addEventListener('click', () => {
      filtro = b.dataset.filtro;
      contenedor.querySelectorAll('[data-filtro]').forEach((otro) =>
        otro.setAttribute('aria-pressed', String(otro === b))
      );
      pintar();
    })
  );

  async function cargar() {
    const boton = contenedor.querySelector('#mod-refrescar');
    boton.disabled = true;
    lista.innerHTML = spinner('Cargando publicaciones pendientes…');
    try {
      const [cola, estadisticas] = await Promise.allSettled([
        API.adminModeracion(100),
        API.adminModeracionStats(),
      ]);
      if (cola.status !== 'fulfilled') throw cola.reason;
      pendientes = cola.value.pendientes || [];
      stats = estadisticas.status === 'fulfilled' ? estadisticas.value : null;
      pintarStats();
      pintar();
    } catch (e) {
      lista.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar la cola de moderación.',
        '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      lista.querySelector('[data-reintentar]')?.addEventListener('click', cargar);
    } finally {
      boton.disabled = false;
    }
  }

  function pintarStats() {
    if (!stats) {
      zonaStats.innerHTML = '';
      return;
    }
    const cifras = [
      ['Pendientes', stats.pendientes ?? pendientes.length, 'naranja'],
      ['Aprobadas', stats.aprobadas ?? 0, ''],
      ['Rechazadas', stats.rechazadas ?? 0, 'rojo'],
      ['Con menores', stats.con_menores ?? 0, 'rojo'],
    ];
    zonaStats.innerHTML = `<div class="kpis">
      ${cifras
        .map(
          ([etiqueta, valor, clase]) => `<div class="kpi">
            <p class="kpi-valor">${esc(String(valor))}</p>
            <p class="kpi-etiqueta">${etiqueta}</p>
          </div>`
        )
        .join('')}
    </div>`;
  }

  function visibles() {
    if (filtro === 'TODOS') return pendientes;
    return pendientes.filter((p) => p.tipo_revision === filtro);
  }

  function pintar() {
    const items = visibles();
    if (!items.length) {
      lista.innerHTML = vacio(
        'checkcircle',
        pendientes.length ? 'Nada en este filtro' : 'No hay publicaciones pendientes',
        pendientes.length
          ? 'Probá con otro tipo de revisión.'
          : 'Todo lo que la comunidad publicó ya fue revisado. Gracias por cuidar el espacio.',
        ''
      );
      return;
    }

    lista.innerHTML = `<div class="admin-lista">${items.map(tarjeta).join('')}</div>`;

    lista.querySelectorAll('[data-aprobar]').forEach((b) =>
      b.addEventListener('click', () => aprobar(b.dataset.aprobar))
    );
    lista.querySelectorAll('[data-rechazar]').forEach((b) =>
      b.addEventListener('click', () => rechazar(b.dataset.rechazar))
    );
    lista.querySelectorAll('[data-menor]').forEach((b) =>
      b.addEventListener('click', () => marcarMenor(b.dataset.menor))
    );
    lista.querySelectorAll('[data-imagen]').forEach((zona) => cargarImagen(zona));
  }

  function tarjeta(p) {
    const esImagen = p.tipo_revision === 'IMAGEN';
    const id = String(esImagen ? p.id : p.publicacion_id);
    const autor = `${p.autor_nombre || ''} ${p.autor_apellido || ''}`.trim() || 'Autor desconocido';
    const motivos = (Array.isArray(p.filtro_motivos) ? p.filtro_motivos : [])
      .map((m) => (typeof m === 'string' ? m : m?.motivo || m?.descripcion || ''))
      .filter(Boolean);

    return `<article class="mod-card" data-revision="${esc(id)}" data-tipo="${
      esImagen ? 'IMAGEN' : 'TEXTO'
    }">
      <div class="mod-meta">
        <span class="chip">${icon(esImagen ? 'image' : 'clipboard')} ${
      esImagen ? 'Con imagen' : 'Sólo texto'
    }</span>
        <span>${icon('user')} ${esc(autor)}</span>
        <span>${icon('clock')} ${esc(p.creado_legible || '')}</span>
        <span class="chip">${esc(p.tipo_item || '')}</span>
      </div>

      <h3 class="negrita" style="font-size:0.95rem;line-height:1.3">${esc(
        p.titulo || 'Sin título'
      )}</h3>
      ${p.descripcion ? `<p class="mod-texto">${esc(p.descripcion)}</p>` : ''}

      ${
        esImagen
          ? `<div class="mod-foto" data-imagen="${esc(id)}">${spinner('Cargando imagen…')}</div>`
          : ''
      }

      ${
        p.contiene_menor
          ? `<p class="mod-alerta">${icon('alert')} El filtro automático detectó posible presencia de una persona menor de edad.</p>`
          : ''
      }
      ${
        motivos.length
          ? `<p class="mod-alerta">${icon('alert')} Filtro automático: ${esc(motivos.join(' · '))}</p>`
          : ''
      }
      ${
        p.filtro_estado && p.filtro_estado !== 'SIN_IMAGEN'
          ? `<p class="campo-ayuda">Estado del filtro: ${esc(
              p.filtro_estado
            )} · puntaje ${esc(String(p.filtro_puntaje ?? 0))}</p>`
          : ''
      }

      <div class="mod-acciones">
        <button type="button" class="btn btn-primario btn-sm" data-aprobar="${esc(id)}">${icon(
          'check'
        )} Aprobar</button>
        <button type="button" class="btn btn-secundario btn-sm" data-rechazar="${esc(id)}">${icon(
          'x'
        )} Rechazar</button>
        <button type="button" class="btn btn-peligro btn-sm" data-menor="${esc(id)}">${icon(
          'alert'
        )} Menor de edad</button>
      </div>
    </article>`;
  }

  async function cargarImagen(zona) {
    const id = zona.dataset.imagen;
    if (!id || cargandoImagen.has(id) || zona.dataset.cargada === '1') return;
    if (zona.querySelector('img')) return;
    cargandoImagen.add(id);
    try {
      const url = await API.adminImagen(id);
      urls.add(url);
      zona.dataset.cargada = '1';
      zona.innerHTML = `<img alt="Imagen de la publicación en revisión" src="${url}">`;
    } catch (e) {
      zona.innerHTML = `<p class="campo-ayuda">No pudimos cargar la imagen.<br>${esc(
        e?.message || ''
      )}</p>`;
    } finally {
      cargandoImagen.delete(id);
    }
  }

  function botonesDe(id) {
    const card = lista.querySelector(`[data-revision="${CSS.escape(String(id))}"]`);
    return card ? card.querySelectorAll('button') : [];
  }

  function quitar(id) {
    const card = lista.querySelector(`[data-revision="${CSS.escape(String(id))}"]`);
    if (card) card.remove();
    pendientes = pendientes.filter(
      (p) => String(p.tipo_revision === 'IMAGEN' ? p.id : p.publicacion_id) !== String(id)
    );
    if (!lista.querySelector('.mod-card')) pintar();
    if (stats) {
      stats.pendientes = Math.max(0, Number(stats.pendientes || 0) - 1);
      pintarStats();
    }
  }

  async function aprobar(id) {
    const item = pendientes.find(
      (p) => String(p.tipo_revision === 'IMAGEN' ? p.id : p.publicacion_id) === String(id)
    );
    const tipo = item?.tipo_revision || 'IMAGEN';
    const ok = await confirmar({
      titulo: 'Aprobar publicación',
      texto:
        tipo === 'TEXTO'
          ? 'El texto quedará visible en el catálogo. ¿Confirmás que cumple las normas?'
          : 'La imagen saldrá de cuarentena y la publicación quedará visible en el catálogo.',
      textoOk: 'Aprobar',
      icono: 'checkcircle',
    });
    if (!ok) return;
    const botones = [...botonesDe(id)];
    botones.forEach((b) => (b.disabled = true));
    try {
      const res = await API.adminAprobar(id, tipo);
      toast(res?.mensaje || 'Publicación aprobada.', 'exito', 4200);
      quitar(id);
    } catch (e) {
      toast(e?.message || 'No pudimos aprobar la publicación.', 'error');
      botones.forEach((b) => (b.disabled = false));
      if (String(e?.message || '').toLowerCase().includes('revisad')) cargar();
    }
  }

  async function rechazar(id) {
    const item = pendientes.find(
      (p) => String(p.tipo_revision === 'IMAGEN' ? p.id : p.publicacion_id) === String(id)
    );
    const tipo = item?.tipo_revision || 'IMAGEN';
    const motivo = await pedirTexto({
      titulo: 'Rechazar publicación',
      texto: 'La publicación no será visible. Escribí el motivo para que quede registrado.',
      etiqueta: 'Motivo del rechazo',
      max: 200,
      requerido: true,
      textoOk: 'Rechazar',
      peligro: true,
    });
    if (!motivo) return;
    const botones = [...botonesDe(id)];
    botones.forEach((b) => (b.disabled = true));
    try {
      const res = await API.adminRechazar(id, tipo, motivo);
      toast(res?.mensaje || 'Publicación rechazada.', 'exito', 4200);
      if (tipo === 'IMAGEN') {
        const img = lista.querySelector(
          `[data-revision="${CSS.escape(String(id))}"] img`
        );
        if (img?.src?.startsWith('blob:')) URL.revokeObjectURL(img.src);
      }
      quitar(id);
    } catch (e) {
      toast(e?.message || 'No pudimos rechazar la publicación.', 'error');
      botones.forEach((b) => (b.disabled = false));
    }
  }

  async function marcarMenor(id) {
    const item = pendientes.find(
      (p) => String(p.tipo_revision === 'IMAGEN' ? p.id : p.publicacion_id) === String(id)
    );
    const tipo = item?.tipo_revision || 'IMAGEN';
    const elegido = await dialogo({
      titulo: 'Rechazar por menor de edad',
      icono: 'alert',
      html: `<p class="modal-texto">La publicación se rechaza y la cuenta queda <strong>suspendida por un año</strong>.</p>
        <p class="modal-texto">${ 
          tipo === 'IMAGEN'
            ? 'La imagen queda reservada para remitirla a la autoridad competente; no se borra.'
            : 'El hallazgo queda registrado para comunicarlo a la autoridad competente.'
        }</p>
        <p class="campo-ayuda">Usá esta opción sólo si estás seguro de que hay una persona menor de edad identificable.</p>`,
      acciones: [
        { texto: 'Cancelar', valor: 'no', clase: 'btn-fantasma', auto: true },
        { texto: 'Confirmar y suspender', valor: 'si', clase: 'btn-peligro' },
      ],
    });
    if (elegido !== 'si') return;
    const botones = [...botonesDe(id)];
    botones.forEach((b) => (b.disabled = true));
    try {
      const res = await API.adminRechazarMenor(id, tipo);
      toast(res?.mensaje || 'Publicación rechazada y cuenta suspendida.', 'exito', 6000);
      quitar(id);
    } catch (e) {
      toast(e?.message || 'No pudimos aplicar la decisión.', 'error');
      botones.forEach((b) => (b.disabled = false));
    }
  }

  await cargar();

  return () => {
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.clear();
  };
}
