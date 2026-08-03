const Chip = require("../models/Chip");
const { Equipment } = require("../models/Equipment");
const HistoryLog = require("../models/HistoryLog");

// GET /api/chips?status=EM_ESTOQUE&search=8955
exports.listar = async (req, res) => {
  const { status, search, pagina, limite } = req.query;
  const filtro = {};

  if (status) filtro.status = status;
  if (search) {
    filtro.$or = [
      { iccid: new RegExp(search, "i") },
      { numero: new RegExp(search, "i") },
    ];
  }

  const query = Chip.find(filtro)
    .populate("unidade_reservada", "nome")
    .populate("tecnico_id", "nome")
    .populate("equipment_id", "modelo imei codigo_ativo")
    .sort({ createdAt: -1 });

  // Sem "pagina" na URL -> devolve o array direto (usado pelos <select> de
  // outras telas, que precisam da lista inteira, não paginada).
  if (!pagina) {
    return res.json(await query);
  }

  const paginaNum = Math.max(1, Number(pagina) || 1);
  const limiteNum = Math.min(100, Number(limite) || 20);

  const [dados, total] = await Promise.all([
    query.skip((paginaNum - 1) * limiteNum).limit(limiteNum),
    Chip.countDocuments(filtro),
  ]);

  res.json({
    dados,
    total,
    pagina: paginaNum,
    totalPaginas: Math.max(1, Math.ceil(total / limiteNum)),
  });
};

exports.obter = async (req, res) => {
  const chip = await Chip.findById(req.params.id)
    .populate("unidade_reservada", "nome")
    .populate("tecnico_id", "nome")
    .populate("equipment_id");
  if (!chip) return res.status(404).json({ erro: "Chip não encontrado" });
  res.json(chip);
};

exports.criar = async (req, res) => {
  try {
    const chip = await Chip.create(req.body);
    await HistoryLog.registrar({
      entidade_tipo: "Chip",
      entidade_id: chip._id,
      usuario: req.usuario,
      acao: "CADASTRO",
      descricao: `Chip ${chip.iccid} cadastrado`,
    });
    res.status(201).json(chip);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ erro: "Já existe um chip com esse ICCID" });
    res.status(400).json({ erro: err.message });
  }
};

// PATCH /api/chips/:id — edição completa (Administrador)
exports.atualizar = async (req, res) => {
  const chip = await Chip.findById(req.params.id);
  if (!chip) return res.status(404).json({ erro: "Chip não encontrado" });

  const {
    _id,
    __v,
    createdAt,
    updatedAt,
    historico_status,
    equipment_id,
    ...camposEditaveis
  } = req.body;

  const antes = chip.toObject();
  Object.assign(chip, camposEditaveis);
  await chip.save();

  await HistoryLog.registrar({
    entidade_tipo: "Chip",
    entidade_id: chip._id,
    usuario: req.usuario,
    acao: "EDICAO",
    descricao: `Chip ${chip.iccid} editado`,
    dados_alterados: { antes, depois: chip.toObject() },
  });

  res.json(chip);
};

// POST /api/chips/:id/instalar  { imei, confirmarTroca }
//
// Regra de negócio exata do documento:
// 1. Busca o rastreador pelo IMEI informado.
// 2. Se não existir -> cancela, avisa que não foi encontrado.
// 3. Se existir e não tiver chip -> associa direto.
// 4. Se existir e já tiver outro chip -> pede confirmação de troca.
//    Confirmando: chip antigo volta pro estoque, novo chip é associado.
exports.instalar = async (req, res) => {
  const { imei, confirmarTroca } = req.body;
  const chip = await Chip.findById(req.params.id);
  if (!chip) return res.status(404).json({ erro: "Chip não encontrado" });

  if (!imei)
    return res.status(400).json({ erro: "Informe o IMEI do rastreador." });

  const rastreador = await Equipment.findOne({
    categoria: "RASTREADOR",
    imei: imei.trim(),
  });
  if (!rastreador) {
    return res
      .status(404)
      .json({ erro: `Rastreador com IMEI ${imei} não foi encontrado.` });
  }

  // Rastreador já tem um chip diferente do que estamos instalando
  if (rastreador.chip_id && String(rastreador.chip_id) !== String(chip._id)) {
    if (!confirmarTroca) {
      const chipAtual = await Chip.findById(rastreador.chip_id).select("iccid");
      return res.status(409).json({
        precisaConfirmacao: true,
        mensagem: `O rastreador já possui o chip ${chipAtual?.iccid}. Deseja substituir?`,
        chip_atual: chipAtual,
      });
    }

    // Confirmado: chip antigo volta pro estoque
    await Chip.findByIdAndUpdate(rastreador.chip_id, {
      equipment_id: null,
      status: "EM_ESTOQUE",
      unidade_reservada: null,
      tecnico_id: null,
    });

    await HistoryLog.registrar({
      entidade_tipo: "Chip",
      entidade_id: rastreador.chip_id,
      usuario: req.usuario,
      acao: "TROCA_CHIP",
      descricao: `Removido do rastreador IMEI ${imei} (substituído pelo chip ${chip.iccid}), retornado ao estoque`,
    });
  }

  chip.equipment_id = rastreador._id;
  chip.status = "INSTALADO";
  chip.unidade_reservada = null;
  chip.tecnico_id = null;
  await chip.save();

  rastreador.chip_id = chip._id;
  await rastreador.save();

  await HistoryLog.registrar({
    entidade_tipo: "Chip",
    entidade_id: chip._id,
    usuario: req.usuario,
    acao: "INSTALACAO",
    descricao: `Chip ${chip.iccid} instalado no rastreador IMEI ${imei}`,
  });

  res.json({ chip, rastreador });
};

// POST /api/chips/:id/entregar  { unidade_id, tecnico_id, obs }
exports.entregar = async (req, res) => {
  const { unidade_id, tecnico_id, obs } = req.body;
  const chip = await Chip.findById(req.params.id);
  if (!chip) return res.status(404).json({ erro: "Chip não encontrado" });

  chip.status = "ENTREGUE";
  chip.unidade_reservada = unidade_id || null;
  chip.tecnico_id = tecnico_id || null;
  if (obs) chip.observacao = obs;
  chip.historico_status.push({ status: "ENTREGUE", obs });
  await chip.save();

  await HistoryLog.registrar({
    entidade_tipo: "Chip",
    entidade_id: chip._id,
    usuario: req.usuario,
    acao: "ENTREGA",
    descricao: `Chip ${chip.iccid} entregue`,
  });

  res.json(chip);
};

// POST /api/chips/:id/liberar — volta pro estoque, desfaz qualquer vínculo
exports.liberar = async (req, res) => {
  const chip = await Chip.findById(req.params.id);
  if (!chip) return res.status(404).json({ erro: "Chip não encontrado" });

  if (chip.equipment_id) {
    await Equipment.findByIdAndUpdate(chip.equipment_id, { chip_id: null });
  }

  chip.equipment_id = null;
  chip.unidade_reservada = null;
  chip.tecnico_id = null;
  chip.status = "EM_ESTOQUE";
  chip.historico_status.push({
    status: "EM_ESTOQUE",
    obs: req.body?.obs || "",
  });
  await chip.save();

  await HistoryLog.registrar({
    entidade_tipo: "Chip",
    entidade_id: chip._id,
    usuario: req.usuario,
    acao: "ALTERACAO_STATUS",
    descricao: `Chip ${chip.iccid} liberado de volta ao estoque`,
  });

  res.json(chip);
};

// POST /api/chips/:id/status  { status, obs }  -> pra PERDIDO / BLOQUEADO
exports.mudarStatus = async (req, res) => {
  const { status, obs } = req.body;
  const chip = await Chip.findById(req.params.id);
  if (!chip) return res.status(404).json({ erro: "Chip não encontrado" });

  const anterior = chip.status;
  chip.status = status;
  chip.historico_status.push({ status, obs });
  await chip.save();

  await HistoryLog.registrar({
    entidade_tipo: "Chip",
    entidade_id: chip._id,
    usuario: req.usuario,
    acao: "ALTERACAO_STATUS",
    descricao: `Status do chip ${chip.iccid} alterado de "${anterior}" para "${status}"`,
  });

  res.json(chip);
};

exports.remover = async (req, res) => {
  const chip = await Chip.findByIdAndDelete(req.params.id);
  if (!chip) return res.status(404).json({ erro: "Chip não encontrado" });

  if (chip.equipment_id) {
    await Equipment.findByIdAndUpdate(chip.equipment_id, { chip_id: null });
  }

  await HistoryLog.registrar({
    entidade_tipo: "Chip",
    entidade_id: chip._id,
    usuario: req.usuario,
    acao: "EXCLUSAO_LOGICA",
    descricao: `Chip ${chip.iccid} excluído`,
  });

  res.status(204).send();
};
