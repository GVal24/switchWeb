const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.NODE_ENV = 'test';
process.env.OTP_HMAC_SECRET = 'switch-test-otp-secret';

const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { query: async () => ({ rows: [] }) },
};

const OtpModel = require('../src/models/otpModel');
const config = require('../src/config/otp');
const { REGISTRO_PROVEEDORES } = require('../src/services/providers/otpProvider');
const OtpService = require('../src/services/otpService');

const originalesModelo = {
  contarEnviosRecientes: OtpModel.contarEnviosRecientes,
  contarEnviosPorIp: OtpModel.contarEnviosPorIp,
  obtenerActivo: OtpModel.obtenerActivo,
  invalidarPendientes: OtpModel.invalidarPendientes,
  crear: OtpModel.crear,
};
const originalMockEnviar = REGISTRO_PROVEEDORES.MOCK.enviar;
const originalesConfig = {
  esProduccion: config.esProduccion,
  mockHabilitado: config.mockHabilitado,
};
const originalProveedor = process.env.OTP_PROVEEDOR;

let creaciones = 0;

OtpModel.contarEnviosRecientes = async () => 0;
OtpModel.contarEnviosPorIp = async () => 0;
OtpModel.obtenerActivo = async () => null;
OtpModel.invalidarPendientes = async () => {};
OtpModel.crear = async ({ telefono, proposito, canal, maxIntentos, expiraEn }) => {
  creaciones += 1;
  return {
    id: creaciones,
    telefono,
    proposito,
    canal,
    max_intentos: maxIntentos,
    expira_en: expiraEn,
  };
};
REGISTRO_PROVEEDORES.MOCK.enviar = async () => ({ entregado: true });
process.env.OTP_PROVEEDOR = 'MOCK';

test('local mock returns the OTP code for registration and password recovery', async () => {
  config.esProduccion = false;
  config.mockHabilitado = true;

  for (const proposito of ['REGISTRO', 'RESTABLECIMIENTO']) {
    const resultado = await OtpService.solicitar({
      telefono: '11 2345 6789',
      proposito,
    });
    assert.match(resultado.codigoMock, /^\d{6}$/);
    assert.equal(resultado.esMock, true);
    assert.equal(resultado.proveedorEnviado, 'MOCK');
  }
});

test('production never claims a mock OTP was sent or returns its code', async () => {
  config.esProduccion = true;
  config.mockHabilitado = true;
  const creacionesAntes = creaciones;

  await assert.rejects(
    OtpService.solicitar({
      telefono: '11 2345 6789',
      proposito: 'REGISTRO',
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.match(error.message, /sólo funciona con el backend local/);
      return true;
    }
  );
  assert.equal(creaciones, creacionesAntes);
});

test.after(() => {
  Object.assign(OtpModel, originalesModelo);
  REGISTRO_PROVEEDORES.MOCK.enviar = originalMockEnviar;
  Object.assign(config, originalesConfig);
  if (originalProveedor === undefined) delete process.env.OTP_PROVEEDOR;
  else process.env.OTP_PROVEEDOR = originalProveedor;
});
