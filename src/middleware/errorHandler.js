// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[erro]', err.message);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ erro: err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ erro: `ID inválido: ${err.value}` });
  }
  if (err.code === 11000) {
    return res.status(409).json({ erro: 'Registro duplicado', campo: err.keyValue });
  }

  res.status(500).json({ erro: 'Erro interno do servidor' });
}

module.exports = errorHandler;
