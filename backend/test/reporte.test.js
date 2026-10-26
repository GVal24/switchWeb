const assert = require('node:assert/strict');
const { test } = require('node:test');

const dbPath = require.resolve('../src/config/db');
const db = { query: async () => ({ rows: [] }) };
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: db,
};
const ReporteModel = require('../src/models/reporteModel');

test('report creation gets the reporter name from the authenticated user record', async () => {
  const queryOriginal = db.query;
  let queryEjecutada;
  let valores;
  const reporte = { reportante_nombre: 'Nombre Desde La Base' };

  db.query = async (query, params) => {
    queryEjecutada = query;
    valores = params;
    return { rows: [reporte] };
  };

  try {
    const creado = await ReporteModel.crear({
      reportanteId: 12,
      reportanteNombre: 'Nombre falso',
      reportadoId: 4,
      reportadoNombre: 'Persona reportada',
      motivo: 'Descripción del problema',
    });

    assert.equal(creado, reporte);
    assert.match(queryEjecutada, /BTRIM\(CONCAT_WS\(' ', u\.nombre, u\.apellido\)\)/);
    assert.match(queryEjecutada, /WHERE u\.id = \$1/);
    assert.deepEqual(valores, [12, '4', 'Persona reportada', 'Descripción del problema']);
  } finally {
    db.query = queryOriginal;
  }
});

test('report endpoint ignores reporter identity supplied by the client', async () => {
  const controller = require('../src/controllers/reporteController');
  const crearOriginal = ReporteModel.crear;
  let datosReporte;

  ReporteModel.crear = async (datos) => {
    datosReporte = datos;
  };

  try {
    const response = {};
    const respuesta = new Promise((resolve, reject) => {
      const res = {
        status(status) {
          response.status = status;
          return this;
        },
        json(body) {
          response.body = body;
          resolve();
        },
      };

      controller.reportarUsuario(
        {
          usuario: { id: 12 },
          body: {
            reportanteId: 999,
            reportanteNombre: 'Nombre falso',
            reportadoId: 4,
            reportadoNombre: 'Persona reportada',
            motivo: 'Descripción del problema',
          },
        },
        res,
        reject
      );
    });

    await respuesta;

    assert.deepEqual(datosReporte, {
      reportanteId: 12,
      reportadoId: 4,
      reportadoNombre: 'Persona reportada',
      motivo: 'Descripción del problema',
    });
    assert.equal(response.status, 201);
  } finally {
    ReporteModel.crear = crearOriginal;
  }
});

test('admin report listing falls back to the user name for older reports without one', async () => {
  const queryOriginal = db.query;
  let queryEjecutada;

  db.query = async (query) => {
    queryEjecutada = query;
    return { rows: [] };
  };

  try {
    await ReporteModel.obtenerTodos();

    assert.match(queryEjecutada, /NULLIF\(BTRIM\(r\.reportante_nombre\), ''\)/);
    assert.match(queryEjecutada, /u\.id::text = r\.reportante_id/);
    assert.match(queryEjecutada, /AS reportante_nombre/);
  } finally {
    db.query = queryOriginal;
  }
});
