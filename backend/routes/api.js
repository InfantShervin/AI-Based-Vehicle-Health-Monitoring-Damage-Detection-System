const express = require('express');
const router = express.Router();
const uploadMiddleware = require('../middlewares/uploadMiddleware');
const analysisController = require('../controllers/analysisController');

// POST /api/analyze
router.post('/analyze', uploadMiddleware.single('vehicle_image'), analysisController.analyzeVehicle);

module.exports = router;
