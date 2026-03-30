const { readData, writeData } = require('../config/db');

/**
 * Finds a user in the JSON file by email
 */
const findUserByEmail = async (email) => {
    const users = readData('users');
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
};

/**
 * Validates login and returns the user object if successful
 */
const validateLogin = async (email, password) => {
    const user = await findUserByEmail(email);
    
    if (user && user.password === password) {
        return user;
    }
    return null;
};

/**
 * Updates a specific user (e.g., setting firstLogin to true)
 */
const updateUser = async (userId, updateData) => {
    const users = readData('users');
    const index = users.findIndex(u => u.id === userId);
    
    if (index !== -1) {
        // Merge existing user data with updates
        users[index] = { ...users[index], ...updateData };
        writeData('users', users);
        return users[index];
    }
    return null;
};

/**
 * Adds a new student to users.json
 */
const createStudent = async (userData) => {
    const users = readData('users');
    
    // Check if email already exists
    if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        throw new Error('User already exists');
    }

    const newUser = {
        id: 's' + Date.now(),
        ...userData,
        role: 'student',
        firstLogin: false,
        avatar: userData.name[0].toUpperCase()
    };

    users.push(newUser);
    writeData('users', users);
    return newUser;
};
const createUser = async (userData) => {
    const users = readData();

    // 1. Check if a user with this email already exists
    if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        throw new Error('Email already exists');
    }

    // 2. Format the new user
    const prefix = userData.role === 'admin' ? 'a' : 's';
    const newUser = {
        id: prefix + Date.now(), // e.g., 's1711928391' or 'a1711928391'
        name: userData.name,
        email: userData.email.toLowerCase(),
        password: userData.password,
        role: userData.role,
        phone: userData.phone || '',
        firstLogin: false,
        avatar: userData.name ? userData.name[0].toUpperCase() : 'U',
        batchId: userData.batchId || null
    };

    // 3. Save to file
    users.push(newUser);
    writeData(users);
    
    return newUser;
};
const getAllStudents = async () => {
    const users = readData('users');
    // Filter out admins to return only students
    return users.filter(u => u.role === 'student');
};

module.exports = { 
    findUserByEmail, 
    validateLogin, 
    updateUser, 
    createStudent ,
    createUser,
    getAllStudents
};