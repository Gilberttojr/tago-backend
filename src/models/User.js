const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const TIPOS_USUARIO = ['ADMINISTRADOR', 'CONSULTA'];

const userSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    senha_hash: { type: String, required: true, select: false },
    foto_perfil: { type: String, default: null },
    tipo: { type: String, enum: TIPOS_USUARIO, default: 'CONSULTA' },
    ativo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Nunca expor o hash da senha em JSON (respostas de API, logs, etc.)
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.senha_hash;
    return ret;
  },
});

userSchema.statics.TIPOS = TIPOS_USUARIO;

userSchema.methods.compararSenha = function (senhaPlana) {
  return bcrypt.compare(senhaPlana, this.senha_hash);
};

userSchema.statics.hashSenha = function (senhaPlana) {
  return bcrypt.hash(senhaPlana, 10);
};

module.exports = mongoose.model('User', userSchema);
