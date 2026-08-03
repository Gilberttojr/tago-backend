const express = require('express');
const router = express.Router();
const Tecnico = require('../models/Tecnico');
const criarCrudSimples = require('../utils/simpleCrudController');
const wrapController = require('../utils/wrapController');
const { exigirAdministrador } = require('../middleware/auth');

const ctrl = wrapController(criarCrudSimples(Tecnico));

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obter);
router.post('/', exigirAdministrador, ctrl.criar);
router.patch('/:id', exigirAdministrador, ctrl.atualizar);
router.delete('/:id', exigirAdministrador, ctrl.remover);

module.exports = router;
