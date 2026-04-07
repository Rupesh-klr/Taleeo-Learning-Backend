const db = require('../../config/db');

// Service to toggle student status
const toggleStudentStatus = async (clientName, studentId, targetStatus) => {
    const data = {
        filter: { id: studentId },
        updateData: { 
            $set: { 
                isActive: targetStatus, // true or false
                modifiedAt: Date.now() 
            } 
        }
    };
    // Standardized executeWrite for MongoDB
    return await db.executeWrite(clientName, 'users', data, 'updateOne');
};

// Administrative Reset Service
const adminForceResetPassword = async (clientName, studentId, newPassword) => {
    const data = {
        filter: { id: studentId, role: 'student' },
        updateData: { 
            $set: { 
                password: newPassword, // admin provided password
                firstLogin: false, // Forces user to change it on next login if configured
                modifiedAt: Date.now()
            } 
        }
    };
    return await db.executeWrite(clientName, 'users', data, 'updateOne');
};

module.exports = { toggleStudentStatus, adminForceResetPassword };