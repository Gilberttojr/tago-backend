const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, unique: true },
    // Tipo inferido do sufixo usado na planilha (GG, CF, franquia, etc). Livre, não obrigatório.
    tipo: { type: String, trim: true, default: null },
    ativo: { type: Boolean, default: true },
    observacoes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Unit', unitSchema);
