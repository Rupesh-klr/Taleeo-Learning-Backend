const batchService = require('../services/batchService');
const contentService = require('../services/contentService');
const userService = require('../services/userService');
const attendanceService = require('../services/attendanceService');


const getBatches = async (req, res) => {
    try {
        const batches = await batchService.getAllBatches();
        res.status(200).json(batches);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch batches" });
    }
};

const createNewBatch = async (req, res) => {
    try {
        const batch = await batchService.createBatch(req.body);
        res.status(201).json({ message: "Batch created successfully", batch });
    } catch (error) {
        res.status(400).json({ message: "Error creating batch" });
    }
};

// module.exports = { getBatches, createNewBatch };

const getDocuments = async (req, res) => {
    const docs = await contentService.getAllDocuments();
    res.json(docs);
};

const postDocument = async (req, res) => {
    const doc = await contentService.uploadDocument(req.body);
    res.status(201).json(doc);
};

const getRecordings = async (req, res) => {
    const recs = await contentService.getAllRecordings();
    res.json(recs);
};

const postRecording = async (req, res) => {
    const rec = await contentService.addRecording(req.body);
    res.status(201).json(rec);
};

const updateAttendance = async (req, res) => {
    const updated = await attendanceService.saveAttendance(req.body);
    res.json(updated);
};
const getDashboardSummary = async (req, res) => {
    try {
        // 1. Fetch all raw data from your services
        const students = await userService.getAllStudents();
        const batches = await batchService.getAllBatches();
        const docs = await contentService.getAllDocuments();
        const recs = await contentService.getAllRecordings();

        // 2. Process active batches
        const activeBatchesRaw = batches;
        //.filter(b => b.active === true);
        
        // 3. Format Recent Students (Grab the last 5 added)
        const recentStudents = students.slice(-5).reverse().map(s => ({
            name: s.name,
            email: s.email
        }));

        // 4. Format Active Batches
        const activeBatchesFormatted = activeBatchesRaw.map(b => ({
            name: b.name,
            timing: b.timing,
            students: b.students || [] // Array of student IDs
        }));

        // 5. Construct the final JSON payload
        const summary = {
            totalStudents: students.length,
            activeBatchesCount: activeBatchesRaw.length,
            totalDocs: docs.length,
            totalRecs: recs.length,
            recentStudents: recentStudents,
            activeBatches: activeBatchesFormatted
        };

        // 6. Send the response
        res.status(200).json(summary);

    } catch (error) {
        console.error("Dashboard Summary Error:", error);
        res.status(500).json({ message: 'Error fetching dashboard summary', error: error.message });
    }
};
// Add this new function
const getStudents = async (req, res) => {
    try {
        const students = await userService.getAllStudents();
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching students' });
    }
};
const createStudent = async (req, res) => {
    try {
        // Force the role to be 'student' for security
        const studentPayload = { ...req.body, role: 'student' };
        
        const newStudent = await userService.createStudent(studentPayload);
        res.status(201).json({ message: 'Student created successfully', user: newStudent });
        
    } catch (error) {
        if (error.message === 'Email already exists') {
            return res.status(409).json({ message: error.message });
        }
        console.error("Error creating student:", error);
        res.status(500).json({ message: 'Error creating student' });
    }
};

const createAdmin = async (req, res) => {
    try {
        // Force the role to be 'admin' for security
        const adminPayload = { ...req.body, role: 'admin' };
        
        const newAdmin = await userService.createUser(adminPayload);
        res.status(201).json({ message: 'Admin created successfully', user: newAdmin });
        
    } catch (error) {
        if (error.message === 'Email already exists') {
            return res.status(409).json({ message: error.message });
        }
        console.error("Error creating admin:", error);
        res.status(500).json({ message: 'Error creating admin' });
    }
};

module.exports = { 
    getBatches, createNewBatch, 
    getDocuments, postDocument, 
    getRecordings, postRecording,
    updateAttendance,
    getDashboardSummary,
    getStudents,
    createStudent,
    createAdmin
};