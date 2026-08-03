const mongoose = require('mongoose');

const franquiaClienteSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    tipo: { type: String, enum: ['FRANQUIA', 'CLIENTE'], default: 'CLIENTE' },
    observacao: { type: String, default: '' },
    ativo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FranquiaCliente', franquiaClienteSchema);
