const express = require('express');
const router = express.Router();
const ctrl = require('../utils/wrapController')(require('../controllers/dashboardController'));

router.get('/resumo', ctrl.resumo);

module.exports = router;
