const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const instController = require('../controllers/instController');
const p2pController = require('../controllers/p2pController');
const adminController = require('../controllers/adminController');
const chatController = require('../controllers/chatController');
const reporteController = require('../controllers/reporteController');
const intercambioController = require('../controllers/intercambioController');
const usuarioController = require('../controllers/usuarioController');
const sugerenciaController = require('../controllers/sugerenciaController');
const legalController = require('../controllers/legalController');
const otpController = require('../controllers/otpController');
const moderacionController = require('../controllers/moderacionController');
const contactoController = require('../controllers/contactoController');

const { requerirSesion, requerirSesionOpcional, requiereCuentaHabilitada, requerirAdmin } = require('../middlewares/auth');

// Documentos legales (públicos). Se consultan antes de tener cuenta.
router.get('/legal', legalController.listarDocumentos);
router.get('/legal/:documento', legalController.obtenerDocumento);

// Verificación del teléfono por código de un solo uso (públicas)
router.post('/auth/otp/solicitar', otpController.solicitarCodigo);
router.post('/auth/otp/verificar', otpController.verificarCodigo);

// Rutas de Autenticación / Registro (públicas)
router.post('/auth/registro', authController.registrarUsuario);
router.post('/auth/login', authController.loginUsuario);

// Rutas de Instituciones y Cupos de Necesidad (lectura pública)
router.get('/instituciones', instController.listarInstituciones);
router.get('/instituciones/:institucionId/cupos', instController.obtenerCuposAbiertos);
router.post('/instituciones/registro', instController.registrarInstitucion);
router.post('/validaciones/qr-scan', requerirSesion, requiereCuentaHabilitada, instController.validarPresenciaQR);

// Rutas del Catálogo P2P (lectura pública, escritura con sesión)
router.get('/catalogo', p2pController.listarCatálogoP2P);
router.get('/catalogo/mis-publicaciones', requerirSesion, p2pController.listarMisPublicaciones);
router.post('/catalogo/clasificar-esfuerzo', p2pController.previsualizarEsfuerzo);
router.post('/catalogo/imagen', requerirSesion, requiereCuentaHabilitada, p2pController.subirImagenMiddleware.single('imagen'), p2pController.subirImagen);
router.post('/catalogo/publicar', requerirSesion, requiereCuentaHabilitada, p2pController.crearPublicacionP2P);
// Sugerir esfuerzo sigue permitido con el Nexo vencido: es una contribución,
// no una operación de intercambio. Bloquea igual si la cuenta está suspendida.
router.post('/catalogo/:publicacionId/sugerir-esfuerzo', requerirSesion, requiereCuentaHabilitada, sugerenciaController.sugerirEsfuerzo);

// Rutas de Chat / Mensajería (privadas). Con la cuenta suspendida se puede leer
// la conversación pero no escribir; con el Nexo vencido, tampoco enviar.
router.get('/mensajes', requerirSesion, chatController.obtenerMensajes);
router.post('/mensajes/enviar', requerirSesion, requiereCuentaHabilitada, chatController.enviarMensaje);

// Rutas de Intercambios / Trueques
router.post('/intercambios/proponer', requerirSesion, requiereCuentaHabilitada, intercambioController.proponerIntercambio);
router.get('/intercambios/mis-propuestas', requerirSesion, intercambioController.listarMisPropuestas);
router.post('/intercambios/:id/responder', requerirSesion, requiereCuentaHabilitada, intercambioController.responderPropuesta);
router.post('/intercambios/:id/confirmar', requerirSesion, requiereCuentaHabilitada, intercambioController.confirmarTrueque);

// Rutas de Reportes / Denuncias
router.post('/reportes', requerirSesion, requiereCuentaHabilitada, reporteController.reportarUsuario);

// Rutas de Perfil de Usuario
router.get('/usuarios/perfil', requerirSesion, usuarioController.obtenerMiPerfil);

// 🟢 Rutas de Administración (Dashboard y Moderación) — solo rol ADMIN
router.get('/admin/estadisticas', requerirSesion, requerirAdmin, adminController.obtenerEstadisticasAdmin);
router.get('/admin/reportes', requerirSesion, requerirAdmin, reporteController.listarReportes);
router.post('/admin/reportes/:reporteId/desestimar', requerirSesion, requiereCuentaHabilitada, requerirAdmin, reporteController.desestimarReporte);
router.post('/admin/dar-de-baja', requerirSesion, requiereCuentaHabilitada, requerirAdmin, reporteController.darDeBajaUsuario);
router.post('/admin/suspender', requerirSesion, requiereCuentaHabilitada, requerirAdmin, reporteController.suspenderUsuario);
// Camino inverso al bloqueo: ver y levantar cuentas penalizadas o dadas de baja.
router.get('/admin/usuarios-bloqueados', requerirSesion, requerirAdmin, reporteController.listarUsuariosBloqueados);
router.post('/admin/reactivar', requerirSesion, requiereCuentaHabilitada, requerirAdmin, reporteController.reactivarUsuario);
router.get('/admin/sugerencias-esfuerzo', requerirSesion, requerirAdmin, sugerenciaController.listarSugerencias);
router.post('/admin/sugerencias-esfuerzo/:id/aplicar', requerirSesion, requiereCuentaHabilitada, requerirAdmin, sugerenciaController.aplicarSugerencia);
router.post('/admin/sugerencias-esfuerzo/:id/descartar', requerirSesion, requiereCuentaHabilitada, requerirAdmin, sugerenciaController.descartarSugerencia);

// Moderación de imágenes. La cola se lee sin sesión de escritura (es un
// panel de trabajo); aprobar o rechazar sí cuenta como escritura y exige
// cuenta habilitada, como el resto de las acciones de administración.
router.get('/admin/moderacion/pendientes', requerirSesion, requerirAdmin, moderacionController.listarPendientes);
router.get('/admin/moderacion/estadisticas', requerirSesion, requerirAdmin, moderacionController.obtenerEstadisticas);
// Sólo para cuentas admin: es la única forma de abrir una imagen en cuarentena.
router.get('/admin/moderacion/:id/imagen', requerirSesion, requerirAdmin, moderacionController.verImagen);
router.post('/admin/moderacion/:id/aprobar', requerirSesion, requiereCuentaHabilitada, requerirAdmin, moderacionController.aprobarImagen);
router.post('/admin/moderacion/:id/rechazar', requerirSesion, requiereCuentaHabilitada, requerirAdmin, moderacionController.rechazarImagen);
router.post('/admin/moderacion/:id/rechazar-menor', requerirSesion, requiereCuentaHabilitada, requerirAdmin, moderacionController.rechazarPorMenorDeEdad);
// Publicaciones sin imagen: la revisión es sobre el texto.
router.post('/admin/moderacion/texto/:id/aprobar', requerirSesion, requiereCuentaHabilitada, requerirAdmin, moderacionController.aprobarPublicacionSinImagen);
router.post('/admin/moderacion/texto/:id/rechazar', requerirSesion, requiereCuentaHabilitada, requerirAdmin, moderacionController.rechazarPublicacionSinImagen);
router.post('/admin/moderacion/texto/:id/rechazar-menor', requerirSesion, requiereCuentaHabilitada, requerirAdmin, moderacionController.marcarPublicacionComoMenor);

// Buzón de contacto. La sesión es opcional a propósito: si viene, se guarda
// el nombre, DNI y teléfono del autor para poder responderle; si no viene,
// también se puede escribir. Así una persona a la que acaban de bloquear la
// cuenta no se queda sin forma de preguntar nada.
router.post('/contacto', requerirSesionOpcional, contactoController.crearMensaje);

// Buzón de contacto del panel. Todas las rutas de lectura y respuesta las ve
// sólo el administrador: es el canal para contestar lo que llega.
router.get('/admin/contacto', requerirSesion, requerirAdmin, contactoController.listarMensajes);
router.get('/admin/contacto/pendientes', requerirSesion, requerirAdmin, contactoController.contarMensajesPendientes);
router.get('/admin/contacto/:id', requerirSesion, requerirAdmin, contactoController.obtenerMensaje);
router.post('/admin/contacto/:id/responder', requerirSesion, requiereCuentaHabilitada, requerirAdmin, contactoController.responderMensaje);
router.post('/admin/contacto/:id/leer', requerirSesion, requerirAdmin, contactoController.marcarLeido);
router.delete('/admin/contacto/:id', requerirSesion, requiereCuentaHabilitada, requerirAdmin, contactoController.eliminarMensaje);

module.exports = router;
