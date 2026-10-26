/* Panel de administración: métricas globales, actividad y accesos rápidos. */

import { API } from '../../api.js';
import {
  icon,
  esc,
  spinner,
  errorEstado,
  dialogo,
} from '../../ui.js';
import { navegar } from '../../router.js';

const ESFUERZOS = [
  { clave: 'SIMPLE', etiqueta: 'Simple' },
  { clave: 'MEDIO', etiqueta: 'Medio' },
  { clave: 'ALTO', etiqueta: 'Alto' },
];

export async function render(contenedor) {
  contenedor.innerHTML = `
    <section class="pantalla pantalla-admin">
      <header class="admin-cabecera">
        <h1>${icon('shield')} Panel de administración</h1>
        <p>Métricas en vivo de la comunidad y acceso a las tareas de cuidado.</p>
        <div class="fila" style="gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem">
          <button type="button" class="btn btn-secundario btn-sm" id="admin-refrescar">${icon(
            'refresh'
          )} Actualizar</button>
          <button type="button" class="btn btn-fantasma btn-sm" id="admin-salir">${icon(
            'logout'
          )} Cerrar panel</button>
        </div>
      </header>

      <div id="admin-contenido">${spinner('Cargando métricas…')}</div>
    </section>
  `;

  const contenido = contenedor.querySelector('#admin-contenido');
  const refrescar = contenedor.querySelector('#admin-refrescar');

  contenedor.querySelector('#admin-salir').addEventListener('click', async () => {
    const elegido = await dialogo({
      titulo: 'Cerrar panel',
      icono: 'logout',
      html: '<p class="modal-texto">Se cierra la sesión de administración. Podés volver a entrar cuando quieras.</p>',
      acciones: [
        { texto: 'Seguir acá', valor: 'cancelar', clase: 'btn-fantasma' },
        { texto: 'Cerrar panel', valor: 'ok', clase: 'btn-peligro', auto: true },
      ],
    });
    if (elegido === 'ok' && typeof window.__switchCerrarAdmin === 'function') {
      window.__switchCerrarAdmin();
    }
  });

  refrescar.addEventListener('click', cargar);

  async function cargar() {
    refrescar.disabled = true;
    contenido.innerHTML = spinner('Cargando métricas…');
    try {
      const [stats, moderacion, contacto, sugerencias] = await Promise.allSettled([
        API.adminEstadisticas(),
        API.adminModeracionStats(),
        API.adminContactoPendientes(),
        API.adminSugerencias(),
      ]);

      if (stats.status !== 'fulfilled') throw stats.reason;

      const datos = stats.value || {};
      const pendientesModeracion =
        moderacion.status === 'fulfilled'
          ? Number(moderacion.value?.pendientes || 0)
          : 0;
      const pendientesContacto =
        contacto.status === 'fulfilled' ? Number(contacto.value || 0) : 0;
      const pendientesSugerencias =
        sugerencias.status === 'fulfilled' ? (sugerencias.value || []).length : 0;

      contenido.innerHTML = vista(datos, {
        moderacion: pendientesModeracion,
        contacto: pendientesContacto,
        sugerencias: pendientesSugerencias,
      });

      contenido.querySelectorAll('[data-ir]').forEach((b) =>
        b.addEventListener('click', () => navegar(b.dataset.ir))
      );
    } catch (e) {
      contenido.innerHTML = errorEstado(
        e?.message || 'No pudimos cargar las métricas.',
        '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
      );
      contenido.querySelector('[data-reintentar]')?.addEventListener('click', cargar);
    } finally {
      refrescar.disabled = false;
    }
  }

  function vista(datos, pendientes) {
    const meses = Array.isArray(datos.meses) ? datos.meses : [];
    const actividad = Array.isArray(datos.actividadMensual) ? datos.actividadMensual : [];
    const distribucion = datos.esfuerzoDistribucion || {};

    return `
      <div class="kpis">
        ${kpi('users', 'azul', datos.usuariosActivos ?? 0, 'Personas activas')}
        ${kpi('swap', '', datos.truequesMes ?? 0, 'Trueques este mes')}
        ${kpi('qr', 'azul', datos.voluntariadosQr ?? 0, 'Voluntariados QR')}
        ${kpi('alert', 'rojo', datos.reportesPendientes ?? 0, 'Denuncias pendientes')}
      </div>

      <div class="panel">
        <div class="seccion-cabecera" style="margin-bottom:0.2rem">
          <h2>Actividad de trueques</h2>
          <span class="chip">${icon('chart')} ${esc(String(datos.tasaEfectividad || '0%'))} efectividad</span>
        </div>
        <p class="campo-ayuda" style="margin-bottom:0.4rem">Propuestas creadas en los últimos 6 meses.</p>
        ${graficoLineas(
          meses.map((mes, indice) => ({
            etiqueta: mes,
            valor: Number(actividad[indice]) || 0,
          })),
          'Trueques propuestos por mes'
        )}
      </div>

      <div class="panel mt-1">
        <div class="seccion-cabecera" style="margin-bottom:0.2rem">
          <h2>Publicaciones por esfuerzo</h2>
        </div>
        ${graficoLineas(
          ESFUERZOS.map((esfuerzo) => ({
            etiqueta: esfuerzo.etiqueta,
            valor: Number(distribucion[esfuerzo.clave]) || 0,
          })),
          'Porcentaje de publicaciones por nivel de esfuerzo',
          '%'
        )}
      </div>

      <div class="seccion-cabecera mt-2">
        <h2>Tareas de cuidado</h2>
      </div>
      <div class="admin-acciones">
        ${accion('moderacion', 'image', 'Moderación', 'Revisar fotos y textos antes de publicar', pendientes.moderacion, '/admin/moderacion')}
        ${accion('reportes', 'alert', 'Denuncias', 'Evaluar reportes de la comunidad', datos.reportesPendientes ?? 0, '/admin/reportes')}
        ${accion('bloqueados', 'lock', 'Cuentas bloqueadas', 'Suspensiones, bajas y altas', 0, '/admin/bloqueados')}
        ${accion('instituciones', 'town', 'Instituciones', 'Asignar responsables institucionales', 0, '/admin/instituciones')}
        ${accion('contacto', 'mail', 'Bandeja de entrada', 'Responder mensajes de contacto', pendientes.contacto, '/admin/contacto')}
        ${accion('sugerencias', 'sliders', 'Sugerencias', 'Revisar clasificaciones de esfuerzo', pendientes.sugerencias, '/admin/sugerencias')}
        ${accion('sitio', 'home', 'Volver al sitio', 'Recorrer Switch como vecino', 0, '/catalogo')}
      </div>

      <p class="campo-ayuda" style="text-align:center;margin-top:0.9rem">Las métricas se calculan en vivo desde la base de datos.</p>
    `;
  }

  function graficoLineas(puntos, descripcion, sufijo = '') {
    const ancho = 600;
    const alto = 220;
    const margen = { arriba: 18, derecha: 14, abajo: 42, izquierda: 42 };
    const anchoUtil = ancho - margen.izquierda - margen.derecha;
    const altoUtil = alto - margen.arriba - margen.abajo;
    const valores = puntos.map((punto) => Math.max(0, Number(punto.valor) || 0));
    const maximo = Math.max(1, ...valores);
    const paso = maximo / 4;
    const maximoEscala = maximo;
    const coordenadas = puntos.map((punto, indice) => ({
      x: margen.izquierda + (puntos.length > 1 ? (indice * anchoUtil) / (puntos.length - 1) : anchoUtil / 2),
      y: margen.arriba + altoUtil - (valores[indice] / maximoEscala) * altoUtil,
      etiqueta: punto.etiqueta,
      valor: valores[indice],
    }));
    const ruta = coordenadas.map((punto) => `${punto.x},${punto.y}`).join(' ');
    const lectura = puntos.map((punto, indice) => `${punto.etiqueta}: ${valores[indice]}${sufijo}`).join(', ');

    return `
      <div class="admin-grafico-lineas" role="img" aria-label="${esc(`${descripcion}. ${lectura}`)}">
        <svg viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none" aria-hidden="true">
          ${Array.from({ length: 5 }, (_, indice) => {
            const valor = maximoEscala - indice * paso;
            const y = margen.arriba + (indice * altoUtil) / 4;
            const etiqueta = sufijo ? Number(valor.toFixed(1)) : Math.round(valor);
            return `<g class="admin-grafico-guia">
              <line x1="${margen.izquierda}" y1="${y}" x2="${ancho - margen.derecha}" y2="${y}"></line>
              <text x="${margen.izquierda - 8}" y="${y + 4}" text-anchor="end">${etiqueta}${sufijo}</text>
            </g>`;
          }).join('')}
          ${coordenadas.length > 1 ? `<polyline class="admin-grafico-trazo" points="${ruta}"></polyline>` : ''}
          ${coordenadas.map((punto) => `
            <circle class="admin-grafico-punto" cx="${punto.x}" cy="${punto.y}" r="5">
              <title>${esc(`${punto.etiqueta}: ${punto.valor}${sufijo}`)}</title>
            </circle>
            <text class="admin-grafico-etiqueta" x="${punto.x}" y="${alto - 12}" text-anchor="middle">${esc(punto.etiqueta)}</text>
          `).join('')}
        </svg>
      </div>
    `;
  }

  function kpi(icono, clase, valor, etiqueta) {
    return `<div class="kpi">
      <span class="kpi-icono ${clase}">${icon(icono)}</span>
      <p class="kpi-valor">${esc(String(valor))}</p>
      <p class="kpi-etiqueta">${etiqueta}</p>
    </div>`;
  }

  function accion(clave, icono, titulo, descripcion, pendientes, ruta) {
    const total = Number(pendientes) || 0;
    return `<button type="button" class="admin-accion" data-ir="${ruta}" data-clave="${clave}">
      ${icon(icono)}
      <strong>${titulo}</strong>
      <span>${descripcion}</span>
      ${total > 0 ? `<span class="badge-num">${total > 99 ? '99+' : total}</span>` : ''}
    </button>`;
  }

  await cargar();
}
