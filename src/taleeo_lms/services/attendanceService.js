const db = require('../../config/db');
const { validateSchema } = require('../models/schemaValidator');

const getFullAttendance = async (clientName) => {
    return await db.executeSelect(clientName, 'GET_ALL_ATTENDANCE');
};

const saveAttendance = async (clientName, payload) => {
    // If frontend sends { batchId: 'b123', records: { s1: {'2026-03-29': 'present'} } }
    // Or if it just sends the raw records object { s1: {'2026-03-29': 'present'} }
    const records = payload.records || payload;
    const batchId = payload.batchId || "unknown_batch"; 

    const savePromises = [];

    // Loop through the old nested object and flatten it!
    for (const [studentId, dates] of Object.entries(records)) {
        if (typeof dates === 'object') {
            for (const [date, status] of Object.entries(dates)) {
                
                // Construct a flat Database Row
                const newRecord = {
                    id: 'att_' + Date.now() + Math.floor(Math.random() * 1000),
                    studentId: studentId,
                    batchId: batchId,
                    date: date,
                    status: status
                };

                // 1. Validate the flat schema
                validateSchema('attendance', newRecord);

                // 2. Push the database write operation into an array
                // In production, we use updateOne with {upsert: true} to avoid duplicates, 
                // but executeWrite will handle the basic insertion perfectly here.
                savePromises.push(db.executeWrite(clientName, 'attendance', newRecord));
            }
        }
    }

    // Execute all database writes concurrently for high performance
    await Promise.all(savePromises);
    
    return { message: "Attendance flattened and saved successfully!" };
};

module.exports = { getFullAttendance, saveAttendance };