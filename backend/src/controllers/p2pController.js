const crypto = require('crypto');
const multer = require('multer');
const asyncWrapper = require('../middlewares/asyncWrapper');
const { ValidationError, ForbiddenError } = require('../utils/customErrors');
const { clasificarEsfuerzo } = require('../utils/clasificadorEsfuerzo');
const moderacionService = require('../services/moderacionService');
const ModeracionModel = require('../models/moderacionModel');
const P2PModel = require('../models/p2pModel');
const VoluntariadoModel = require('../models/voluntariadoModel');

// ==========================================
// Configuración de subida de imágenes
// ==========================================
// Extensión segura según el mimetype REAL del archivo (no confiamos en el
// nombre original, que puede venir vacío o con mayúsculas desde el celular).
const EXTENSION_POR_MIMETYPE = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/bmp': '.bmp'
};

const subirImagenMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mimetype = (file.mimetype || '').toLowerCase();
    // Se acepta cualquier imagen que el teléfono pueda producir (JPEG, PNG,
    // WEBP, GIF, HEIC/HEIF de iPhone, BMP). Se excluye SVG porque puede
    // contener código ejecutable.
    if (!mimetype.startsWith('image/') || mimetype === 'image/svg+xml') {
      return cb(new ValidationError('El archivo no es una imagen válida.'));
    }
    cb(null, true);
  }
});

/**
 * Obtener todas las publicaciones del Catálogo General P2P
 */
const listarCatálogoP2P = asyncWrapper(async (req, res) => {
  const { tipoItem, nivelEsfuerzo, busqueda } = req.query;

  const publicaciones = await P2PModel.obtenerCatalogoDisponible({ 
    tipoItem, 
    nivelEsfuerzo: nivelEsfuerzo || req.query.nivel_esfuerzo, 
    busqueda 
  });

  res.status(200).json({
    exito: true,
    datos: publicaciones
  });
});

/**
 * GET /api/catalogo/mis-publicaciones
 * Publicaciones activas del usuario logueado (para ofrecer en un trueque).
 * El usuario viene SIEMPRE del token.
 */
const listarMisPublicaciones = asyncWrapper(async (req, res) => {
  const publicaciones = await P2PModel.obtenerPublicacionesDeUsuario(req.usuario.id);

  res.status(200).json({
    exito: true,
    datos: publicaciones
  });
});

/**
 * POST /api/catalogo/clasificar-esfuerzo
 * Previsualiza el nivel de esfuerzo que se le asignará a una publicación.
 * Body: { titulo, descripcion, tipoItem }
 */
const previsualizarEsfuerzo = asyncWrapper(async (req, res) => {
  const { titulo, descripcion, tipoItem } = req.body;
  const nivelEsfuerzo = clasificarEsfuerzo(titulo, descripcion, tipoItem);

  res.status(200).json({
    exito: true,
    datos: { nivelEsfuerzo }
  });
});

/**
 * POST /api/catalogo/imagen (multipart, campo "imagen")
 * Guarda la foto en Neon y devuelve su URL de acceso, aún bajo moderación.
 */
const subirImagen = asyncWrapper(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('No se recibió ninguna imagen.');
  }

  const ext = EXTENSION_POR_MIMETYPE[(req.file.mimetype || '').toLowerCase()] || '.jpg';
  const nombreArchivo = `pub_${req.usuario.id}_${crypto.randomUUID()}${ext}`;
  // La imagen se limpia y se guarda en Neon: el filesystem efímero de Render
  // no debe ser la única copia de una foto subida.
  const evaluacion = moderacionService.evaluarImagen(req.file.buffer);

  const registro = await ModeracionModel.registrar({
    usuarioId: req.usuario.id,
    nombreArchivo,
    mimeDetectado: evaluacion.mimeDetectado || null,
    pesoBytes: evaluacion.bytes,
    datosImagen: evaluacion.datosImagen,
    evaluacion,
  });

  const url = `/api/catalogo/imagenes/${encodeURIComponent(nombreArchivo)}`;

  res.status(201).json({
    exito: true,
    mensaje: 'Imagen subida. Se mostrará cuando la moderación la apruebe.',
    datos: {
      url,
      nombreArchivo,
      moderacionId: registro.id,
      // El control que protege a las infancias es la revisión de una
      // persona, no este filtro.
      requiereRevisionHumana: true,
      marcadaPorFiltro: evaluacion.filtroEstado === 'RECHAZADA_TECNICAMENTE',
      aviso: evaluacion.filtroEstado === 'RECHAZADA_TECNICAMENTE'
          ? 'La imagen fue marcada por el filtro automático y necesita una revisión más cuidadosa. Puede ser rechazada.'
          : null,
    },
  });
});

const verImagenPublicada = asyncWrapper(async (req, res) => {
  const imagen = await ModeracionModel.obtenerImagenPublica(req.params.nombreArchivo);
  if (!imagen) {
    return res.status(404).json({
      exito: false,
      codigoEstado: 404,
      mensaje: 'La imagen no está disponible.',
    });
  }

  const mimeDetectado =
    imagen.mime_detectado || moderacionService.detectarFormato(imagen.datos_imagen)?.mime;
  if (!mimeDetectado) {
    return res.status(404).json({
      exito: false,
      codigoEstado: 404,
      mensaje: 'La imagen no está disponible.',
    });
  }

  res.setHeader('Content-Type', mimeDetectado);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(imagen.datos_imagen);
});

/**
 * Crear nueva publicación en el Catálogo P2P (Requiere Nexo Social Activo).
 * El nivel de esfuerzo se calcula automáticamente según lo que se ofrece:
 * no se acepta el valor enviado por el cliente.
 */
const crearPublicacionP2P = asyncWrapper(async (req, res) => {
  // El oferente siempre es el usuario de la sesión (no se confía en el body)
  const usuarioId = req.usuario.id;
  const tipoItem = req.body.tipoItem || req.body.tipo_item || 'OBJETO';
  // Se reassigna más abajo cuando la imagen es verificada: la URL definitiva
  // la arma el servidor, nunca el cliente.
  let imagenUrl = req.body.imagenUrl || req.body.imagen_url;
  const { titulo, descripcion } = req.body;
  // El cliente manda el nombre del archivo que le devolvió la subida, no una
  // URL arbitraria: así no se puede colgar en la publicación la foto de otro.
  const nombreArchivo = req.body.nombreArchivoImagen || req.body.nombre_archivo_imagen || null;

  if (!titulo || !descripcion) {
    throw new ValidationError('El título y la descripción son obligatorios.');
  }

  if (!['OBJETO', 'SERVICIO'].includes(tipoItem)) {
    throw new ValidationError('El tipo de publicación debe ser OBJETO o SERVICIO.');
  }

  // Si la publicación lleva imagen, tiene que ser una subida de ESTA persona
  // que siga esperando revisión. Sin este control, cualquiera podría pegar
  // la URL de otra imagen (o una cualquiera) y publicarla sin pasar por la
  // moderación.
  if (nombreArchivo) {
    const registro = await ModeracionModel.obtenerPorNombreYUsuario({
      nombreArchivo,
      usuarioId,
    });

    if (!registro) {
      throw new ValidationError(
        'Esa imagen no es tuya o no la subiste vos. Volvé a elegir la foto.'
      );
    }

    if (registro.decision) {
      throw new ValidationError('Esa imagen ya fue revisada. Subí una nueva.');
    }

    if (registro.publicacion_id) {
      throw new ValidationError('Esa imagen ya está usada en otra publicación.');
    }

    // La URL se arma en el servidor: no se acepta ninguna que venga del
    // cliente, para que apunte a la imagen que realmente se verificó.
    imagenUrl = `/api/catalogo/imagenes/${encodeURIComponent(nombreArchivo)}`;
  } else if (imagenUrl) {
    // Mandó una URL pero ningún nombre de archivo: no se puede verificar de
    // quién es, así que no se acepta.
    throw new ValidationError(
      'Para usar una imagen hay que subirla desde la app.'
    );
  }

  // Clasificación automática del nivel de esfuerzo
  const nivelEsfuerzo = clasificarEsfuerzo(titulo, descripcion, tipoItem);

  const tieneNexoActivo = await VoluntariadoModel.verificarNexoSocialActivo(usuarioId);

  if (!tieneNexoActivo) {
    throw new ForbiddenError("Debes colaborar previamente en una institución comunitaria para activar tu Nexo Social antes de publicar en el catálogo.");
  }

  // La publicación hereda el estado de la imagen: si tiene foto, queda en
  // cuarentena hasta que alguien la apruebe. Sin foto, la revisión se hace
  // sobre el texto, que también puede violar las normas de la plataforma.
  const nuevaPublicacion = await P2PModel.crearPublicacion({
    usuarioId,
    titulo,
    descripcion,
    nivelEsfuerzo,
    tipoItem,
    imagenUrl,
    nombreArchivoImagen: nombreArchivo || null
  });

  res.status(201).json({
    exito: true,
    mensaje: `Publicación creada con éxito. Esfuerzo calculado automáticamente: ${nivelEsfuerzo}. Quedará visible cuando la moderación la apruebe.`,
    datos: nuevaPublicacion
  });
});

module.exports = {
  listarCatálogoP2P,
  listarMisPublicaciones,
  previsualizarEsfuerzo,
  subirImagen,
  verImagenPublicada,
  subirImagenMiddleware,
  crearPublicacionP2P
};
