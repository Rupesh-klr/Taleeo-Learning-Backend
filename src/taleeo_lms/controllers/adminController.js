const batchService = require('../services/batchService');
const contentService = require('../services/contentService');
const userService = require('../services/userService');
const attendanceService = require('../services/attendanceService');
const courseService = require('../services/courseService');
const studentService = require('../services/studentService');
const db = require('../../config/db');

// const { activeConnections } = require('../../config/db'); // Ensure this is imported at the top
// 1. Import your database connection logic
// const { activeConnections } = require('../../config/db'); // Adjust path to your db config
// const dbService = require('../services/dbService'); // The service containing getFullCurriculum

const getBatches = async (req, res) => {
    try {
        const batches = await batchService.getAllBatches(req.clientName); // 🌟 Added clientName
        res.status(200).json(batches);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch batches" });
    }
};

const createNewBatch = async (req, res) => {
    try {
        const batch = await batchService.createBatch(req.clientName, req.body); // 🌟

        res.status(201).json({ message: "Batch created successfully", batch });
    } catch (error) {
        res.status(400).json({ message: "Error creating batch" });
    }
};

const getDocuments = async (req, res) => {
    const docs = await contentService.getAllDocuments(req.clientName); // 🌟
    res.json(docs);
};

const postDocument = async (req, res) => {
    const doc = await contentService.uploadDocument(req.clientName, req.body); // 🌟
    res.status(201).json(doc);
};

const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        await contentService.deleteDocument(req.clientName, id);
        res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete document', error: error.message });
    }
};
/**
 * Force-resets a student's password from the admin panel.
 */
const adminResetPassword = async (req, res) => {
    try {
        const { studentId, newPass } = req.body;

        if (!studentId || !newPass) {
            return res.status(400).json({ message: "Student ID and new password are required." });
        }

        // Call the service to update the database
        await studentService.adminForceResetPassword(req.clientName, studentId, newPass);
        
        res.status(200).json({ message: "Student password reset successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to reset student password", error: error.message });
    }
};

/**
 * Toggles a student's active status (Soft Delete).
 */
const toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body; // Expecting boolean true/false

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ message: "Invalid status value provided." });
        }

        // Call the service to toggle flags
        await studentService.toggleStudentStatus(req.clientName, id, isActive);

        const statusLabel = isActive ? "activated" : "deactivated";
        res.status(200).json({ message: `Student account ${statusLabel} successfully.` });
    } catch (error) {
        res.status(500).json({ message: "Failed to update student status", error: error.message });
    }
};

const getRecordings = async (req, res) => {
    const recs = await contentService.getAllRecordings(req.clientName); // 🌟
    res.json(recs);
};

const postRecording = async (req, res) => {
    const rec = await contentService.addRecording(req.clientName, req.body); // 🌟
    res.status(201).json(rec);
};

const deleteRecording = async (req, res) => {
    try {
        const { id } = req.params;
        await contentService.deleteRecording(req.clientName, id);
        res.status(200).json({ message: 'Recording deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete recording', error: error.message });
    }
};

const updateAttendance = async (req, res) => {
    const updated = await attendanceService.saveAttendance(req.clientName, req.body); // 🌟
    res.json(updated);
};
const getStudentDashboardSummary = async (req, res) => {
    try {
        const client = req.clientName;

        // 🌟 HIGH PERFORMANCE: Fetching existing DB data concurrently
        const [
            attendanceCount,   // totalStudents
            classesCount,      // activeBatchesCount
            totalDocs, 
            totalRecs, 
            activeBatchesRaw,
            recentRecsRaw
        ] = await Promise.all([
            userService.getStudentCount(client),
            batchService.getActiveBatchCount(client),
            contentService.getDocsCount(client),
            contentService.getRecsCount(client),
            batchService.getActiveBatches(client),
            contentService.getRecentRecordings(client, 2) // Assuming you have this service
        ]);

        // 🌟 STATIC DATA (To be moved to DB later)
        const activeUser = {
            name: "Rupesh Kumar",
            email: "rupesh@taleeo.local",
            role: "Instructor",
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user?.name || 'Rupesh'}`
        };

        const quickActions = [
            { label: "Add New Batch", icon: "plus-circle", route: "/admin/add-batch" },
            { label: "Upload Document", icon: "file-upload", route: "/admin/upload" },
            { label: "Send Announcement", icon: "mega-phone", route: "/admin/notify" }
        ];

        // 🌟 FORMATTING DATA to match your JSON Model
        const batches = activeBatchesRaw.map(b => ({
            batchId: b.id || b._id,
            title: b.name,
            timing: b.timing,
            days: b.days || "Mon-Fri", // Fallback if not in DB
            type: b.type || "Live Session",
            zoomConfig: {
                meetingId: b.zoomId || "N/A",
                passcode: b.zoomPass || "N/A",
                link: b.zoomLink || "#"
            },
            studentCount: b.studentCount || 0,
            status: b.status || "Active"
        }));

        const recentRecordings = [{},{}].map(r => ({
            id: r.id || r._id,
            title: r.title,
            date: r.createdAt || "Recent",
            duration: r.duration || "00:00",
            thumbnail: r.thumbnail || "/assets/recs/default.png",
            url: r.url || "#"
        }));

        // 🌟 FINAL RESPONSE MAPPING
        const responseBody = {
            stats: {
                studentsAttendance: attendanceCount,
                classesAttended: classesCount,
                recordingsAvailable: totalRecs,
                documentsShared: totalDocs
            },
            activeUser,
            modules: [{
            "id": "Rupesh Student",
            "title": "rupesh@taleeo.local"
        },{
            "id": "Rupesh Student_1",
            "title": "rupesh@taleeo.local"
        }], // Future: Add userService.getAssignedModules(client)
            batches,
            recentRecordings,
            quickActions,
            recentRecsRaw
        };

        res.status(200).json(responseBody);

    } catch (error) {
        console.error("Dashboard Summary Error:", error);
        res.status(500).json({ 
            message: 'Error fetching dashboard summary', 
            error: error.message 
        });
    }
};

const getDashboardSummary = async (req, res) => {
    try {
        const client = req.clientName; 

        // 🌟 HIGH PERFORMANCE: Run all queries concurrently!
        const [
            totalStudents, 
            activeBatchesCount, 
            totalDocs, 
            totalRecs, 
            recentStudentsRaw, // <-- You defined it here
            activeBatchesRaw   // <-- You defined it here
        ] = await Promise.all([
            userService.getStudentCount(client),
            batchService.getActiveBatchCount(client),
            contentService.getDocsCount(client),
            contentService.getRecsCount(client),
            userService.getRecentStudents(client, 5), 
            batchService.getActiveBatches(client) 
        ]);

        // 🌟 FIX 1: Use `recentStudentsRaw` instead of `students`
        // Note: Since your DB query already fetches the latest 5 (LIMIT 5), 
        // you just need to map them to the format you want.
        const recentStudents = recentStudentsRaw.map(s => ({
            name: s.name,
            email: s.email
        }));

        // 🌟 FIX 2: Use `activeBatchesRaw` instead of `batches`
        const activeBatchesFormatted = activeBatchesRaw.map(b => ({
            name: b.name,
            timing: b.timing,
            students: b.students || []
        }));

        const summary = {
            totalStudents: totalStudents,
            activeBatchesCount: activeBatchesCount,
            totalDocs: totalDocs,
            totalRecs: totalRecs,
            recentStudents: recentStudents,
            activeBatches: activeBatchesFormatted
        };

        res.status(200).json(summary);
    } catch (error) {
        console.error("Dashboard Summary Error:", error); // Good for your terminal logs
        res.status(500).json({ message: 'Error fetching dashboard summary', error: error.message });
    }
};
const getStudents = async (req, res) => {
    try {
        const students = await userService.getAllStudents(req.clientName); // 🌟
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching students' });
    }
};

const createStudent = async (req, res) => {
    try {
        const studentPayload = { ...req.body, role: 'student',isDeleted:false };
        const newStudent = await userService.createStudent(req.clientName, studentPayload); // 🌟
        res.status(201).json({ message: 'Student created successfully', user: newStudent });
    } catch (error) {
        res.status(500).json({ message: 'Error creating student' });
    }
};

const createAdmin = async (req, res) => {
    try {
        const adminPayload = { ...req.body, role: 'admin' };
        const newAdmin = await userService.createUser(req.clientName, adminPayload); // 🌟
        res.status(201).json({ message: 'Admin created successfully', user: newAdmin });
    } catch (error) {
        res.status(500).json({ message: 'Error creating admin' });
    }
};
const postCourse = async (req, res) => {
    try {
       // Log the initiation for debugging
        console.log("POST /courses payload:", req.body);

        const payload = {
            ...req.body,
            id: 'c_' + Date.now(), 
            isDeleted: false,
            // Ensure req.user exists from your auth middleware
            createdBy: (req.user && req.user.email) ? req.user.email : "system", 
            createdAt: Date.now(),
            modules: [],
            batches: []
        };

        // Pass req.clientName which was identified in your RBAC/Request trace
        const result = await courseService.createCourse(req.clientName, payload);
        
        res.status(201).json({ 
            message: "Course added successfully", 
            courseId: payload.id,
            result 
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to create course" });
    }
};
const deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Pass the clientName (e.g., 'primary') and ID to the service
        await courseService.removeCourse(req.clientName, id);
        
        res.status(200).json({ message: "Course soft-deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Delete failed", error: error.message });
    }
};
const enrollStudentInBatch = async (req, res) => {
    try {
        const { id } = req.params; // Batch ID
        const { studentId } = req.body; // Student ID

        // 1. Add student to the Batch
        const batchData = {
            filter: { id: id },
            updateData: { $addToSet: { students: studentId } } 
        };
        await db.executeWrite(req.clientName, 'batches', batchData, 'updateOne');

        // 2. Add Batch ID to the Student's profile to track enrollment count
        const userData = {
            filter: { id: studentId },
            updateData: { $addToSet: { enrolledBatches: id } } 
        };
        await db.executeWrite(req.clientName, 'users', userData, 'updateOne');

        res.status(200).json({ message: "Student enrolled and user record updated" });
    } catch (error) {
        res.status(500).json({ message: "Enrollment failed", error: error.message });
    }
};
// adminController.js
// const enrol/

const deleteBatch = async (req, res) => {
    try {
        const { id } = req.params;
        const data = {
            filter: { id: id },
            updateData: { $set: { isDeleted: true } } // Soft delete only
        };

        await db.executeWrite(req.clientName, 'batches', data, 'updateOne');
        await db.executeWrite(
            req.clientName,
            'courses',
            {
                filter: { batches: id },
                updateData: { $pull: { batches: id } }
            },
            'updateMany'
        );
        res.status(200).json({ message: "Batch deactivated" });
    } catch (error) {
        res.status(500).json({ message: "Delete failed", error: error.message });
    }
};
const getCourses = async (req, res) => {
    try {
        const { q = '', limit = 20, offset = 0 } = req.query;
        
        // No DB creation here; the service handles the abstraction
        const data = await courseService.getFullCurriculum(req.clientName,q, limit, offset);

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ 
            message: "Error searching courses", 
            error: error.message 
        });
    }
};
// const searchCourses = async (req, res) => {
//     try {
//         const { q = '', limit = 20 } = req.query;
        
//         // Define the "Like approach" using regex for partial matching
//         const searchRegex = { $regex: q, $options: 'i' }; // 'i' for case-insensitive

//         const pipeline = [
//             { 
//                 $match: { 
//                     isDeleted: false,
//                     $or: [
//                         { name: searchRegex },        // Match by Name
//                         { id: searchRegex },          // Match by Course ID (e.g., c_devops_02)
//                         { description: searchRegex }  // Match by Description
//                     ]
//                 } 
//             },
//             {
//                 $lookup: {
//                     from: "modules",
//                     localField: "id",
//                     foreignField: "courseId",
//                     as: "modules"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "batches",
//                     localField: "id",
//                     foreignField: "courseId",
//                     as: "batches"
//                 }
//             },
//             { $limit: parseInt(limit) }
//         ];

//         const courses = await db.collection('courses').aggregate(pipeline).toArray();
//         res.status(200).json({ totalRecords: courses.length, courses });
//     } catch (error) {
//         res.status(500).json({ message: "Search failed", error: error.message });
//     }
// };


const searchCourses = async (req, res) => {
    try {
        const { q = '', limit = 20 } = req.query;
        const data = await courseService.searchCoursesWithFilters(req.clientName, q, parseInt(limit));
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: "Search failed", error: error.message });
    }
};

// const searchCourses = async (req, res) => {
//     try {
//         const { q = '', limit = 20 } = req.query;
        
//         // 1. Get the database instance for the current client
//         const conn = activeConnections[req.clientName]; 
//         if (!conn) return res.status(500).json({ message: "Database connection not found" });
//         const db = conn.db; 

//         // 2. Define the "Like approach" regex
//         const searchRegex = { $regex: q, $options: 'i' }; 

//         const pipeline = [
//             { 
//                 $match: { 
//                     isDeleted: false,
//                     $or: [
//                         { name: searchRegex },        
//                         { id: searchRegex },          
//                         { description: searchRegex }  
//                     ]
//                 } 
//             },
//             {
//                 $lookup: {
//                     from: "modules",
//                     localField: "id",
//                     foreignField: "courseId",
//                     as: "modules"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "batches",
//                     localField: "id",
//                     foreignField: "courseId",
//                     as: "batches"
//                 }
//             },
//             { $limit: parseInt(limit) }
//         ];

//         // 3. Execute using the 'db' instance we just defined
//         const courses = await db.collection('courses').aggregate(pipeline).toArray();
        
//         res.status(200).json({ totalRecords: courses.length, courses });
//     } catch (error) {
//         // This will now capture actual query errors instead of "db is not defined"
//         res.status(500).json({ message: "Search failed", error: error.message });
//     }
// };
// const getCourses = async (req, res) => {
//     try {
//         const { q = '', limit = 20, offset = 0 } = req.query;
        
//         // Call the service using the database connection name (e.g., 'primary')
//         const data = await dbService.getFullCurriculum('primary', {
//             searchTerm: q,
//             limit: parseInt(limit),
//             offset: parseInt(offset)
//         });

//         res.status(200).json(data);
//     } catch (error) {
//         res.status(500).json({ message: "Server Error", error: error.message });
//     }
// };
// // --- New Endpoint for Advanced/Existing Connections ---
// const getAdvancedCourseDetails = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const pipeline = [
//             { $match: { id: id, isDeleted: false } },
//             {
//                 $lookup: {
//                     from: "modules",
//                     localField: "id",
//                     foreignField: "courseId",
//                     as: "modules" // Matching your provided configuration
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "batches",
//                     localField: "id",
//                     foreignField: "courseId",
//                     as: "batches" // Matching your provided configuration
//                 }
//             },
//             // Example of an "Advanced Connection": Link to students enrolled in those batches
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "batches.students",
//                     foreignField: "id",
//                     as: "enrolledStudents"
//                 }
//             }
//         ];

//         const result = await db.collection('courses').aggregate(pipeline).toArray();
//         if (!result.length) return res.status(404).json({ message: "Course not found" });

//         res.status(200).json(result[0]);
//     } catch (error) {
//         res.status(500).json({ message: "Advanced fetch failed", error: error.message });
//     }
// };

// const searchCourses = async (req, res) => {
//     try {
//         const { q = '', limit = 20 } = req.query;
        
//         // Use the connection from your activeConnections pool
//         const db = activeConnections['primary'].db; 
        
//         const pipeline = [
//             { 
//                 $match: { 
//                     name: { $regex: q, $options: 'i' },
//                     isDeleted: false 
//                 } 
//             },
//             {
//                 $lookup: {
//                     from: "modules",
//                     localField: "id",
//                     foreignField: "courseId",
//                     as: "moduleDetails"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "batches",
//                     localField: "id",
//                     foreignField: "courseId",
//                     as: "batchDetails"
//                 }
//             },
//             { $limit: parseInt(limit) }
//         ];

//         const courses = await db.collection('courses').aggregate(pipeline).toArray();
//         res.status(200).json({ totalRecords: courses.length, courses });
//     } catch (error) {
//         // This will no longer throw "db is not defined"
//         res.status(500).json({ message: "Error searching courses", error: error.message });
//     }
// };

// const createCourse = async (req, res) => {
//     try {
//         const payload = { ...req.body, id: 'c' + Date.now(), isDeleted: false };
//         await db.collection('courses').insertOne(payload);
//         res.status(201).json({ message: "Course created", course: payload });
//     } catch (error) {
//         res.status(500).json({ message: "Create failed" });
//     }
// };

// const updateCourse = async (req, res) => {
//     try {
//         const { id } = req.params;
//         await db.collection('courses').updateOne({ id }, { $set: req.body });
//         res.status(200).json({ message: "Course updated" });
//     } catch (error) {
//         res.status(500).json({ message: "Update failed" });
//     }
// };

// const deleteCourse = async (req, res) => {
//     try {
//         const { id } = req.params;
//         // Soft delete pattern used in your system
//         await db.collection('courses').updateOne({ id }, { $set: { isDeleted: true } });
//         res.status(200).json({ message: "Course deleted" });
//     } catch (error) {
//         res.status(500).json({ message: "Delete failed" });
//     }
// };
const createModule = async (req, res) => {
    try {
        const payload = {
            ...req.body,
            id: 'm_' + Date.now(), // Generate unique module ID
            isDeleted: false,
            createdAt: Date.now()
        };
        // Use your common db logic for insertion
        await db.executeWrite(req.clientName, 'modules', payload, 'insertOne');
        // i have course id payload.courseId and module id payload.id
        // Now, we need to link this module to the course by updating the course document
        await db.executeWrite(
            req.clientName,
            'courses',
            {
                filter: { id: payload.courseId },
                updateData: { $addToSet: { modules: payload.id } } // Add module ID to course's modules array
            },
            'updateOne'
        );  
        res.status(201).json({ message: "Module created successfully", id: payload.id });
    } catch (error) {
        res.status(500).json({ message: "Failed to create module", error: error.message });
    }
};

const updateModule = async (req, res) => {
    try {
        const { id } = req.params;
        const filter = { id: id };
        const updateData = { $set: req.body };
        
        // Use your common db logic for updating
        console.log({ filter, updateData },id)
        await db.executeWrite(req.clientName, 'modules', { filter, updateData }, 'updateOne');
        res.status(200).json({ message: "Module updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Update failed", error: error.message });
    }
};

const deleteModule = async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete approach consistent with your course logic
        const filter = { id: id };
        const updateData = { $set: { isDeleted: true } };
        
        await db.executeWrite(req.clientName, 'modules', { filter, updateData }, 'updateOne');
 await db.executeWrite(
            req.clientName,
            'courses',
            {
                filter: { modules: id },
                updateData: { $pull: { modules: id } }
            },
            'updateMany'
        );
        res.status(200).json({ message: "Module deleted" });
    } catch (error) {
        res.status(500).json({ message: "Delete failed" });
    }
};
// controllers/adminController.js
// 🌟 Enhanced: Update batch with bidirectional course linkage
const updateBatch = async (req, res) => {
    try {
        const batchId = req.params.id;
        const { courseId, ...otherUpdates } = req.body;
        
        // Prepare batch update data
        const batchUpdateData = courseId 
            ? { ...otherUpdates, courseId } 
            : otherUpdates;
        
        // 1. Update the batch document with all fields including courseId
        const batchUpdate = {
            filter: { id: batchId },
            updateData: { $set: batchUpdateData }
        };
        await db.executeWrite(req.clientName, 'batches', batchUpdate, 'updateOne');
        
        // 2. If courseId is provided, add this batch to the course's batches array (bidirectional link)
        if (courseId) {
            const courseUpdate = {
                filter: { id: courseId },
                updateData: { $addToSet: { batches: batchId } } // Add if not already present
            };
            await db.executeWrite(req.clientName, 'courses', courseUpdate, 'updateOne');
            console.log(`✅ Batch "${batchId}" linked to Course "${courseId}"`);
        }
        
        res.status(200).json({ 
            message: "Batch updated successfully",
            batchId: batchId,
            courseId: courseId,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Update batch error:', error);
        res.status(500).json({ message: "Update failed", error: error.message });
    }
};
// adminController.js
const removeStudentPermanently = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Remove the student from the 'users' collection
        const userFilter = { id: id, role: 'student' };
        await db.executeWrite(req.clientName, 'users', userFilter, 'deleteOne');

        // 2. Remove the student ID from any 'batches' they were enrolled in
        const batchUpdate = {
            filter: { students: id },
            updateData: { $pull: { students: id } } // $pull removes the ID from the array
        };
        await db.executeWrite(req.clientName, 'batches', batchUpdate, 'updateMany');

        res.status(200).json({ message: "Student record removed from system" });
    } catch (error) {
        res.status(500).json({ message: "Failed to remove student", error: error.message });
    }
};
const removeStudentFromBatch = async (req, res) => {
    try {
        const { id } = req.params; // Student ID
        const { batchId } = req.body; // Explicit batch to remove from

        // 1. Remove student from the specific Batch array
        const batchUpdate = {
            filter: { id: batchId },
            updateData: { $pull: { students: id } } 
        };
        await db.executeWrite(req.clientName, 'batches', batchUpdate, 'updateOne');

        // 2. Remove Batch ID from the Student's enrolled list
        const userUpdate = {
            filter: { id: id },
            updateData: { $pull: { enrolledBatches: batchId } }
        };
        await db.executeWrite(req.clientName, 'users', userUpdate, 'updateOne');

        res.status(200).json({ message: "Student un-enrolled successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to remove student from batch", error: error.message });
    }
};
const handleEnrollmentRequest = async (req, res) => {
    try {
        const { requestId, action } = req.body; // action: 'approve' or 'reject'
        
        // 1. Fetch the request details
        const requestData = await db.executeRead(req.clientName, 'enrollment_requests', { id: requestId });
        if (!requestData) return res.status(404).json({ message: "Request not found" });

        if (action === 'approve') {
            // 2. Trigger automated enrollment using existing logic
            await batchService.enrollStudentInBatch(req.clientName, {
                batchId: requestData.batchId,
                studentId: requestData.studentId
            });

            // 3. Update request status
            await db.executeWrite(req.clientName, 'enrollment_requests', {
                filter: { id: requestId },
                updateData: { $set: { status: 'approved', processedAt: Date.now() } }
            }, 'updateOne');

            res.status(200).json({ message: "Request approved and student enrolled" });
        } else {
            // 4. Handle rejection
            await db.executeWrite(req.clientName, 'enrollment_requests', {
                filter: { id: requestId },
                updateData: { $set: { status: 'rejected', processedAt: Date.now() } }
            }, 'updateOne');

            res.status(200).json({ message: "Request rejected" });
        }
    } catch (error) {
        res.status(500).json({ message: "Approval workflow failed", error: error.message });
    }
};
const createEnrollmentRequest = async (req, res) => {
    try {
        const { courseId, batchId } = req.body;
        const studentId = req.user.id; // From auth middleware

        const payload = {
            id: 'req_' + Date.now(),
            studentId,
            courseId,
            batchId,
            status: "pending", // Default status
            requestedAt: Date.now(),
            isDeleted: false
        };

        await db.executeWrite(req.clientName, 'enrollment_requests', payload, 'insertOne');
        res.status(201).json({ message: "Request submitted for approval", requestId: payload.id });
    } catch (error) {
        res.status(500).json({ message: "Failed to submit request", error: error.message });
    }
};

const getPendingRequests = async (req, res) => {
    try {
        // Admin only: fetch all pending and non-deleted requests
        const query = { 
            status: "pending", 
            isDeleted: false 
        };
        const requests = await db.executeRead(req.clientName, 'enrollment_requests', query);
        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { 
    removeStudentPermanently,
    removeStudentFromBatch,
    createModule, updateModule, deleteModule,
    getBatches, createNewBatch, 
    updateBatch,
    getDocuments, postDocument, deleteDocument,
    getRecordings, postRecording, deleteRecording,
    updateAttendance, getDashboardSummary,
    getStudents, createStudent, createAdmin,
    deleteCourse, getStudentDashboardSummary,
    // searchCourses, createCourse, updateCourse, deleteCourse, getAdvancedCourseDetails,getCourses
    searchCourses, getCourses,
    postCourse,
    deleteBatch,enrollStudentInBatch,
    handleEnrollmentRequest,adminResetPassword, 
    toggleStatus,createEnrollmentRequest, getPendingRequests
};