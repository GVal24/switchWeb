const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });

const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const almacenImagenes = require('./services/almacenImagenes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares
//
// CORS: si la variable ORIGENES_PERMITIDOS tiene una lista separada por
// comas, sólo se aceptan esos orígenes (por ejemplo, la web publicada en
// Vercel). Si no está definida, se acepta cualquier origen (útil para
// desarrollo local y pruebas). Las peticiones sin cabecera Origin (apps
// nativas, curl, pruebas) siempre pasan.
const origenesPermitidos = String(process.env.ORIGENES_PERMITIDOS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors(
    origenesPermitidos.length
      ? {
          origin(origin, callback) {
            if (!origin || origenesPermitidos.includes(origin)) return callback(null, true);
            return callback(null, false);
          },
        }
      : {}
  )
);
app.use(express.json());

// Imágenes subidas por los usuarios (fotos de publicaciones)
// Imágenes del catálogo.
//
// Se sirven SOLO las que ya fueron aprobadas por moderación. Las que están
// en uploads/_cuarena/ quedan bloqueadas acá: si se sirvieran, cualquiera
// con el nombre del archivo podría ver una imagen que la plataforma todavía
// no aprobó (incluidas las marcadas como posible imagen de un menor).
app.use('/uploads', (req, res, next) => {
  const relativo = decodeURIComponent(req.path || '');
  const partes = relativo.split('/').filter(Boolean);

  if (partes.length === 0 || partes[0] === almacenImagenes.PREFIJO_CUARENA) {
    return res.status(404).json({
      exito: false,
      codigoEstado: 404,
      mensaje: 'La imagen no está disponible.',
    });
  }

  // Cualquier intento de meterse en una subcarpeta (subidas, ..) se rechaza:
  // el catálogo sólo tiene archivos sueltos en la raíz de uploads/.
  if (partes.length > 1) {
    return res.status(404).json({
      exito: false,
      codigoEstado: 404,
      mensaje: 'La imagen no está disponible.',
    });
  }

  return next();
});
app.use('/uploads', express.static(almacenImagenes.DIR_UPLOADS));

// Ruta Raíz - Estado de la API.
// Si la petición viene de un navegador, se lo lleva a la aplicación web.
app.get('/', (req, res) => {
  const aceptaHtml = String(req.headers.accept || '').includes('text/html');
  if (aceptaHtml) return res.redirect('/app/');

  res.json({
    proyecto: 'Switch',
    estado: 'API REST Operativa',
    version: '2.0.0',
    comunidad: 'Switch'
  });
});

// Rutas de la API
app.use('/api', routes);

// Aplicación web (PWA). Se sirve bajo /app para no tapar la ruta de estado
// de la API ni las rutas /api y /uploads.
app.use(
  '/app',
  express.static(path.resolve(__dirname, '../../frontend-web'), {
    extensions: ['html'],
    setHeaders: (res, archivo) => {
      if (archivo.endsWith('sw.js') || archivo.endsWith('manifest.webmanifest')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// Middleware Centralizado de Gestión de Errores (Siempre al final)
app.use(errorHandler);

// Se exporta la app para que las pruebas puedan levantarla en un puerto
// efímero. Sólo se inicia el servidor cuando el archivo se ejecuta directo.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Switch corriendo exitosamente en http://localhost:${PORT}`);
  });
}

module.exports = app;
