// services/dbService.js

const getFullCurriculum = async (connectionName, args = {}) => {
    // Access your connection manager
    const conn = activeConnections[connectionName]; 
    const queryKey = "getCourseFullDetails";
    
    // Call your existing executeAggregate logic
    return await executeAggregate(connectionName, queryKey, args);
};

module.exports = { getFullCurriculum };