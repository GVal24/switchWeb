const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'switch-test-jwt-secret';
process.env.OTP_HMAC_SECRET = 'switch-test-otp-secret';

const otpModelPath = require.resolve('../src/models/otpModel');
const otpRecord = {
  id: 41,
  telefono: '5491123456789',
  proposito: 'RESTABLECIMIENTO',
  canal: 'SMS',
  codigo_hash: '',
};
let intentos = 0;

require.cache[otpModelPath] = {
  id: otpModelPath,
  filename: otpModelPath,
  loaded: true,
  exports: {
    async obtenerActivo({ telefono, proposito }) {
      assert.equal(telefono, otpRecord.telefono);
      assert.equal(proposito, otpRecord.proposito);
      return otpRecord;
    },
    async marcarConsumido(id) {
      assert.equal(id, otpRecord.id);
      return { id, telefono: otpRecord.telefono, canal: otpRecord.canal };
    },
    async sumarIntento() {
      intentos += 1;
      return { intentos, max_intentos: 5 };
    },
  },
};

const OtpService = require('../src/services/otpService');
const jwt = require('jsonwebtoken');
otpRecord.codigo_hash = OtpService.hashearCodigo(
  otpRecord.telefono,
  otpRecord.proposito,
  '123456'
);

test('valid recovery OTP is consumed and purpose-bound', async () => {
  const resultado = await OtpService.verificar({
    telefono: otpRecord.telefono,
    codigo: '123456',
    proposito: otpRecord.proposito,
  });
  const comprobante = jwt.verify(resultado.tokenVerificacion, process.env.JWT_SECRET);

  assert.equal(resultado.verificado, true);
  assert.equal(comprobante.propositoOtp, 'RESTABLECIMIENTO');
  assert.equal(comprobante.telefono, otpRecord.telefono);
});

test('invalid recovery OTP increments the attempt counter', async () => {
  await assert.rejects(
    OtpService.verificar({
      telefono: otpRecord.telefono,
      codigo: '000000',
      proposito: otpRecord.proposito,
    })
  );
  assert.equal(intentos, 1);
});

test('reset confirmation only updates an unexpired one-time token', async () => {
  const dbPath = require.resolve('../src/config/db');
  const queries = [];
  const responses = [
    { rows: [{ telefono: otpRecord.telefono }], rowCount: 1 },
    { rows: [{ id: 7 }], rowCount: 1 },
    { rows: [{ id: 7, dni: '12345678', nombre: 'Vecino' }], rowCount: 1 },
  ];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      async query(sql, params) {
        queries.push({ sql, params });
        return responses.shift();
      },
    },
  };
  const UsuarioModel = require('../src/models/usuarioModel');

  assert.equal(
    await UsuarioModel.obtenerTelefonoParaReset('12345678'),
    otpRecord.telefono
  );
  const reset = await UsuarioModel.crearTokenReset({
    dni: '12345678',
    telefono: otpRecord.telefono,
  });
  const usuario = await UsuarioModel.confirmarReset(reset.token, 'nueva-clave');

  assert.equal(reset.token.length, 64);
  assert.equal(usuario.dni, '12345678');
  assert.match(queries[2].sql, /password_reset_expires > CURRENT_TIMESTAMP/);
  assert.notEqual(queries[2].params[0], 'nueva-clave');
});
