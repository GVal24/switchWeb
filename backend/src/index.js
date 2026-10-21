const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });

const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const almacenImagenes = require('./services/almacenImagenes');

const app = express();
const PORT = process.env.PORT || 3000;

// ConfiguraciÃ³n de Middlewares
//
// CORS: si la variable ORIGENES_PERMITIDOS tiene una lista separada por
// comas, sÃ³lo se aceptan esos orÃ­genes (por ejemplo, la web publicada en
// Vercel). Si no estÃ¡ definida, se acepta cualquier origen (Ãºtil para
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

// ImÃ¡genes subidas por los usuarios (fotos de publicaciones)
// ImÃ¡genes del catÃ¡logo.
//
// Se sirven SOLO las que ya fueron aprobadas por moderaciÃ³n. Las que estÃ¡n
// en uploads/_cuarena/ quedan bloqueadas acÃ¡: si se sirvieran, cualquiera
// con el nombre del archivo podrÃ­a ver una imagen que la plataforma todavÃ­a
// no aprobÃ³ (incluidas las marcadas como posible imagen de un menor).
app.use('/uploads', (req, res, next) => {
  const relativo = decodeURIComponent(req.path || '');
  const partes = relativo.split('/').filter(Boolean);

  if (partes.length === 0 || partes[0] === almacenImagenes.PREFIJO_CUARENA) {
    return res.status(404).json({
      exito: false,
      codigoEstado: 404,
      mensaje: 'La imagen no estÃ¡ disponible.',
    });
  }

  // Cualquier intento de meterse en una subcarpeta (subidas, ..) se rechaza:
  // el catÃ¡logo sÃ³lo tiene archivos sueltos en la raÃ­z de uploads/.
  if (partes.length > 1) {
    return res.status(404).json({
      exito: false,
      codigoEstado: 404,
      mensaje: 'La imagen no estÃ¡ disponible.',
    });
  }

  return next();
});
app.use('/uploads', express.static(almacenImagenes.DIR_UPLOADS));

// Ruta RaÃ­z - Estado de la API.
// Si la peticiÃ³n viene de un navegador, se lo lleva a la aplicaciÃ³n web.
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

// AplicaciÃ³n web (PWA). Se sirve bajo /app para no tapar la ruta de estado
// de la API ni las rutas /api y /uploads.
app.use(
  '/app',
  express.static(path.resolve(__dirname, '../../frontend-web'), {
    extensions: ['html'],
    etag: false,
    lastModified: false,
    setHeaders: (res, archivo) => {
      if (archivo.endsWith('.js') || archivo.endsWith('.css') || archivo.endsWith('.html') || archivo.endsWith('sw.js') || archivo.endsWith('manifest.webmanifest')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  })
);

// Middleware Centralizado de GestiÃ³n de Errores (Siempre al final)
app.use(errorHandler);

// Se exporta la app para que las pruebas puedan levantarla en un puerto
// efÃ­mero. SÃ³lo se inicia el servidor cuando el archivo se ejecuta directo.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ðŸš€ Servidor Switch corriendo exitosamente en http://localhost:${PORT}`);
  });
}

module.exports = app;

// deploy trigger
