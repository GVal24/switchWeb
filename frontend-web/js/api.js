/* Cliente de la API REST de Switch.
   Envuelve fetch, agrega el token y normaliza las respuestas. */

import { Store } from './store.js';

export class ApiError extends Error {
  constructor(mensaje, estado, codigo) {
    super(mensaje);
    this.name = 'ApiError';
    this.estado = estado || 0;
    this.codigo = codigo || null;
  }
}

function base() {
  return window.SWITCH_CONFIG.apiBase;
}

function listaDe(datos, claves) {
  if (Array.isArray(datos)) return datos;
  if (datos && typeof datos === 'object') {
    for (const clave of claves) {
      if (Array.isArray(datos[clave])) return datos[clave];
    }
    if (Array.isArray(datos.datos)) return datos.datos;
  }
  return [];
}

async function pedir(ruta, opciones = {}) {
  const {
    metodo = 'GET',
    body,
    formData,
    auth = true,
    admin = false,
    crudo = false,
    timeout = 20000,
    signal,
  } = opciones;

  const headers = {};
  if (!formData) headers['Content-Type'] = 'application/json';
  const token = admin ? Store.adminToken : Store.token;
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), timeout);
  if (signal) signal.addEventListener('abort', () => control.abort(), { once: true });

  let res;
  try {
    res = await fetch(base() + ruta, {
      method: metodo,
      headers,
      body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
      signal: control.signal,
      cache: 'no-store',
    });
  } catch (e) {
    clearTimeout(temporizador);
    if (e.name === 'AbortError') {
      throw new ApiError('El servidor tardó demasiado en responder. Probá de nuevo.', 0, 'TIMEOUT');
    }
    throw new ApiError('Error de conexión con el servidor. Revisá tu conexión e intentá de nuevo.', 0, 'RED');
  }
  clearTimeout(temporizador);

  if (crudo) {
    if (!res.ok) throw new ApiError('No se pudo obtener el archivo.', res.status);
    return res;
  }

  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    json = null;
  }

  if (!res.ok || (json && json.exito === false)) {
    const mensaje =
      (json && (json.mensaje || json.error)) ||
      (res.status === 401
        ? 'Necesitás iniciar sesión para hacer esto.'
        : res.status === 403
          ? 'No tenés permisos para hacer esto.'
          : res.status === 404
            ? 'No encontramos lo que buscabas.'
            : 'Ocurrió un error inesperado. Probá de nuevo.');
    throw new ApiError(mensaje, res.status, json && json.codigo);
  }

  return json && json.datos !== undefined ? json : json || {};
}

function datos(res) {
  return (res && res.datos) || res || {};
}

async function subirArchivo(ruta, file, campo = 'imagen') {
  const fd = new FormData();
  fd.append(campo, file, file.name || 'foto.jpg');
  return pedir(ruta, { metodo: 'POST', formData: fd, timeout: 45000 });
}

export const API = {
  /* ---------- salud / conexión ---------- */
  async ping() {
    const control = new AbortController();
    const t = setTimeout(() => control.abort(), 5000);
    try {
      const res = await fetch(base() + '/legal', { signal: control.signal });
      return res.ok;
    } catch (e) {
      return false;
    } finally {
      clearTimeout(t);
    }
  },

  /* ---------- autenticación ---------- */
  async login(dni, password) {
    const res = await pedir('/auth/login', {
      metodo: 'POST',
      auth: false,
      body: { dni, password },
    });
    return datos(res);
  },

  async solicitarResetPassword({ dni }) {
    const res = await pedir('/auth/password-reset', {
      metodo: 'POST',
      auth: false,
      body: { dni },
    });
    return datos(res);
  },

  async verificarResetPassword({ dni, codigo }) {
    const res = await pedir('/auth/password-reset/verificar', {
      metodo: 'POST',
      auth: false,
      body: { dni, codigo },
    });
    return datos(res);
  },

  async confirmarResetPassword({ token, nuevaPassword }) {
    const res = await pedir('/auth/password-reset/confirm', {
      metodo: 'POST',
      auth: false,
      body: { token, nuevaPassword },
    });
    return datos(res);
  },

  async registro(payload) {
    const res = await pedir('/auth/registro', {
      metodo: 'POST',
      auth: false,
      body: payload,
    });
    return res;
  },

  async pedirOtp(telefono, canalPreferido) {
    const res = await pedir('/auth/otp/solicitar', {
      metodo: 'POST',
      auth: false,
      body: {
        telefono,
        proposito: 'REGISTRO',
        ...(canalPreferido ? { canalPreferido } : {}),
      },
    });
    return { datos: datos(res), detalles: res.detalles || {} };
  },

  async verificarOtp(telefono, codigo) {
    const res = await pedir('/auth/otp/verificar', {
      metodo: 'POST',
      auth: false,
      body: { telefono, codigo, proposito: 'REGISTRO' },
    });
    return datos(res);
  },

  /* ---------- legales ---------- */
  async legales() {
    const res = await pedir('/legal', { auth: false });
    return listaDe(datos(res), ['documentos']);
  },

  async legal(id) {
    const res = await pedir('/legal/' + encodeURIComponent(id), { auth: false });
    return datos(res);
  },

  /* ---------- instituciones ---------- */
  async instituciones() {
    const res = await pedir('/instituciones', { auth: false });
    return listaDe(datos(res), ['instituciones']);
  },

  async cupos(institucionId) {
    const res = await pedir(`/instituciones/${encodeURIComponent(institucionId)}/cupos`, {
      auth: false,
    });
    return listaDe(datos(res), ['cupos']);
  },

  async perfilInstitucion(institucionId) {
    const res = await pedir(`/instituciones/${encodeURIComponent(institucionId)}/perfil`, {
      auth: false,
    });
    return datos(res);
  },

  async miPanelInstitucional() {
    const res = await pedir('/instituciones/mi-panel');
    return listaDe(datos(res), ['instituciones']);
  },

  async crearNecesidad(institucionId, payload) {
    return pedir(`/instituciones/${encodeURIComponent(institucionId)}/necesidades`, {
      metodo: 'POST',
      body: payload,
    });
  },

  async actualizarNecesidad(institucionId, necesidadId, payload) {
    return pedir(
      `/instituciones/${encodeURIComponent(institucionId)}/necesidades/${encodeURIComponent(necesidadId)}`,
      { metodo: 'PATCH', body: payload }
    );
  },

  async pausarNecesidad(institucionId, necesidadId, pausada) {
    return pedir(
      `/instituciones/${encodeURIComponent(institucionId)}/necesidades/${encodeURIComponent(necesidadId)}/pausa`,
      { metodo: 'POST', body: { pausada } }
    );
  },

  async agregarDelegado(institucionId, dni) {
    return pedir(`/instituciones/${encodeURIComponent(institucionId)}/delegados`, {
      metodo: 'POST',
      body: { dni },
    });
  },

  async quitarDelegado(institucionId, membresiaId) {
    return pedir(
      `/instituciones/${encodeURIComponent(institucionId)}/delegados/${encodeURIComponent(membresiaId)}`,
      { metodo: 'DELETE' }
    );
  },

  async registrarInstitucion(payload) {
    return pedir('/instituciones/registro', { metodo: 'POST', auth: false, body: payload });
  },

  async validarQr(payload) {
    return pedir('/validaciones/qr-scan', { metodo: 'POST', body: payload });
  },

  /* ---------- catálogo ---------- */
  async catalogo({ nivelEsfuerzo, busqueda, tipoItem } = {}) {
    const qs = new URLSearchParams();
    if (nivelEsfuerzo && nivelEsfuerzo !== 'TODOS') qs.set('nivelEsfuerzo', nivelEsfuerzo);
    if (busqueda && busqueda.trim()) qs.set('busqueda', busqueda.trim());
    if (tipoItem && tipoItem !== 'TODOS') qs.set('tipoItem', tipoItem);
    const res = await pedir('/catalogo' + (qs.toString() ? '?' + qs : ''), { auth: false });
    return listaDe(datos(res), ['catalogo', 'publicaciones']);
  },

  async misPublicaciones() {
    const res = await pedir('/catalogo/mis-publicaciones');
    return listaDe(datos(res), ['publicaciones']);
  },

  async clasificarEsfuerzo(titulo, descripcion, tipoItem) {
    try {
      const res = await pedir('/catalogo/clasificar-esfuerzo', {
        metodo: 'POST',
        auth: false,
        body: { titulo, descripcion, tipoItem },
      });
      return datos(res).nivelEsfuerzo || 'SIMPLE';
    } catch (e) {
      return 'SIMPLE';
    }
  },

  async subirImagen(file) {
    const res = await subirArchivo('/catalogo/imagen', file);
    return datos(res);
  },

  async publicar(payload) {
    return pedir('/catalogo/publicar', { metodo: 'POST', body: payload });
  },

  async sugerirEsfuerzo(publicacionId, nivelSugerido) {
    return pedir(`/catalogo/${encodeURIComponent(publicacionId)}/sugerir-esfuerzo`, {
      metodo: 'POST',
      body: { nivelSugerido },
    });
  },

  /* ---------- trueques ---------- */
  async proponer(publicacionDeseadaId, itemsOfrecidos) {
    return pedir('/intercambios/proponer', {
      metodo: 'POST',
      body: { publicacionDeseadaId, itemsOfrecidos },
    });
  },

  async misPropuestas() {
    const res = await pedir('/intercambios/mis-propuestas');
    const d = datos(res);
    return { recibidas: d.recibidas || [], enviadas: d.enviadas || [] };
  },

  async responder(id, estado) {
    return pedir(`/intercambios/${encodeURIComponent(id)}/responder`, {
      metodo: 'POST',
      body: { estado },
    });
  },

  async confirmar(id, puntaje, comentario) {
    return pedir(`/intercambios/${encodeURIComponent(id)}/confirmar`, {
      metodo: 'POST',
      body: {
        puntaje,
        ...(comentario ? { comentario } : {}),
      },
    });
  },

  /* ---------- perfil y chat ---------- */
  async perfil() {
    const res = await pedir('/usuarios/perfil');
    return datos(res);
  },

  async perfilPublico(id) {
    const res = await pedir('/usuarios/' + encodeURIComponent(id) + '/publico');
    return datos(res);
  },

  async mensajes(receptorId) {
    const res = await pedir('/mensajes?receptorId=' + encodeURIComponent(receptorId));
    return listaDe(datos(res), ['mensajes']);
  },

  async enviarMensaje(receptorId, receptorNombre, texto) {
    return pedir('/mensajes/enviar', {
      metodo: 'POST',
      body: { receptorId, receptorNombre, texto },
    });
  },

  /* ---------- reportes y contacto ---------- */
  async reportar(reportadoId, reportadoNombre, motivo) {
    return pedir('/reportes', {
      metodo: 'POST',
      body: { reportadoId, reportadoNombre, motivo },
    });
  },

  async contacto(payload) {
    return pedir('/contacto', { metodo: 'POST', body: payload });
  },

  /* ---------- administración ---------- */
  async adminEstadisticas() {
    const res = await pedir('/admin/estadisticas', { admin: true });
    return datos(res);
  },

  async adminInstituciones() {
    const res = await pedir('/admin/instituciones', { admin: true });
    return listaDe(datos(res), ['instituciones']);
  },

  async adminAsignarResponsable(institucionId, dni) {
    return pedir(`/admin/instituciones/${encodeURIComponent(institucionId)}/responsable`, {
      metodo: 'POST',
      admin: true,
      body: { dni },
    });
  },

  async adminReportes() {
    const res = await pedir('/admin/reportes', { admin: true });
    return listaDe(datos(res), ['reportes']);
  },

  async adminDesestimar(reporteId) {
    return pedir(`/admin/reportes/${encodeURIComponent(reporteId)}/desestimar`, {
      metodo: 'POST',
      admin: true,
    });
  },

  async adminSuspender(usuarioId, dias, reporteId) {
    return pedir('/admin/suspender', {
      metodo: 'POST',
      admin: true,
      body: { usuarioId, dias, ...(reporteId ? { reporteId } : {}) },
    });
  },

  async adminDarDeBaja(usuarioId, reporteId) {
    return pedir('/admin/dar-de-baja', {
      metodo: 'POST',
      admin: true,
      body: { usuarioId, ...(reporteId ? { reporteId } : {}) },
    });
  },

  async adminBloqueados() {
    const res = await pedir('/admin/usuarios-bloqueados', { admin: true });
    return datos(res).bloqueados || [];
  },

  async adminReactivar(usuarioId) {
    return pedir('/admin/reactivar', { metodo: 'POST', admin: true, body: { usuarioId } });
  },

  async adminSugerencias() {
    const res = await pedir('/admin/sugerencias-esfuerzo', { admin: true });
    return listaDe(datos(res), ['sugerencias']);
  },

  async adminAplicarSugerencia(id) {
    return pedir(`/admin/sugerencias-esfuerzo/${encodeURIComponent(id)}/aplicar`, {
      metodo: 'POST',
      admin: true,
    });
  },

  async adminDescartarSugerencia(id) {
    return pedir(`/admin/sugerencias-esfuerzo/${encodeURIComponent(id)}/descartar`, {
      metodo: 'POST',
      admin: true,
    });
  },

  async adminModeracion(limite = 50) {
    const res = await pedir('/admin/moderacion/pendientes?limite=' + limite, { admin: true });
    const d = datos(res);
    return { pendientes: d.pendientes || [], total: d.total || 0 };
  },

  async adminModeracionStats() {
    const res = await pedir('/admin/moderacion/estadisticas', { admin: true });
    return datos(res);
  },

  async adminImagen(revisionId) {
    const res = await pedir(`/admin/moderacion/${encodeURIComponent(revisionId)}/imagen`, {
      admin: true,
      crudo: true,
    });
    return URL.createObjectURL(await res.blob());
  },

  async adminAprobar(revisionId, tipoRevision) {
    const ruta =
      tipoRevision === 'TEXTO'
        ? `/admin/moderacion/texto/${encodeURIComponent(revisionId)}/aprobar`
        : `/admin/moderacion/${encodeURIComponent(revisionId)}/aprobar`;
    return pedir(ruta, { metodo: 'POST', admin: true, body: {} });
  },

  async adminRechazar(revisionId, tipoRevision, motivoRechazo) {
    const ruta =
      tipoRevision === 'TEXTO'
        ? `/admin/moderacion/texto/${encodeURIComponent(revisionId)}/rechazar`
        : `/admin/moderacion/${encodeURIComponent(revisionId)}/rechazar`;
    return pedir(ruta, { metodo: 'POST', admin: true, body: { motivoRechazo } });
  },

  async adminRechazarMenor(revisionId, tipoRevision) {
    const ruta =
      tipoRevision === 'TEXTO'
        ? `/admin/moderacion/texto/${encodeURIComponent(revisionId)}/rechazar-menor`
        : `/admin/moderacion/${encodeURIComponent(revisionId)}/rechazar-menor`;
    return pedir(ruta, { metodo: 'POST', admin: true, body: {} });
  },

  async adminContacto(pendientes = false) {
    const res = await pedir('/admin/contacto' + (pendientes ? '?pendientes=1' : ''), {
      admin: true,
    });
    const d = datos(res);
    return { mensajes: d.mensajes || [], pendientes: d.pendientes || 0 };
  },

  async adminContactoPendientes() {
    try {
      const res = await pedir('/admin/contacto/pendientes', { admin: true });
      return datos(res).pendientes || 0;
    } catch (e) {
      return 0;
    }
  },

  async adminResponderContacto(id, respuesta) {
    return pedir(`/admin/contacto/${encodeURIComponent(id)}/responder`, {
      metodo: 'POST',
      admin: true,
      body: { respuesta },
    });
  },

  async adminLeerContacto(id) {
    return pedir(`/admin/contacto/${encodeURIComponent(id)}/leer`, {
      metodo: 'POST',
      admin: true,
      body: {},
    });
  },

  async adminBorrarContacto(id) {
    return pedir(`/admin/contacto/${encodeURIComponent(id)}`, {
      metodo: 'DELETE',
      admin: true,
    });
  },
};

export const apiBase = base;
