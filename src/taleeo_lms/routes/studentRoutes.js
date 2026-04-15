const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken } = require('../../middleware/jwtMiddleware');


// router.get('/dashboard/summary', adminController.getDashboardSummary);
router.get('/dashboard/summary', verifyToken, studentController.getStudentDashboardSummary);
router.get('/student/dashboard/summary', verifyToken, studentController.getStudentDashboardSummary);
router.get('/recordings', verifyToken, studentController.getStudentRecordings);
router.get('/documents', verifyToken, studentController.getStudentDocuments);

module.exports = router;