const Chip = require('../models/Chip');
const { Equipment } = require('../models/Equipment');

// GET /api/dashboard/resumo
// Retorna a contagem total de cada card do dashboard, mais o detalhamento
// por status (útil pros quadros internos de cada módulo).
exports.resumo = async (req, res) => {
  const [chipsPorStatus, totalChips, equipPorCategoriaEStatus] = await Promise.all([
    Chip.aggregate([{ $group: { _id: '$status', total: { $sum: 1 } } }]),
    Chip.countDocuments(),
    Equipment.aggregate([
      { $match: { ativo: true } },
      { $group: { _id: { categoria: '$categoria', status: '$status' }, total: { $sum: 1 } } },
    ]),
  ]);

  const toMap = (arr) =>
    arr.reduce((acc, item) => {
      acc[item._id || 'SEM_STATUS'] = item.total;
      return acc;
    }, {});

  const porCategoria = {};
  for (const cat of Equipment.CATEGORIAS) porCategoria[cat] = { total: 0, por_status: {} };

  for (const { _id, total } of equipPorCategoriaEStatus) {
    porCategoria[_id.categoria].total += total;
    porCategoria[_id.categoria].por_status[_id.status] = total;
  }

  res.json({
    chips: { total: totalChips, por_status: toMap(chipsPorStatus) },
    equipamentos: porCategoria,
  });
};
