const mongoose = require('mongoose');

const ACOES = [
  'CADASTRO',
  'EDICAO',
  'TROCA_CHIP',
  'ALTERACAO_STATUS',
  'INSTALACAO',
  'ENTREGA',
  'EXCLUSAO_LOGICA',
  'MUDANCA_UNIDADE',
  'MUDANCA_TECNICO',
];

const historyLogSchema = new mongoose.Schema(
  {
    entidade_tipo: { type: String, required: true, index: true }, // ex: 'Chip', 'Equipment', 'User'
    entidade_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    usuario_nome: { type: String, default: 'sistema' }, // snapshot do nome (sobrevive se o usuário for desativado)
    acao: { type: String, enum: ACOES, required: true },
    descricao: { type: String, required: true },
    // Guarda o antes/depois dos campos que mudaram, quando aplicável
    dados_alterados: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: 'data', updatedAt: false } }
);

historyLogSchema.index({ entidade_tipo: 1, entidade_id: 1, data: -1 });

historyLogSchema.statics.ACOES = ACOES;

// Helper central usado por qualquer controller pra registrar uma ação.
historyLogSchema.statics.registrar = function ({
  entidade_tipo,
  entidade_id,
  usuario,
  acao,
  descricao,
  dados_alterados = null,
}) {
  return this.create({
    entidade_tipo,
    entidade_id,
    usuario_id: usuario?._id || null,
    usuario_nome: usuario?.nome || 'sistema',
    acao,
    descricao,
    dados_alterados,
  });
};

module.exports = mongoose.model('HistoryLog', historyLogSchema);
