// Express 4 não repassa automaticamente erros de handlers async pro
// middleware de erro. Esse wrapper resolve isso sem precisar de try/catch
// em cada controller.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
