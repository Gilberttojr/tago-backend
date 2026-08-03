require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');
const { exigirAutenticacao } = require('./src/middleware/auth');
const seedAdminSeNecessario = require('./src/utils/seedAdmin');

const authRoutes = require('./src/routes/auth');
const usersRoutes = require('./src/routes/users');
const chipsRoutes = require('./src/routes/chips');
const equipamentosRoutes = require('./src/routes/equipamentos');
const unitsRoutes = require('./src/routes/units');
const tecnicosRoutes = require('./src/routes/tecnicos');
const franquiasClientesRoutes = require('./src/routes/franquiasClientes');
const dashboardRoutes = require('./src/routes/dashboard');
const historicoRoutes = require('./src/routes/historico');
const buscaRoutes = require('./src/routes/busca');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Login é a única rota de API que não exige token ainda
app.use('/api/auth', authRoutes);

// A partir daqui, tudo exige estar logado
app.use('/api', exigirAutenticacao);

app.use('/api/users', usersRoutes);
app.use('/api/chips', chipsRoutes);
app.use('/api/equipamentos', equipamentosRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/tecnicos', tecnicosRoutes);
app.use('/api/franquias-clientes', franquiasClientesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/historico', historicoRoutes);
app.use('/api/busca', buscaRoutes);

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3333;

connectDB()
  .then(seedAdminSeNecessario)
  .then(() => {
    app.listen(PORT, () => console.log(`[server] Rodando em http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('[server] Falha ao iniciar:', err.message);
    process.exit(1);
  });
