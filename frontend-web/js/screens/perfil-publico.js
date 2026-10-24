/* Perfil público de otro vecino: datos no sensibles, estadísticas, impacto
   comunitario, insignias y sus publicaciones. Los accesos rápidos son
   personales, así que sólo se muestran con sesión iniciada. */

/* Seguridad: Este componente ahora siempre muestra el perfil del usuario
   autenticado (Store.usuario), en lugar de confiar en ctx.params.id de la URL.
   Esto previene la vulnerabilidad IDOR donde cambiar el número final en la
   dirección permite ver datos de otras personas. */

import { Store } from '../store.js';
import { API } from '../api.js';
import {
  icon,
  esc,
  avatar,
  toast,
  confirmar,
  spinner,
  vacio,
  errorEstado,
  chipEsfuerzo,
  imagenPublicacion,
  idPublicacion,
  idOferente,
  fecha,
} from '../ui.js';
import { navegar } from '../router.js';

export async function render(contenedor, ctx) {
  // SECURITY: Always use the authenticated user's ID from the store.
  // No longer trust ctx.params.id from the URL hash, which was a security
  // vulnerability (Insecure Direct Object Reference - IDOR) allowing
  // viewing other users' data by changing the ID in the URL.
  const id = Store.usuario?.id;

  // Si no hay usuario logueado, redirigir al login
  if (!id) {
    navegar('/login', { reemplazar: true });
    return;
  }

  contenedor.innerHTML = `<section class="pantalla">${spinner('Cargando perfil…')}</section>`;

  let perfil;
  try {
    perfil = await API.perfilPublico(id);
  } catch (e) {
    // SECURITY: If user is not authorized to view this profile,
    // redirect to their own profile instead of showing generic data
    if (e?.message && e.message.includes('No está autorizado')) {
      toast('No está autorizado a ver este perfil. Se le redirige a su perfil.', 'aviso');
      navegar('/perfil', { reemplazar: true });
      return;
    }
    contenedor.innerHTML = `<section class="pantalla">${errorEstado(
      e?.message || 'No pudimos cargar este perfil.',
      '<button type="button" class="btn btn-secundario" data-reintentar>Reintentar</button>'
    )}</section>`;
    contenedor.querySelector('[data-reintentar]')?.addEventListener('click', () =>
      render(contenedor, ctx)
    );
    return;
  }

  const stats = perfil.estadisticas || {};
  const impacto = perfil.impacto || {};
  const nivel = impacto.nivel || { nombre: 'Semilla del Barrio', numero: 1 };
  const siguiente = impacto.nivelSiguiente;
  const progreso = Math.round((Number(impacto.progreso) || 0) * 100);
  const insignias = Array.isArray(impacto.insignias) ? impacto.insignias : [];
  const desbloqueadas = insignias.filter((i) => i.desbloqueada).length;
  const nombre = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || 'Vecino de Switch';
  const calificacion = Number(stats.calificacionPromedio) || 0;
  const resenas = Number(stats.cantidadResenas) || 0;
  const conSesion = Store.sesionActiva;

  contenedor.innerHTML = `
    <section class="pantalla pantalla-perfil">
      <header class="perfil-cabecera">
        ${avatar(nombre, 'avatar-xl perfil-avatar')}
        <h1 class="perfil-nombre">${esc(nombre)}</h1>
        <p class="perfil-id">${perfil.dni ? `DNI ${esc(perfil.dni)} · ` : ''}Miembro desde ${esc(
    perfil.miembro_desde || '—'
  )}</p>
        <div class="fila" style="justify-content:center;gap:0.35rem;margin-top:0.45rem">
          <span class="chip chip-verde">${icon('checkcircle')} Cuenta verificada</span>
        </div>
      </header>

      <div class="perfil-stats">
        <div class="stat-card">
          ${icon('swap')}
          <p class="stat-valor">${Number(stats.truequesCompletados) || 0}</p>
          <p class="stat-etiqueta">Trueques completados</p>
        </div>
        <div class="stat-card">
          ${icon('heart')}
          <p class="stat-valor">${Number(stats.voluntariados) || 0}</p>
          <p class="stat-etiqueta">Voluntariados</p>
        </div>
        <div class="stat-card">
          ${icon('star')}
          <p class="stat-valor">${resenas > 0 ? calificacion.toFixed(1) : '—'}</p>
          <p class="stat-etiqueta">${resenas > 0 ? `${resenas} reseñas` : 'Sin reseñas'}</p>
        </div>
      </div>

      <div class="nivel-card">
        <div class="nivel-cab">
          ${icon('trophy')}
          <h3>Impacto comunitario</h3>
          <span class="nivel-puntos">${Number(impacto.puntos) || 0} pts</span>
        </div>
        <p class="nivel-nombre">Nivel ${Number(nivel.numero) || 1}: ${esc(nivel.nombre || 'Semilla')}</p>
        <div class="barra barra-alta"><span style="width:${progreso}%"></span></div>
        <div class="nivel-texto">
          <span>${progreso}% del nivel</span>
          <span>${
            siguiente
              ? `Faltan ${Number(impacto.puntosParaSiguiente) || 0} pts para ${esc(siguiente.nombre)}`
              : '¡Nivel máximo alcanzado!'
          }</span>
        </div>
        <div class="insignias">
          ${
            insignias.length
              ? insignias
                  .map(
                    (i) => `<span class="badge-insignia ${
                      i.desbloqueada ? 'listo' : 'bloqueada'
                    }" title="${esc(i.descripcion || '')}">${icon(
                      i.desbloqueada ? 'star' : 'lock'
                    )} ${esc(i.nombre)}</span>`
                  )
                  .join('')
              : ''
          }
        </div>
        <p class="campo-ayuda" style="margin-top:0.5rem">${desbloqueadas} de ${
    insignias.length
  } insignias desbloqueadas · Se ganan con trueques, voluntariado y buena reputación.</p>
      </div>

      ${
        conSesion
          ? `<div class="acciones-detalle mt-2">
               <button type="button" class="btn btn-primario btn-block" data-mensaje>
                 ${icon('message')} Enviar un mensaje
               </button>
             </div>

             <div class="seccion-cabecera mt-2">
               <h2>Accesos rápidos</h2>
             </div>
             <div class="menu-lista">
               <button type="button" class="menu-fila" data-ir="/publicar">
                 ${icon('plus')}<span>Publicar algo</span>${icon('chevron', 'chevron')}
               </button>
               <button type="button" class="menu-fila" data-ir="/trueques">
                 ${icon('swap')}<span>Mis trueques</span>${icon('chevron', 'chevron')}
               </button>
               <button type="button" class="menu-fila" data-ir="/voluntariado">
                 ${icon('heart')}<span>Voluntariado e instituciones</span>${icon('chevron', 'chevron')}
               </button>
               <button type="button" class="menu-fila" data-ir="/qr">
                 ${icon('qr')}<span>Escanear QR de presencia</span>${icon('chevron', 'chevron')}
               </button>
               <button type="button" class="menu-fila" data-ir="/accesibilidad">
                 ${icon('accessibility')}<span>Accesibilidad y lectura</span>${icon('chevron', 'chevron')}
               </button>
               ${
                 Store.esAdmin
                   ? `<button type="button" class="menu-fila" data-ir="/admin">${icon('shield')}<span>Panel de administración</span>${icon('chevron', 'chevron')}</button>`
                   : ''
               }
               <button type="button" class="menu-fila peligro" data-salir>
                 ${icon('logout')}<span>Cerrar sesión</span>
               </button>
             </div>`
          : ''
      }

      <div class="seccion-cabecera mt-2" id="publicaciones-usuario">
        <h2>Publicaciones de ${esc(nombre)}</h2>
      </div>
      <div id="pubs-zona" aria-live="polite">${spinner('Cargando publicaciones…')}</div>
    </section>
  `;

  contenedor.querySelectorAll('[data-ir]').forEach((b) =>
    b.addEventListener('click', () => navegar(b.dataset.ir))
  );

  contenedor.querySelector('[data-mensaje]')?.addEventListener('click', () =>
    navegar(`/chat/${encodeURIComponent(id)}?nombre=${encodeURIComponent(nombre)}`)
  );

  contenedor.querySelector('[data-salir]')?.addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Cerrar sesión',
      texto: '¿Querés salir de tu cuenta en este dispositivo?',
      textoOk: 'Cerrar sesión',
      icono: 'logout',
    });
    if (!ok) return;
    Store.cerrarSesion();
    document.dispatchEvent(new CustomEvent('switch:sesion'));
    toast('Cerraste sesión. ¡Hasta pronto!', 'info');
    navegar('/voluntariado', { reemplazar: true });
  });

  const zona = contenedor.querySelector('#pubs-zona');

  try {
    const todas = await API.catalogo();
    const publicaciones = todas.filter((p) => String(idOferente(p)) === String(id));

    if (!publicaciones.length) {
      zona.innerHTML = vacio(
        'gift',
        'Sin publicaciones activas',
        'Cuando publique algo que ya no use o un servicio que pueda ofrecer, va a aparecer acá.'
      );
      return;
    }

    zona.innerHTML = `<div class="mis-pubs">
      ${publicaciones
        .map(
          (p) => `
        <a class="mi-pub" href="#/detalle/${encodeURIComponent(idPublicacion(p))}" aria-label="Ver ${esc(
            p.titulo || 'publicación'
          )}">
          ${imagenPublicacion(p, 'pub-imagen', 52)}
          <div class="mi-pub-info">
            <p class="mi-pub-titulo">${esc(p.titulo || 'Publicación')}</p>
            <div class="mi-pub-estado">${chipEsfuerzo(p.nivel_esfuerzo)}</div>
            ${p.creado_en ? `<p class="texto-suave texto-chico">${esc(fecha(p.creado_en))}</p>` : ''}
          </div>
          ${icon('chevron')}
        </a>`
        )
        .join('')}
    </div>`;
  } catch (e) {
    zona.innerHTML = errorEstado(
      e?.message || 'No pudimos cargar las publicaciones.',
      '<button type="button" class="btn btn-secundario" data-reintentar-pubs>Reintentar</button>'
    );
    zona.querySelector('[data-reintentar-pubs]')?.addEventListener('click', () =>
      render(contenedor, ctx)
    );
  }
}