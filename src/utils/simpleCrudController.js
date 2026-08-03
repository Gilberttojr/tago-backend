/**
 * Gera um controller CRUD padrão pra cadastros auxiliares simples
 * (Técnico, Franquia/Cliente, Unidade). Evita reescrever o mesmo
 * listar/criar/atualizar/remover três vezes com pequenas variações.
 *
 * `campoBusca` define em qual campo o `?search=` da listagem filtra.
 */
function criarCrudSimples(Model, { campoBusca = 'nome' } = {}) {
  return {
    listar: async (req, res) => {
      const { search } = req.query;
      const filtro = search ? { [campoBusca]: new RegExp(search, 'i') } : {};
      const itens = await Model.find(filtro).sort({ [campoBusca]: 1 });
      res.json(itens);
    },

    obter: async (req, res) => {
      const item = await Model.findById(req.params.id);
      if (!item) return res.status(404).json({ erro: 'Registro não encontrado' });
      res.json(item);
    },

    criar: async (req, res) => {
      try {
        const item = await Model.create(req.body);
        res.status(201).json(item);
      } catch (err) {
        if (err.code === 11000) return res.status(409).json({ erro: 'Registro duplicado' });
        res.status(400).json({ erro: err.message });
      }
    },

    atualizar: async (req, res) => {
      const item = await Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!item) return res.status(404).json({ erro: 'Registro não encontrado' });
      res.json(item);
    },

    // Exclusão lógica: preserva o histórico/relacionamentos que apontam pro registro
    remover: async (req, res) => {
      const item = await Model.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true });
      if (!item) return res.status(404).json({ erro: 'Registro não encontrado' });
      res.json(item);
    },
  };
}

module.exports = criarCrudSimples;
