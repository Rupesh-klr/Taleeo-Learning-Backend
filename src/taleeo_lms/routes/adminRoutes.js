const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const dropdownController = require('../controllers/dropdownController');

// Batches
router.get('/batches', adminController.getBatches);
router.post('/batches', adminController.createNewBatch);

// Documents
router.get('/documents', adminController.getDocuments);
router.post('/documents', adminController.postDocument);
router.put('/documents/:id', adminController.updateDocument);
router.delete('/documents/:id', adminController.deleteDocument);

// Recordings
router.get('/recordings', adminController.getRecordings);
router.post('/recordings', adminController.postRecording);
router.put('/recordings/:id', adminController.updateRecording);
router.delete('/recordings/:id', adminController.deleteRecording);

// Attendance
router.post('/attendance', adminController.updateAttendance);
router.get('/dropdowns', dropdownController.getDropdowns);
router.get('/dropdowns/:item', dropdownController.getDropdowns);
// Add this route
router.get('/students', adminController.getStudents);
router.post('/students', adminController.createStudent);
router.post('/admins', adminController.createAdmin);

router.post('/requests/handle', adminController.handleEnrollmentRequest);

router.get('/dashboard/summary', adminController.getDashboardSummary);
router.put('/students/reset-password', adminController.adminResetPassword);

// Soft Delete (Toggle Status)
router.patch('/students/:id/status', adminController.toggleStatus);
// Courses Management
router.get('/courses', adminController.getCourses);
router.get('/courses/search', adminController.searchCourses);
router.post('/courses', adminController.postCourse);
router.delete('/courses/:id', adminController.deleteCourse);

router.post('/modules', adminController.createModule);

// URL: http://localhost:3000/api/v1/taleeo_lms/admin/modules/m_dm_01
// router.put('/modules/:id', adminController.updateModule);
router.delete('/modules/:id', adminController.deleteModule);
router.put('/batches/:id/enroll', adminController.enrollStudentInBatch);
router.put('/batches/unenroll/:id', adminController.removeStudentFromBatch);


router.delete('/batches/:id', adminController.deleteBatch);
router.put('/batches/:id', adminController.updateBatch); // Ensure this exists
router.delete('/students/:id', adminController.removeStudentPermanently);
module.exports = router;