const assert = require('node:assert/strict');
const { test } = require('node:test');

function mockear(ruta, exports) {
  const id = require.resolve(ruta);
  require.cache[id] = { id, filename: id, loaded: true, exports };
  return exports;
}

const ChatModel = mockear('../src/models/chatModel', {
  obtenerPorId: async () => null,
  marcarLeido: async () => null,
  listarNoLeidos: async () => [],
});
const InstitucionModel = mockear('../src/models/institucionModel', {
  obtenerMembresiaActiva: async () => null,
});
mockear('../src/models/usuarioModel', {});
mockear('../src/models/voluntariadoModel', {});

const chatController = require('../src/controllers/chatController');

function llamar(controlador, req) {
  return new Promise((resolve) => {
    let respondido = false;
    const res = {
      codigo: 200,
      status(codigo) {
        this.codigo = codigo;
        return this;
      },
      json(payload) {
        respondido = true;
        resolve({ codigo: this.codigo, payload });
      },
    };
    controlador(req, res, (error) => {
      if (!respondido) resolve({ error });
    });
  });
}

function reiniciar() {
  ChatModel.obtenerPorId = async () => null;
  ChatModel.marcarLeido = async (id) => ({ id, leido: true });
  ChatModel.listarNoLeidos = async () => [];
  InstitucionModel.obtenerMembresiaActiva = async () => null;
}

test('la bandeja propia se puede consultar', async () => {
  reiniciar();
  let consultado = null;
  ChatModel.listarNoLeidos = async (receptorId) => {
    consultado = receptorId;
    return [{ id: 1, receptor_id: '18' }];
  };

  const r = await llamar(chatController.obtenerNoLeidos, {
    usuario: { id: 18 },
    query: { receptorId: '18' },
  });

  assert.equal(r.codigo, 200);
  assert.equal(consultado, '18');
  assert.equal(r.payload.datos.length, 1);
});

test('no se puede leer la bandeja de otra persona', async () => {
  reiniciar();
  let consultado = false;
  ChatModel.listarNoLeidos = async () => {
    consultado = true;
    return [];
  };

  const r = await llamar(chatController.obtenerNoLeidos, {
    usuario: { id: 18 },
    query: { receptorId: '16' },
  });

  assert.equal(r.error.statusCode, 403);
  assert.equal(consultado, false);
});

test('la bandeja institucional exige una membresía activa', async () => {
  reiniciar();

  const sinMembresia = await llamar(chatController.obtenerNoLeidos, {
    usuario: { id: 18 },
    query: { receptorId: 'inst_1' },
  });
  assert.equal(sinMembresia.error.statusCode, 403);

  InstitucionModel.obtenerMembresiaActiva = async (institucionId, usuarioId) =>
    institucionId === 1 && usuarioId === 18 ? { id: 3, rol: 'RESPONSABLE' } : null;

  const conMembresia = await llamar(chatController.obtenerNoLeidos, {
    usuario: { id: 18 },
    query: { receptorId: 'inst_1' },
  });
  assert.equal(conMembresia.codigo, 200);
});

test('el emisor no puede marcar como leído su propio mensaje', async () => {
  reiniciar();
  ChatModel.obtenerPorId = async () => ({
    id: 7,
    emisor_id: '17',
    receptor_id: '16',
  });
  let actualizado = false;
  ChatModel.marcarLeido = async () => {
    actualizado = true;
  };

  const r = await llamar(chatController.marcarMensajeLeido, {
    usuario: { id: 17 },
    params: { id: '7' },
  });

  assert.equal(r.error.statusCode, 403);
  assert.equal(actualizado, false);
});

test('el receptor puede marcar como leído un mensaje personal', async () => {
  reiniciar();
  ChatModel.obtenerPorId = async () => ({
    id: 7,
    emisor_id: '17',
    receptor_id: '16',
  });

  const r = await llamar(chatController.marcarMensajeLeido, {
    usuario: { id: 16 },
    params: { id: '7' },
  });

  assert.equal(r.codigo, 200);
  assert.equal(r.payload.datos.leido, true);
});

test('un mensaje institucional sólo lo marca un miembro de la institución', async () => {
  reiniciar();
  ChatModel.obtenerPorId = async () => ({
    id: 9,
    emisor_id: '16',
    receptor_id: 'inst_1',
  });

  const ajeno = await llamar(chatController.marcarMensajeLeido, {
    usuario: { id: 18 },
    params: { id: '9' },
  });
  assert.equal(ajeno.error.statusCode, 403);

  InstitucionModel.obtenerMembresiaActiva = async () => ({ id: 3, rol: 'RESPONSABLE' });
  const miembro = await llamar(chatController.marcarMensajeLeido, {
    usuario: { id: 18 },
    params: { id: '9' },
  });
  assert.equal(miembro.codigo, 200);
});
