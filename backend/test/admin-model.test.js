const assert = require('node:assert/strict');
const { test } = require('node:test');

const dbPath = require.resolve('../src/config/db');
const queries = [];
const db = {
  query: async (sql) => {
    queries.push(sql);
    if (/FROM nexos_sociales n\s+JOIN instituciones/.test(sql)) {
      return {
        rows: [
          { tipo: 'COMEDOR', colaboraciones: 12 },
          { tipo: 'BIBLIOTECA', colaboraciones: 4 },
        ],
      };
    }
    if (/FROM usuarios/.test(sql)) return { rows: [{ total: 3 }] };
    if (/FROM intercambios\s+WHERE creado_en/.test(sql)) return { rows: [{ total: 2 }] };
    if (/FROM nexos_sociales;/.test(sql)) return { rows: [{ total: 16 }] };
    if (/FROM reportes/.test(sql)) return { rows: [{ total: 0 }] };
    if (/generate_series/.test(sql)) {
      return { rows: [{ mes: 'May', total: 1 }, { mes: 'Jun', total: 2 }] };
    }
    if (/ROUND\(100\.0 \* SUM/.test(sql)) return { rows: [{ tasa: 50 }] };
    throw new Error(`Unexpected admin query: ${sql}`);
  },
};

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: db,
};

const AdminModel = require('../src/models/adminModel');

test('admin metrics include institutional collaborations grouped by institution type', async () => {
  const metrics = await AdminModel.obtenerMetricasGlobales();

  assert.deepEqual(metrics.ayudaInstituciones, [
    { tipo: 'COMEDOR', colaboraciones: 12 },
    { tipo: 'BIBLIOTECA', colaboraciones: 4 },
  ]);
  assert.ok(queries.some((sql) => /GROUP BY COALESCE\(NULLIF\(BTRIM\(i\.tipo\), ''\), 'OTRO'\)/.test(sql)));
  assert.ok(queries.some((sql) => /JOIN instituciones i ON i\.id = n\.institucion_id/.test(sql)));
  assert.equal(Object.hasOwn(metrics, 'esfuerzoDistribucion'), false);
});
