const { Equipment } = require("../models/Equipment");
const Chip = require("../models/Chip");
const HistoryLog = require("../models/HistoryLog");

const POPULATE = [
  { path: "unidade_id", select: "nome" },
  { path: "tecnico_id", select: "nome telefone" },
  { path: "franquia_cliente_id", select: "nome tipo" },
  { path: "chip_id", select: "iccid numero operadora status" },
  { path: "rastreador_id", select: "modelo imei categoria" },
];

// GET /api/equipamentos?categoria=RASTREADOR&status=EM_ESTOQUE&search=GV300&disponivel=true
exports.listar = async (req, res) => {
  const {
    categoria,
    status,
    search,
    disponivel,
    incluirInativos,
    pagina,
    limite,
  } = req.query;
  const filtro = {};

  if (categoria) filtro.categoria = categoria;
  if (status) filtro.status = status;
  if (!incluirInativos) filtro.ativo = true;
  if (disponivel === "true") {
    filtro.configurado = true;
    filtro.testado = true;
    filtro.status = "EM_ESTOQUE";
  }
  if (search) {
    filtro.$or = [
      { modelo: new RegExp(search, "i") },
      { imei: new RegExp(search, "i") },
      { codigo_ativo: new RegExp(search, "i") },
      { observacao: new RegExp(search, "i") },
    ];
  }

  const query = Equipment.find(filtro)
    .populate(POPULATE)
    .sort({ createdAt: -1 });

  if (!pagina) {
    return res.json(await query);
  }

  const paginaNum = Math.max(1, Number(pagina) || 1);
  const limiteNum = Math.min(100, Number(limite) || 20);

  const [dados, total] = await Promise.all([
    query.skip((paginaNum - 1) * limiteNum).limit(limiteNum),
    Equipment.countDocuments(filtro),
  ]);

  res.json({
    dados,
    total,
    pagina: paginaNum,
    totalPaginas: Math.max(1, Math.ceil(total / limiteNum)),
  });
};

exports.obter = async (req, res) => {
  const item = await Equipment.findById(req.params.id).populate(POPULATE);
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });
  res.json(item);
};

// POST /api/equipamentos  { categoria, modelo, imei?, ... }
exports.criar = async (req, res) => {
  const { categoria } = req.body;
  if (!Equipment.CATEGORIAS.includes(categoria)) {
    return res.status(400).json({
      erro: `Categoria inválida. Use uma de: ${Equipment.CATEGORIAS.join(", ")}`,
    });
  }

  try {
    const item = await Equipment.create(req.body);
    await HistoryLog.registrar({
      entidade_tipo: "Equipment",
      entidade_id: item._id,
      usuario: req.usuario,
      acao: "CADASTRO",
      descricao: `${categoria} "${item.modelo}" cadastrado`,
    });
    res.status(201).json(item);
  } catch (err) {
    if (err.code === 11000)
      return res
        .status(409)
        .json({ erro: "Já existe um equipamento com esse IMEI" });
    res.status(400).json({ erro: err.message });
  }
};

// PATCH /api/equipamentos/:id — edição completa (qualquer campo do Administrador)
exports.atualizar = async (req, res) => {
  const item = await Equipment.findById(req.params.id);
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });

  // Nunca deixar o formulário sobrescrever campos controlados pelo sistema
  // (versão interna do Mongoose, id, categoria, fotos, histórico). É isso
  // que causava o erro "No matching document found... version X" ao salvar
  // logo depois de subir uma foto: o formulário mandava de volta um __v
  // desatualizado e o Mongoose recusava a gravação.
  const {
    _id,
    __v,
    createdAt,
    updatedAt,
    categoria,
    fotos,
    historico_status,
    chip_id,
    ...camposEditaveis
  } = req.body;

  const antes = item.toObject();
  Object.assign(item, camposEditaveis);
  await item.save();

  await HistoryLog.registrar({
    entidade_tipo: "Equipment",
    entidade_id: item._id,
    usuario: req.usuario,
    acao: "EDICAO",
    descricao: `${item.categoria} "${item.modelo}" editado`,
    dados_alterados: { antes, depois: item.toObject() },
  });

  res.json(item);
};

// POST /api/equipamentos/:id/entregar — igual ao fluxo do chip: registra
// status ENTREGUE junto com unidade e quem recebeu, numa chamada só.
exports.entregar = async (req, res) => {
  const { unidade_id, tecnico_id, obs } = req.body;
  const item = await Equipment.findById(req.params.id);
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });

  item.status = "ENTREGUE";
  item.unidade_id = unidade_id || null;
  item.tecnico_id = tecnico_id || null;
  if (obs) item.observacao = obs;
  item.historico_status.push({ status: "ENTREGUE", obs });
  await item.save();

  await HistoryLog.registrar({
    entidade_tipo: "Equipment",
    entidade_id: item._id,
    usuario: req.usuario,
    acao: "ENTREGA",
    descricao: `${item.categoria} "${item.modelo}" entregue`,
  });

  res.json(item);
};

// POST /api/equipamentos/:id/status  { status, obs }
exports.mudarStatus = async (req, res) => {
  const { status, obs } = req.body;
  const item = await Equipment.findById(req.params.id);
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });

  const statusAnterior = item.status;
  item.status = status;
  item.historico_status.push({ status, obs });
  if (status === "INSTALADO" && !item.data_instalacao)
    item.data_instalacao = new Date();
  await item.save();

  await HistoryLog.registrar({
    entidade_tipo: "Equipment",
    entidade_id: item._id,
    usuario: req.usuario,
    acao: "ALTERACAO_STATUS",
    descricao: `Status alterado de "${statusAnterior}" para "${status}"`,
    dados_alterados: {
      status_anterior: statusAnterior,
      status_novo: status,
      obs,
    },
  });

  res.json(item);
};

// POST /api/equipamentos/:id/configuracao  { configurado, testado }
// Endpoint dedicado pro fluxo "Configurado + Testado -> Disponível" do documento.
exports.atualizarConfiguracao = async (req, res) => {
  const { configurado, testado } = req.body;
  const item = await Equipment.findByIdAndUpdate(
    req.params.id,
    {
      ...(configurado !== undefined && { configurado }),
      ...(testado !== undefined && { testado }),
    },
    { new: true },
  );
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });
  res.json(item);
};

exports.vincularUnidade = async (req, res) => {
  const { unidade_id } = req.body;
  const item = await Equipment.findById(req.params.id);
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });

  item.unidade_id = unidade_id || null;
  await item.save();

  await HistoryLog.registrar({
    entidade_tipo: "Equipment",
    entidade_id: item._id,
    usuario: req.usuario,
    acao: "MUDANCA_UNIDADE",
    descricao: `Unidade alterada`,
  });

  res.json(item);
};

exports.vincularTecnico = async (req, res) => {
  const { tecnico_id } = req.body;
  const item = await Equipment.findById(req.params.id);
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });

  item.tecnico_id = tecnico_id || null;
  await item.save();

  await HistoryLog.registrar({
    entidade_tipo: "Equipment",
    entidade_id: item._id,
    usuario: req.usuario,
    acao: "MUDANCA_TECNICO",
    descricao: `Técnico responsável alterado`,
  });

  res.json(item);
};

// GET /api/equipamentos/:id/acessorios — conversores/transmissores vinculados a um rastreador
exports.listarAcessorios = async (req, res) => {
  const acessorios = await Equipment.find({
    rastreador_id: req.params.id,
    ativo: true,
  }).sort({ categoria: 1, modelo: 1 });
  res.json(acessorios);
};

exports.vincularRastreador = async (req, res) => {
  const { rastreador_id } = req.body;
  const item = await Equipment.findById(req.params.id);
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });
  if (!["CONVERSOR", "TRANSMISSOR"].includes(item.categoria)) {
    return res.status(400).json({
      erro: "Só conversores e transmissores podem ser vinculados a um rastreador.",
    });
  }

  item.rastreador_id = rastreador_id || null;
  await item.save();

  await HistoryLog.registrar({
    entidade_tipo: "Equipment",
    entidade_id: item._id,
    usuario: req.usuario,
    acao: "EDICAO",
    descricao: rastreador_id
      ? `Vinculado ao rastreador ${rastreador_id}`
      : "Desvinculado do rastreador",
  });

  res.json(item);
};

exports.adicionarFoto = async (req, res) => {
  const item = await Equipment.findById(req.params.id);
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });
  if (!req.file)
    return res
      .status(400)
      .json({ erro: 'Nenhum arquivo enviado (campo "foto")' });

  item.fotos.push({
    url: `/uploads/${req.file.filename}`,
    legenda: req.body.legenda || "",
  });
  await item.save();
  res.status(201).json(item);
};

exports.removerFoto = async (req, res) => {
  const item = await Equipment.findById(req.params.id);
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });
  item.fotos = item.fotos.filter((f) => String(f._id) !== req.params.fotoId);
  await item.save();
  res.json(item);
};

// DELETE /api/equipamentos/:id — exclusão lógica
exports.remover = async (req, res) => {
  const item = await Equipment.findByIdAndUpdate(
    req.params.id,
    { ativo: false },
    { new: true },
  );
  if (!item)
    return res.status(404).json({ erro: "Equipamento não encontrado" });

  // Se era um rastreador com chip vinculado, o chip volta pro estoque
  if (item.chip_id) {
    await Chip.findByIdAndUpdate(item.chip_id, {
      equipment_id: null,
      status: "EM_ESTOQUE",
    });
  }

  await HistoryLog.registrar({
    entidade_tipo: "Equipment",
    entidade_id: item._id,
    usuario: req.usuario,
    acao: "EXCLUSAO_LOGICA",
    descricao: `${item.categoria} "${item.modelo}" excluído (lógico)`,
  });

  res.json(item);
};
