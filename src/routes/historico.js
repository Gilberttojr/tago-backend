const express = require('express');
const router = express.Router();
const ctrl = require('../utils/wrapController')(require('../controllers/historyController'));

router.get('/', ctrl.listar);

module.exports = router;
