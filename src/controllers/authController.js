const User = require("../models/User");
const { gerarToken } = require("../middleware/auth");

// POST /api/auth/login { email, senha }
exports.login = async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "Informe email e senha." });
  }

  const usuario = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+senha_hash");
  if (!usuario || !usuario.ativo) {
    return res.status(401).json({ erro: "Email ou senha inválidos." });
  }

  const senhaOk = await usuario.compararSenha(senha);
  if (!senhaOk) {
    return res.status(401).json({ erro: "Email ou senha inválidos." });
  }

  const token = gerarToken(usuario);
  res.json({ token, usuario });
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json(req.usuario);
};

// PATCH /api/auth/me — o próprio usuário edita nome/email/senha (nunca tipo/ativo)
exports.atualizarPerfil = async (req, res) => {
  const { nome, email, senha } = req.body;
  const usuario = await User.findById(req.usuario._id).select("+senha_hash");

  if (email && email.toLowerCase().trim() !== usuario.email) {
    const emailEmUso = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (emailEmUso)
      return res
        .status(409)
        .json({ erro: "Já existe um usuário com esse email." });
    usuario.email = email.toLowerCase().trim();
  }
  if (nome !== undefined) usuario.nome = nome;
  if (senha) usuario.senha_hash = await User.hashSenha(senha);

  await usuario.save();
  res.json(usuario);
};

// POST /api/auth/me/foto — upload da foto de perfil
exports.enviarFotoPerfil = async (req, res) => {
  if (!req.file)
    return res
      .status(400)
      .json({ erro: 'Nenhum arquivo enviado (campo "foto")' });
  const usuario = await User.findById(req.usuario._id);
  usuario.foto_perfil = `/uploads/${req.file.filename}`;
  await usuario.save();
  res.json(usuario);
};
