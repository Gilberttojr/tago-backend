const HistoryLog = require("../models/HistoryLog");

// GET /api/historico?search=texto&pagina=1&limite=30
exports.listar = async (req, res) => {
  const { entidade_tipo, entidade_id, search, pagina, limite } = req.query;
  const filtro = {};
  if (entidade_tipo) filtro.entidade_tipo = entidade_tipo;
  if (entidade_id) filtro.entidade_id = entidade_id;
  if (search) {
    filtro.$or = [
      { descricao: new RegExp(search, "i") },
      { usuario_nome: new RegExp(search, "i") },
      { acao: new RegExp(search, "i") },
    ];
  }

  const paginaNum = Math.max(1, Number(pagina) || 1);
  const limiteNum = Math.min(100, Number(limite) || 30);

  const [dados, total] = await Promise.all([
    HistoryLog.find(filtro)
      .sort({ data: -1 })
      .skip((paginaNum - 1) * limiteNum)
      .limit(limiteNum),
    HistoryLog.countDocuments(filtro),
  ]);

  res.json({
    dados,
    total,
    pagina: paginaNum,
    totalPaginas: Math.max(1, Math.ceil(total / limiteNum)),
  });
};
