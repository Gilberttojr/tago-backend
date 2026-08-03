const mongoose = require('mongoose');

const tecnicoSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    telefone: { type: String, trim: true, default: null },
    observacao: { type: String, default: '' },
    ativo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tecnico', tecnicoSchema);
