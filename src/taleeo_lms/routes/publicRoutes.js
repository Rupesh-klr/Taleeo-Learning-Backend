const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Batches
// router.get('/batches', adminController.getBatches);
// router.post('/batches', adminController.createNewBatch);

// // Documents
// router.get('/documents', adminController.getDocuments);
// router.post('/documents', adminController.postDocument);

// // Recordings
// router.get('/recordings', adminController.getRecordings);
// router.post('/recordings', adminController.postRecording);

// // Attendance
// router.post('/attendance', adminController.updateAttendance);
// // Add this route
// router.get('/students', adminController.getStudents);
// router.post('/students', adminController.createStudent);
// router.post('/admins', adminController.createAdmin);

router.get('/dashboard/summary', adminController.getDashboardSummary);

module.exports = router;