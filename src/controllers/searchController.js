const { Equipment } = require('../models/Equipment');
const Chip = require('../models/Chip');
const Unit = require('../models/Unit');
const FranquiaCliente = require('../models/FranquiaCliente');
const Tecnico = require('../models/Tecnico');

// GET /api/busca?q=texto
// Varre todas as entidades relevantes de uma vez e devolve resultados
// já identificados por tipo, pra tela poder linkar direto pro módulo certo.
exports.buscar = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ erro: 'Informe ao menos 2 caracteres pra buscar.' });
  }

  const termo = new RegExp(q.trim(), 'i');

  const [equipamentos, chips, unidades, franquiasClientes, tecnicos] = await Promise.all([
    Equipment.find({
      ativo: true,
      $or: [{ imei: termo }, { modelo: termo }, { codigo_ativo: termo }],
    })
      .select('categoria modelo imei codigo_ativo status')
      .limit(15),

    Chip.find({ $or: [{ iccid: termo }, { numero: termo }] })
      .select('iccid numero status')
      .limit(15),

    Unit.find({ nome: termo }).select('nome').limit(10),
    FranquiaCliente.find({ nome: termo }).select('nome tipo').limit(10),
    Tecnico.find({ nome: termo }).select('nome telefone').limit(10),
  ]);

  res.json({
    equipamentos: equipamentos.map((e) => ({ tipo: 'equipamento', ...e.toObject() })),
    chips: chips.map((c) => ({ tipo: 'chip', ...c.toObject() })),
    unidades: unidades.map((u) => ({ tipo: 'unidade', ...u.toObject() })),
    franquias_clientes: franquiasClientes.map((f) => ({ tipo: 'franquia_cliente', ...f.toObject() })),
    tecnicos: tecnicos.map((t) => ({ tipo: 'tecnico', ...t.toObject() })),
  });
};
