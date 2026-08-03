const crypto = require('crypto');
const User = require('../models/User');

// Roda toda vez que o servidor sobe, mas só cria algo se não existir
// NENHUM usuário ainda — é o "cadastro inicial automático" pedido no
// documento. A senha gerada é impressa uma única vez no console.
async function seedAdminSeNecessario() {
  const totalUsuarios = await User.countDocuments();
  if (totalUsuarios > 0) return;

  const email = process.env.ADMIN_SEED_EMAIL || 'admin@empresa.com';
  const senha = process.env.ADMIN_SEED_SENHA || crypto.randomBytes(6).toString('hex');

  const senha_hash = await User.hashSenha(senha);
  await User.create({
    nome: 'Administrador',
    email,
    senha_hash,
    tipo: 'ADMINISTRADOR',
  });

  console.log('\n========================================================');
  console.log('  Nenhum usuário encontrado — administrador criado:');
  console.log(`  Email: ${email}`);
  console.log(`  Senha: ${senha}`);
  console.log('  Troque a senha assim que fizer o primeiro login.');
  console.log('========================================================\n');
}

module.exports = seedAdminSeNecessario;
