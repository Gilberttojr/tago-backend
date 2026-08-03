const User = require('../models/User');

exports.listar = async (req, res) => {
  const usuarios = await User.find().sort({ nome: 1 });
  res.json(usuarios);
};

exports.obter = async (req, res) => {
  const usuario = await User.findById(req.params.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.json(usuario);
};

// POST /api/users { nome, email, senha, tipo, foto_perfil }
exports.criar = async (req, res) => {
  const { nome, email, senha, tipo, foto_perfil } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
  }

  const existente = await User.findOne({ email: email.toLowerCase().trim() });
  if (existente) {
    return res.status(409).json({ erro: 'Já existe um usuário com esse email.' });
  }

  const senha_hash = await User.hashSenha(senha);
  const usuario = await User.create({
    nome,
    email: email.toLowerCase().trim(),
    senha_hash,
    tipo: tipo || 'CONSULTA',
    foto_perfil: foto_perfil || null,
  });

  res.status(201).json(usuario);
};

// PATCH /api/users/:id  (senha é opcional aqui — só re-hasheia se vier preenchida)
exports.atualizar = async (req, res) => {
  const { nome, email, senha, tipo, foto_perfil, ativo } = req.body;
  const usuario = await User.findById(req.params.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

  if (email && email.toLowerCase().trim() !== usuario.email) {
    const emailEmUso = await User.findOne({ email: email.toLowerCase().trim() });
    if (emailEmUso) return res.status(409).json({ erro: 'Já existe um usuário com esse email.' });
    usuario.email = email.toLowerCase().trim();
  }

  if (nome !== undefined) usuario.nome = nome;
  if (tipo !== undefined) usuario.tipo = tipo;
  if (foto_perfil !== undefined) usuario.foto_perfil = foto_perfil;
  if (ativo !== undefined) usuario.ativo = ativo;
  if (senha) usuario.senha_hash = await User.hashSenha(senha);

  await usuario.save();
  res.json(usuario);
};

exports.remover = async (req, res) => {
  // Exclusão lógica (mantém histórico íntegro) em vez de apagar de verdade
  const usuario = await User.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true });
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.json(usuario);
};
