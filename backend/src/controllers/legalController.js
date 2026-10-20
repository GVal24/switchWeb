const asyncWrapper = require('../middlewares/asyncWrapper');
const legales = require('../content/legales');
const { ValidationError } = require('../utils/customErrors');

/**
 * Índice de documentos legales disponibles.
 * Público a propósito: la persona usuaria debe poder ver qué documentos
 * existen y qué versión está vigente antes de registrarse.
 */
const listarDocumentos = asyncWrapper(async (req, res) => {
  res.status(200).json({
    exito: true,
    datos: {
      versionGlobal: legales.VERSION,
      vigenteDesde: legales.VIGENTE_DESDE,
      documentos: legales.listar()
    }
  });
});

/**
 * Devuelve el texto completo de un documento legal.
 * Público: se consulta desde la pantalla de registro, sin cuenta creada.
 */
const obtenerDocumento = asyncWrapper(async (req, res) => {
  const { documento } = req.params;
  const texto = legales.obtener(documento);

  if (!texto) {
    throw new ValidationError(
      `Documento legal desconocido: "${documento}". Disponibles: terminos, privacidad.`
    );
  }

  res.status(200).json({
    exito: true,
    datos: texto
  });
});

module.exports = {
  listarDocumentos,
  obtenerDocumento
};
