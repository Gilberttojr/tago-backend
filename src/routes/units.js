const express = require('express');
const router = express.Router();
const Unit = require('../models/Unit');
const criarCrudSimples = require('../utils/simpleCrudController');
const wrapController = require('../utils/wrapController');
const { exigirAdministrador } = require('../middleware/auth');

const ctrl = wrapController(criarCrudSimples(Unit));

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obter);
router.post('/', exigirAdministrador, ctrl.criar);
router.patch('/:id', exigirAdministrador, ctrl.atualizar);
router.delete('/:id', exigirAdministrador, ctrl.remover);

module.exports = router;
