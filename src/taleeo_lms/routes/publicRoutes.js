const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const studentController = require('../controllers/studentController');


router.get('/dashboard/summary', adminController.getDashboardSummary);
router.get('/student/dashboard/summary', studentController.getStudentDashboardSummary);

module.exports = router;