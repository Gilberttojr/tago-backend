const asyncHandler = require('./asyncHandler');

// Recebe um objeto controller (ex: { listar, criar, ... }) e devolve uma
// cópia com cada método já envolvido em asyncHandler.
function wrapController(controller) {
  return Object.fromEntries(
    Object.entries(controller).map(([nome, fn]) => [nome, asyncHandler(fn)])
  );
}

module.exports = wrapController;
