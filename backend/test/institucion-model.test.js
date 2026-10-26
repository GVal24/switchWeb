const assert = require('node:assert/strict');
const { test } = require('node:test');

const dbPath = require.resolve('../src/config/db');
const db = {
  query: async () => ({ rows: [] }),
  pool: {
    connect: async () => {
      throw new Error('Unexpected database connection');
    },
  },
};
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: db,
};

const InstitucionModel = require('../src/models/institucionModel');

function configurarCliente({ institucion, usuario, membership } = {}) {
  const consultas = [];
  let liberado = false;
  const client = {
    async query(sql, params) {
      consultas.push({ sql, params });
      if (/SELECT id, nombre FROM instituciones/.test(sql)) {
        return { rows: institucion ? [institucion] : [] };
      }
      if (/SELECT id, dni, nombre, apellido, activo/.test(sql)) {
        return { rows: usuario ? [usuario] : [] };
      }
      if (/INSERT INTO institucion_membresias/.test(sql)) {
        return { rows: [membership] };
      }
      return { rows: [] };
    },
    release() {
      liberado = true;
    },
  };
  db.pool.connect = async () => client;
  return {
    consultas,
    fueLiberado: () => liberado,
  };
}

test('responsable assignment locks records and commits a membership for the existing user', async () => {
  const client = configurarCliente({
    institucion: { id: 8, nombre: 'Biblioteca' },
    usuario: { id: 21, dni: '12345678', nombre: 'Ana', apellido: 'Pérez', activo: true },
    membership: { id: 2, institucion_id: 8, usuario_id: 21, rol: 'RESPONSABLE', activo: true },
  });

  const result = await InstitucionModel.asignarResponsable(8, '12345678', 1);

  assert.equal(result.usuario.id, 21);
  assert.equal(result.membresia.rol, 'RESPONSABLE');
  assert.match(client.consultas[1].sql, /instituciones WHERE id = \$1 FOR UPDATE/);
  assert.match(client.consultas[2].sql, /usuarios[\s\S]*WHERE dni = \$1[\s\S]*FOR UPDATE/);
  assert.match(client.consultas[3].sql, /SET activo = FALSE/);
  assert.match(client.consultas[4].sql, /ON CONFLICT \(institucion_id, usuario_id\)/);
  assert.equal(client.consultas.at(-1).sql, 'COMMIT');
  assert.equal(client.fueLiberado(), true);
});

test('inactive user cannot be assigned and the transaction rolls back', async () => {
  const client = configurarCliente({
    institucion: { id: 8, nombre: 'Biblioteca' },
    usuario: { id: 21, dni: '12345678', nombre: 'Ana', apellido: 'Pérez', activo: false },
  });

  await assert.rejects(
    InstitucionModel.asignarResponsable(8, '12345678', 1),
    /está dada de baja/
  );

  assert.equal(client.consultas.at(-1).sql, 'ROLLBACK');
  assert.equal(client.fueLiberado(), true);
  assert.equal(client.consultas.some(({ sql }) => /INSERT INTO institucion_membresias/.test(sql)), false);
});

test('missing institution rolls back without assigning a membership', async () => {
  const client = configurarCliente({
    usuario: { id: 21, dni: '12345678', nombre: 'Ana', apellido: 'Pérez', activo: true },
  });

  await assert.rejects(
    InstitucionModel.asignarResponsable(999, '12345678', 1),
    /No encontramos la institución/
  );

  assert.equal(client.consultas.at(-1).sql, 'ROLLBACK');
  assert.equal(client.fueLiberado(), true);
});

test('need edits cannot lower capacity below help already registered', async () => {
  const queryOriginal = db.query;
  let query;
  let params;
  db.query = async (sql, values) => {
    query = sql;
    params = values;
    return { rows: [] };
  };
  try {
    const updated = await InstitucionModel.actualizarNecesidad(4, 9, {
      titulo: 'Apoyo escolar',
      descripcion: '',
      prioridad: 'GENERAL',
      cupoMaximo: 2,
    });
    assert.equal(updated, null);
    assert.match(query, /cupo_actual < \$6/);
    assert.match(query, /activo = NOT pausado_manualmente AND cupo_actual < \$6/);
    assert.deepEqual(params, [4, 9, 'Apoyo escolar', '', 'GENERAL', 2]);
  } finally {
    db.query = queryOriginal;
  }
});

test('institution panel returns monthly collaboration counts for the last twelve months', async () => {
  const queryOriginal = db.query;
  let query;
  let params;
  db.query = async (sql, values) => {
    query = sql;
    params = values;
    return { rows: [] };
  };
  try {
    await InstitucionModel.obtenerPanelUsuario(14);
    assert.match(query, /generate_series\([\s\S]*INTERVAL '11 months'/);
    assert.match(query, /n\.fecha_activacion >= meses\.mes/);
    assert.match(query, /n\.fecha_activacion < meses\.mes \+ INTERVAL '1 month'/);
    assert.match(query, /json_build_object\([\s\S]*'mes'[\s\S]*'colaboraciones'/);
    assert.deepEqual(params, [14]);
  } finally {
    db.query = queryOriginal;
  }
});

test('institution membership middleware denies cross-institution access', async () => {
  const InstitucionAcceso = require('../src/middlewares/institucionAcceso');
  const original = InstitucionModel.obtenerMembresiaActiva;
  InstitucionModel.obtenerMembresiaActiva = async () => null;
  try {
    const error = await new Promise((resolve) => {
      InstitucionAcceso.requerirMembresiaInstitucion(
        { params: { institucionId: '12' }, usuario: { id: 3 } },
        {},
        resolve
      );
    });
    assert.equal(error.statusCode, 403);
  } finally {
    InstitucionModel.obtenerMembresiaActiva = original;
  }
});

test('only institution responsible can manage its delegates', async () => {
  const InstitucionAcceso = require('../src/middlewares/institucionAcceso');
  const error = await new Promise((resolve) => {
    InstitucionAcceso.requerirResponsableInstitucion(
      { membresiaInstitucion: { rol: 'DELEGADO' } },
      {},
      resolve
    );
  });
  assert.equal(error.statusCode, 403);
});

test('institution need validation rejects invalid cupos and priorities', () => {
  const controller = require('../src/controllers/institucionAdminController');
  assert.throws(
    () => controller.validarNecesidad({ titulo: 'Pedido', prioridad: 'URGENTISIMA', cupoMaximo: 2 }),
    /prioridad indicada no es válida/
  );
  assert.throws(
    () => controller.validarNecesidad({ titulo: 'Pedido', prioridad: 'URGENTE', cupoMaximo: 0 }),
    /entre 1 y 999/
  );
});

test('delegates can only be added under an existing institution and active account', async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (/SELECT id FROM instituciones/.test(sql)) return { rowCount: 1, rows: [{ id: 8 }] };
      if (/SELECT id, dni, nombre, apellido, activo FROM usuarios/.test(sql)) {
        return { rowCount: 1, rows: [{ id: 21, dni: '12345678', nombre: 'Ana', apellido: 'Pérez', activo: true }] };
      }
      if (/SELECT id FROM institucion_membresias/.test(sql)) return { rowCount: 0, rows: [] };
      if (/INSERT INTO institucion_membresias/.test(sql)) {
        return { rows: [{ id: 3, institucion_id: 8, usuario_id: 21, rol: 'DELEGADO', activo: true }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  db.pool.connect = async () => client;

  const resultado = await InstitucionModel.agregarDelegado(8, '12345678', 14);
  assert.equal(resultado.membresia.rol, 'DELEGADO');
  assert.match(queries[1], /instituciones WHERE id = \$1 FOR UPDATE/);
  assert.equal(queries.at(-1), 'COMMIT');
});

test('responsible account cannot be added as its own delegate', async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (/SELECT id FROM instituciones/.test(sql)) return { rowCount: 1, rows: [{ id: 8 }] };
      if (/SELECT id, dni, nombre, apellido, activo FROM usuarios/.test(sql)) {
        return { rowCount: 1, rows: [{ id: 21, dni: '12345678', nombre: 'Ana', apellido: 'Pérez', activo: true }] };
      }
      if (/SELECT id FROM institucion_membresias/.test(sql)) return { rowCount: 1, rows: [{ id: 2 }] };
      return { rows: [] };
    },
    release() {},
  };
  db.pool.connect = async () => client;

  await assert.rejects(
    InstitucionModel.agregarDelegado(8, '12345678', 14),
    /no puede agregarse también como delegada/
  );
  assert.equal(queries.at(-1), 'ROLLBACK');
  assert.equal(queries.some((query) => /INSERT INTO institucion_membresias/.test(query)), false);
});
