const mongoose = require('mongoose');

// Bate com as 4 abas do módulo de Chips do documento de especificação:
// Em Estoque / Instalados / Entregues / Perdidos-Bloqueados
const CHIP_STATUS = [
  'EM_ESTOQUE',
  'INSTALADO',
  'ENTREGUE', // entregue a um técnico/unidade, ainda não instalado em um rastreador
  'PERDIDO',
  'BLOQUEADO',
];

const chipSchema = new mongoose.Schema(
  {
    iccid: { type: String, required: true, trim: true, unique: true },
    numero: { type: String, trim: true, default: null },
    operadora: { type: String, trim: true, default: null },
    observacao: { type: String, default: '' },

    status: {
      type: String,
      enum: CHIP_STATUS,
      default: 'EM_ESTOQUE',
      index: true,
    },

    // Preenchido quando status = ENTREGUE (separado para uma unidade/técnico, ainda não instalado)
    unidade_reservada: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null },
    tecnico_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico', default: null },

    // Preenchido quando status = INSTALADO (chip dentro de um Rastreador)
    // Aponta pro documento Equipment (categoria RASTREADOR) — nunca duplicamos
    // IMEI/ICCID entre as duas coleções, só a referência.
    equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', default: null },

    categoria_origem: { type: String, default: null },

    historico_status: [
      {
        status: { type: String, enum: CHIP_STATUS },
        data: { type: Date, default: Date.now },
        obs: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

chipSchema.index({ status: 1, equipment_id: 1 });

chipSchema.statics.STATUS = CHIP_STATUS;

module.exports = mongoose.model('Chip', chipSchema);
