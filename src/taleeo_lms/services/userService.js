const db = require('../../config/db');
const { validateSchema } = require('../models/schemaValidator');

/**
 * Finds a user in the database by email
 */
const findUserByEmail = async (clientName, email) => {
     console.log(email);
    // Dynamic query using the JSON dictionary
    const users = await db.executeSelect(clientName, 'GET_USER_BY_EMAIL', {
        where: { email: email.toLowerCase() , isDeleted: false }
    });
     console.log(users);
    if (users.length === 0) return null;
    const user = users[0];
    console.log(user);

    // 2. THE JOIN: Fetch the actual role string using the user's roleId
    if (user.roleId) {
        const roles = await db.executeSelect(clientName, 'GET_ROLE_BY_ID', {
            where: { id: user.roleId, isDeleted: false }
        });
        
        if (roles.length > 0) {
            // Attach the human-readable string (e.g., "admin", "faculty", "student")
            user.role = roles[0].name; 
        } else {
            user.role = 'student'; // Safe fallback
        }
    }
    return user;
};

/**
 * Fast profile lookup by email (single query, no role join)
 */
const findUserByEmailFast = async (clientName, email) => {
    const users = await db.executeSelect(clientName, 'GET_USER_BY_EMAIL', {
        where: { email: String(email || '').toLowerCase(), isDeleted: false },
        limit: 1
    });
    if (users.length === 0) return null;
    return users[0];
};

/**
 * Validates login and returns the user object if successful
 */
const validateLogin = async (clientName, email, password) => {
    const user = await findUserByEmail(clientName, email);
    console.log(user);
    console.log(password)
    
    // Note: In production, compare hashed passwords using bcrypt!
    if (user && user.password === password) {
        return user;
    }
    return null;
};

/**
 * Updates a specific user (e.g., setting firstLogin to true)
 */
const updateUser = async (clientName, userId, updateData) => {
    if (process.env.DB_TYPE === '1') {
        // MongoDB Update execution
        const dbInstance = require('../config/db').activeConnections[clientName].db;
        const collection = dbInstance.collection('users');
        await collection.updateOne({ id: userId }, { $set: updateData });
    } else {
        // SQL Update execution (Assuming executeWrite can take custom SQL)
        const keys = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
        const values = Object.values(updateData);
        values.push(userId);
        const sql = `UPDATE users SET ${keys} WHERE id = ?`;
        await db.executeWrite(clientName, sql, values);
    }
    return { id: userId, ...updateData };
};

/**
 * Adds a new student to the database
 */
const createStudent = async (clientName, userData) => {
    // Check if email already exists
    const existingUser = await findUserByEmail(clientName, userData.email);
    if (existingUser) {
        throw new Error('Email already exists');
    }

    const newUser = {
        id: 's' + Date.now(),
        ...userData,
        role: 'student',
        firstLoginDone: false,
        avatar: userData.name ? userData.name[0].toUpperCase() : 'U',
        createdAt: new Date().toISOString()
    };

    // Strict Schema Check
    validateSchema('users', newUser);
    await db.executeWrite(clientName, 'users', newUser);
    return newUser;
};

/**
 * Adds a generic user (Admin or Student)
 */
const createUser = async (clientName, userData) => {
    // Check if email already exists
    const existingUser = await findUserByEmail(clientName, userData.email);
    if (existingUser) {
        throw new Error('Email already exists');
    }

    const prefix = userData.role === 'admin' ? 'a' : 's';
    const newUser = {
        id: prefix + Date.now(),
        name: userData.name,
        email: userData.email.toLowerCase(),
        password: userData.password,
        role: userData.role,
        phone: userData.phone || '',
        firstLoginDone: false,
        avatar: userData.name ? userData.name[0].toUpperCase() : 'U',
        batchId: userData.batchId || null,
        createdAt: new Date().toISOString()
    };

    // Strict Schema Check
    validateSchema('users', newUser);
    await db.executeWrite(clientName, 'users', newUser);
    return newUser;
};

// Helper function to dynamically get the Role ID based on the string name
const getRoleIdByName = async (clientName, roleName) => {
    const roles = await db.executeSelect(clientName, 'GET_ROLE_BY_NAME', {
        where: { name: roleName, isDeleted: false }
    });
    return roles.length > 0 ? roles[0].id : null;
};
const getAllStudents = async (clientName) => {
    return await db.executeSelect(clientName, 'GET_ALL_STUDENTS');
};

// 🌟 Get Total Count
const getStudentCount = async (clientName) => {
    // 1. Dynamically find out what the ID is for "student"
    const studentRoleId = await getRoleIdByName(clientName, 'student');
    
    if (!studentRoleId) return 0; // Failsafe if role doesn't exist

    // 2. Count users matching that roleId
    return await db.executeCount(clientName, 'GET_ALL_STUDENTS', {
        where: { roleId: studentRoleId, isDeleted: false }
    });
};

// 🌟 Get Recent 5
const getRecentStudents = async (clientName, limitCount) => {
    // 1. Dynamically find out what the ID is for "student"
    const students = await db.executeAggregate(clientName, 'getStudentsWithRoles', { limit: 10 });
    console.log(students)
    return students;
    // const studentRoleId = await getRoleIdByName(clientName, 'student');
    
    // if (!studentRoleId) return [];

    // // 2. Fetch users matching that roleId with a limit
    // return await db.executeSelect(clientName, 'GET_ALL_STUDENTS', {
    //     where: { roleId: studentRoleId, isDeleted: false },
    //     limit: limitCount
    // });
};
module.exports = { 
    findUserByEmail, 
    findUserByEmailFast,
    validateLogin, 
    updateUser, 
    createStudent,
    createUser,
    getAllStudents,
    getStudentCount,
    getRecentStudents
};