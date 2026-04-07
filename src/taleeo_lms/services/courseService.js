// services/courseService.js
const db = require('../../config/db'); // Path to your centralized db.js
// const { activeConnections } = require('../../config/db');


const getFullCurriculum = async (clientName,searchTerm, limit = 20, offset = 0) => {
    // Uses your common approach: calling the exported helper from db.js
    // 'primary' matches the connection name in your activeConnections pool
    return await db.getFullCurriculum(clientName, {
        searchTerm,
        limit: parseInt(limit),
        offset: parseInt(offset)
    });
};
const searchCoursesWithFilters = async (clientName, searchTerm, limit) => {
    console.log(searchTerm)
    return await db.searchCoursesWithFilters(clientName, searchTerm, limit);
};
const removeCourse = async (clientName, courseId) => {
    // 1. Define the filter and the update payload
    const data = {
        filter: { id: courseId },
        updateData: { $set: { isDeleted: true } }
    };

    // 2. Use standardized executeWrite for MongoDB (Type 1)
    return await db.executeWrite(
        clientName, 
        'courses', 
        data, 
        'updateOne'
    );
};
const createCourse = async (clientName,courseData) => {
        console.log(clientName+ "----"+". ***** ")
    return await db.executeWrite(clientName, 'courses', courseData, 'insertOne');
};

module.exports = {
    getFullCurriculum,
    createCourse,searchCoursesWithFilters,
    removeCourse
};