const asyncWrapper = require('../middlewares/asyncWrapper');
const AdminModel = require('../models/adminModel');

const obtenerEstadisticasAdmin = asyncWrapper(async (req, res) => {
  const stats = await AdminModel.obtenerMetricasGlobales();

  res.status(200).json(stats);
});

module.exports = {
  obtenerEstadisticasAdmin
};