const mongoose = require("mongoose");

const CATEGORIAS = ["RASTREADOR", "CONVERSOR", "TRANSMISSOR", "BOIA", "OUTRO"];

// Status compartilhado por TODAS as categorias de equipamento (o documento
// original pede "mesmo fluxo do rastreador" pra conversor/transmissor/bóia).
// "Disponível" NÃO é um status gravado — é calculado a partir de
// configurado + testado (ver virtual `disponivel` abaixo). Isso evita
// guardar um estado derivado que poderia ficar dessincronizado.
const EQUIPMENT_STATUS = [
  "EM_ESTOQUE",
  "ENTREGUE",
  "INSTALADO",
  "EM_MANUTENCAO",
  "RETORNADO_ESTOQUE",
];

const fotoSchema = {
  url: { type: String, required: true },
  legenda: { type: String, default: "" },
  data_upload: { type: Date, default: Date.now },
};

const baseOptions = {
  discriminatorKey: "categoria",
  timestamps: true,
};

const equipmentSchema = new mongoose.Schema(
  {
    modelo: { type: String, trim: true, required: true },
    observacao: { type: String, default: "" },
    ativo: { type: Boolean, default: true },

    status: {
      type: String,
      enum: EQUIPMENT_STATUS,
      default: "EM_ESTOQUE",
      index: true,
    },
    configurado: { type: Boolean, default: false },
    testado: { type: Boolean, default: false },

    fotos: [fotoSchema],

    unidade_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      default: null,
    },
    tecnico_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tecnico",
      default: null,
    },
    franquia_cliente_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FranquiaCliente",
      default: null,
    },

    data_instalacao: { type: Date, default: null },

    // Auditoria da migração original (planilha) — mantido por rastreabilidade
    categoria_origem: { type: String, default: null },

    historico_status: [
      {
        status: { type: String, enum: EQUIPMENT_STATUS },
        data: { type: Date, default: Date.now },
        obs: { type: String, default: "" },
      },
    ],
  },
  baseOptions,
);

// "Disponível para uso" = configurado + testado + ainda no estoque.
// Calculado, nunca gravado — não existe risco de ficar desatualizado.
equipmentSchema.virtual("disponivel").get(function () {
  return this.configurado && this.testado && this.status === "EM_ESTOQUE";
});
equipmentSchema.set("toJSON", { virtuals: true });

equipmentSchema.index({ categoria: 1, status: 1 });
equipmentSchema.index({ modelo: 1 });

equipmentSchema.statics.CATEGORIAS = CATEGORIAS;
equipmentSchema.statics.STATUS = EQUIPMENT_STATUS;

const Equipment = mongoose.model("Equipment", equipmentSchema);

// --- Rastreador -------------------------------------------------------
const Rastreador = Equipment.discriminator(
  "RASTREADOR",
  new mongoose.Schema({
    imei: { type: String, trim: true, index: true, sparse: true, unique: true },
    nf: { type: String, trim: true, default: null },
    niatron: { type: String, trim: true, default: null },
    codigo_ativo: { type: String, trim: true, default: null },
    ativo_na_tago: { type: Boolean, default: false },
    cobranca: { type: Boolean, default: false },
    plano: {
      type: String,
      enum: ["Starter", "Control", "Advanced"],
      default: null,
    },

    chip_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chip",
      default: null,
    },
  }),
);

// --- Conversor ----------------------------------------------------------
const Conversor = Equipment.discriminator(
  "CONVERSOR",
  new mongoose.Schema({
    rastreador_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      default: null,
    },
  }),
);

// --- Transmissor ----------------------------------------------------------
const Transmissor = Equipment.discriminator(
  "TRANSMISSOR",
  new mongoose.Schema({
    rastreador_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      default: null,
    },
  }),
);

// --- Bóia -----------------------------------------------------------------
const Boia = Equipment.discriminator(
  "BOIA",
  new mongoose.Schema({
    rastreador_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      default: null,
    },
  }),
);

// --- Outro (categoria livre) ----------------------------------------------
const Outro = Equipment.discriminator(
  "OUTRO",
  new mongoose.Schema({
    tipo_livre: { type: String, trim: true, default: null }, // descrição do tipo, já que a categoria é livre
  }),
);

module.exports = {
  Equipment,
  Rastreador,
  Conversor,
  Transmissor,
  Boia,
  Outro,
  CATEGORIAS,
  EQUIPMENT_STATUS,
};
