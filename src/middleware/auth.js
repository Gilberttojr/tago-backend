const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SEGREDO = process.env.JWT_SECRET;

function gerarToken(user) {
  return jwt.sign({ sub: user._id.toString(), tipo: user.tipo }, SEGREDO, { expiresIn: '12h' });
}

// Exige um token válido em qualquer rota protegida. Anexa `req.usuario`.
async function exigirAutenticacao(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: 'Não autenticado. Faça login novamente.' });
  }

  try {
    const payload = jwt.verify(token, SEGREDO);
    const usuario = await User.findById(payload.sub);

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Usuário inválido ou desativado.' });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Sessão expirada ou token inválido.' });
  }
}

// Bloqueia usuários do tipo CONSULTA em rotas de escrita (criar/editar/excluir).
function exigirAdministrador(req, res, next) {
  if (req.usuario?.tipo !== 'ADMINISTRADOR') {
    return res.status(403).json({ erro: 'Apenas administradores podem realizar esta ação.' });
  }
  next();
}

module.exports = { gerarToken, exigirAutenticacao, exigirAdministrador };
