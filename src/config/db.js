const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não definido no .env');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri);
  console.log(`[db] Conectado ao MongoDB Atlas -> ${mongoose.connection.name}`);

  mongoose.connection.on('error', (err) => {
    console.error('[db] Erro de conexão:', err.message);
  });
}

module.exports = connectDB;
