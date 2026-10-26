const assert = require('node:assert/strict');
const { test } = require('node:test');

const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { query: async () => ({ rows: [] }) },
};

const ModeracionModel = require('../src/models/moderacionModel');
const moderacionService = require('../src/services/moderacionService');
const p2pController = require('../src/controllers/p2pController');
const { JPEG_BASE } = require('./fixtures/generarImagenesPrueba');

test('image evaluation exposes the detected MIME type for database storage', () => {
  const resultado = moderacionService.evaluarImagen(Buffer.from(JPEG_BASE, 'base64'));

  assert.equal(resultado.mimeDetectado, 'image/jpeg');
});

test('public image endpoint infers MIME for approved images stored without it', async () => {
  const obtenerImagenOriginal = ModeracionModel.obtenerImagenPublica;
  const bytesImagen = Buffer.from(JPEG_BASE, 'base64');
  ModeracionModel.obtenerImagenPublica = async () => ({
    datos_imagen: bytesImagen,
    mime_detectado: null,
  });

  try {
    const headers = {};
    let imagenEnviada;
    const respuesta = new Promise((resolve, reject) => {
      const res = {
        setHeader(nombre, valor) {
          headers[nombre] = valor;
          return this;
        },
        send(bytes) {
          imagenEnviada = bytes;
          resolve();
        },
      };

      p2pController.verImagenPublicada(
        { params: { nombreArchivo: 'pub_test.jpg' } },
        res,
        reject
      );
    });

    await respuesta;

    assert.equal(headers['Content-Type'], 'image/jpeg');
    assert.equal(imagenEnviada, bytesImagen);
  } finally {
    ModeracionModel.obtenerImagenPublica = obtenerImagenOriginal;
  }
});
