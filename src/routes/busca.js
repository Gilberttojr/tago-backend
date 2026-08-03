const express = require('express');
const router = express.Router();
const ctrl = require('../utils/wrapController')(require('../controllers/searchController'));

router.get('/', ctrl.buscar);

module.exports = router;
