const express = require('express');
const router = express.Router();
const ctrl = require('../utils/wrapController')(require('../controllers/chipController'));
const { exigirAdministrador } = require('../middleware/auth');

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obter);
router.post('/', exigirAdministrador, ctrl.criar);
router.patch('/:id', exigirAdministrador, ctrl.atualizar);
router.post('/:id/instalar', exigirAdministrador, ctrl.instalar);
router.post('/:id/entregar', exigirAdministrador, ctrl.entregar);
router.post('/:id/liberar', exigirAdministrador, ctrl.liberar);
router.post('/:id/status', exigirAdministrador, ctrl.mudarStatus);
router.delete('/:id', exigirAdministrador, ctrl.remover);

module.exports = router;
