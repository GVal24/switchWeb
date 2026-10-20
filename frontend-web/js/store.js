/* Estado global: sesión, panel admin y preferencias de accesibilidad.
   Las claves imitan las de la app Flutter para que la migración sea reconocible. */

const K_TOKEN = 'switch_token_jwt';
const K_USUARIO = 'usuario_sesion_activa';
const K_ADMIN = 'switch_admin_token';

const ACC_DEFECTO = {
  escala: 1,
  altoContraste: false,
  paletaSuave: false,
  paletaMenta: false,
  blancoNegro: false,
  vistaAccesible: false,
};

function leerJSON(clave) {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? JSON.parse(crudo) : null;
  } catch (e) {
    return null;
  }
}

function escribirJSON(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {}
}

export const Store = {
  token: null,
  usuario: null,
  adminToken: null,
  acc: { ...ACC_DEFECTO },

  /* ---------- sesión ---------- */

  cargarSesion() {
    let token = null;
    try { token = localStorage.getItem(K_TOKEN); } catch (e) {}
    const usuario = leerJSON(K_USUARIO);
    if (usuario && usuario.rol === 'ADMIN') {
      this.token = null;
      this.usuario = null;
      this.borrarSesion();
      return;
    }
    this.token = token || null;
    this.usuario = usuario || null;
    if (!this.token || !this.usuario) {
      this.token = null;
      this.usuario = null;
    }
    try { this.adminToken = sessionStorage.getItem(K_ADMIN) || null; } catch (e) { this.adminToken = null; }
  },

  guardarSesion(datos) {
    const usuario = {
      id: datos.id,
      dni: datos.dni,
      nombre: datos.nombre,
      apellido: datos.apellido,
      nombreCompleto:
        datos.nombreCompleto ||
        [datos.nombre, datos.apellido].filter(Boolean).join(' ') ||
        'Vecino de Switch',
      telefono: datos.telefono || null,
      rol: datos.rol || 'VECINO',
      habilitado: datos.habilitado !== false,
      suspensionVigente: !!datos.suspensionVigente,
      suspendidoHasta: datos.suspendidoHasta || null,
      avisoSuspension: datos.avisoSuspension || null,
    };
    if (datos.token) {
      this.token = datos.token;
      try { localStorage.setItem(K_TOKEN, datos.token); } catch (e) {}
    }
    this.usuario = usuario;
    escribirJSON(K_USUARIO, usuario);
    return usuario;
  },

  borrarSesion() {
    this.token = null;
    this.usuario = null;
    try {
      localStorage.removeItem(K_TOKEN);
      localStorage.removeItem(K_USUARIO);
    } catch (e) {}
  },

  cerrarSesion() {
    this.borrarSesion();
    this.adminToken = null;
    try { sessionStorage.removeItem(K_ADMIN); } catch (e) {}
  },

  get sesionActiva() {
    return !!(this.token && this.usuario);
  },

  get esAdmin() {
    return !!this.adminToken;
  },

  get suspendido() {
    return !!(
      this.usuario &&
      (this.usuario.suspensionVigente || this.usuario.habilitado === false)
    );
  },

  guardarAdminToken(token) {
    this.adminToken = token;
    try { sessionStorage.setItem(K_ADMIN, token); } catch (e) {}
  },

  cerrarAdmin() {
    this.adminToken = null;
    try { sessionStorage.removeItem(K_ADMIN); } catch (e) {}
  },

  /* ---------- accesibilidad ---------- */

  cargarAccesibilidad() {
    const num = (v, def) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : def;
    };
    const bool = (v, def) => (v === null || v === undefined ? def : v === '1');

    try {
      this.acc = {
        escala: Math.min(1.5, Math.max(1, num(localStorage.getItem('acc_escala_texto'), 1))),
        altoContraste: bool(localStorage.getItem('acc_alto_contraste'), false),
        paletaSuave: bool(localStorage.getItem('acc_paleta_suave'), false),
        paletaMenta: bool(localStorage.getItem('acc_paleta_clara'), false),
        blancoNegro: bool(localStorage.getItem('acc_blanco_negro'), false),
        vistaAccesible: bool(localStorage.getItem('acc_vista_accesible'), false),
      };
    } catch (e) {
      this.acc = { ...ACC_DEFECTO };
    }
    if (this.acc.altoContraste && (this.acc.paletaSuave || this.acc.paletaMenta)) {
      this.acc.paletaSuave = false;
      this.acc.paletaMenta = false;
    }
    if (this.acc.paletaSuave && this.acc.paletaMenta) this.acc.paletaMenta = false;
    try { localStorage.removeItem('acc_paleta_menta'); } catch (e) {}
    return this.acc;
  },

  aplicarAccesibilidad() {
    const a = this.acc;
    const html = document.documentElement;
    html.style.setProperty('--escala', String(a.escala));
    const paleta = a.altoContraste
      ? 'contraste'
      : a.paletaSuave
        ? 'suave'
        : a.paletaMenta
          ? 'menta'
          : a.vistaAccesible
            ? 'accesible'
            : 'estandar';
    html.setAttribute('data-paleta', paleta);
    html.setAttribute('data-bn', a.blancoNegro ? '1' : '0');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        'content',
        paleta === 'suave' ? '#F6F3EE' : paleta === 'menta' ? '#0D9488' : paleta === 'estandar' ? '#0B132B' : '#000000'
      );
    }
  },

  guardarAccesibilidad(parcial) {
    this.acc = {
      ...this.acc,
      ...parcial,
      escala: Math.min(1.5, Math.max(1, Number(parcial.escala ?? this.acc.escala))),
    };
    if (this.acc.altoContraste) {
      this.acc.paletaSuave = false;
      this.acc.paletaMenta = false;
    }
    if (this.acc.paletaSuave) {
      this.acc.altoContraste = false;
      this.acc.paletaMenta = false;
    }
    if (this.acc.paletaMenta) {
      this.acc.altoContraste = false;
      this.acc.paletaSuave = false;
    }
    try {
      const a = this.acc;
      localStorage.setItem('acc_escala_texto', String(a.escala));
      localStorage.setItem('acc_alto_contraste', a.altoContraste ? '1' : '0');
      localStorage.setItem('acc_paleta_suave', a.paletaSuave ? '1' : '0');
      localStorage.setItem('acc_paleta_clara', a.paletaMenta ? '1' : '0');
      try { localStorage.removeItem('acc_paleta_menta'); } catch (e) {}
      localStorage.setItem('acc_blanco_negro', a.blancoNegro ? '1' : '0');
      localStorage.setItem('acc_vista_accesible', a.vistaAccesible ? '1' : '0');
    } catch (e) {}
    this.aplicarAccesibilidad();
    return this.acc;
  },

  restablecerAccesibilidad() {
    this.acc = { ...ACC_DEFECTO };
    try {
      Object.keys(ACC_DEFECTO).forEach((k) => {
        const clave = {
          escala: 'acc_escala_texto',
          altoContraste: 'acc_alto_contraste',
          paletaSuave: 'acc_paleta_suave',
          paletaMenta: 'acc_paleta_clara',
          blancoNegro: 'acc_blanco_negro',
          vistaAccesible: 'acc_vista_accesible',
        }[k];
        localStorage.removeItem(clave);
      });
    } catch (e) {}
    try { localStorage.removeItem('acc_paleta_menta'); } catch (e) {}
    this.aplicarAccesibilidad();
  },
};
