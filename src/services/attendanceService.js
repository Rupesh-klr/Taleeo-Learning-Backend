const { readData, writeData } = require('../config/db');

const getFullAttendance = async () => {
    return readData('attendance');
};

const saveAttendance = async (attendanceRecord) => {
    // attendanceRecord structure: { "studentID": { "2026-03-29": "present" } }
    let currentAttendance = readData('attendance');
    
    // Merge new records into existing ones
    for (const [studentId, dates] of Object.entries(attendanceRecord)) {
        if (!currentAttendance[studentId]) currentAttendance[studentId] = {};
        Object.assign(currentAttendance[studentId], dates);
    }

    writeData('attendance', currentAttendance);
    return currentAttendance;
};

module.exports = { getFullAttendance, saveAttendance };