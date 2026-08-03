const express = require('express');
const router = express.Router();
const ctrl = require('../utils/wrapController')(require('../controllers/userController'));
const { exigirAdministrador } = require('../middleware/auth');

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obter);
router.post('/', exigirAdministrador, ctrl.criar);
router.patch('/:id', exigirAdministrador, ctrl.atualizar);
router.delete('/:id', exigirAdministrador, ctrl.remover);

module.exports = router;
