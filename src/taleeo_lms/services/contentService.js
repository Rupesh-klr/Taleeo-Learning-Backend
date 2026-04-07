const db = require('../../config/db');
const { validateSchema } = require('../models/schemaValidator');

// ---------------- Handle Documents ----------------
const getAllDocuments = async (clientName) => {
    return await db.executeSelect(clientName, 'GET_ALL_DOCUMENTS');
};

const getDocsCount = async (clientName) => {
    return await db.executeCount(clientName, 'GET_ALL_DOCUMENTS');
};

const uploadDocument = async (clientName, docData) => {
    const newDoc = {
        id: 'd' + Date.now(),
        ...docData,
        uploadedAt: new Date().toISOString().split('T')[0]
    };

    // Strict Schema Validation
    validateSchema('content', newDoc);
    
    // Save to database
    await db.executeWrite(clientName, 'documents', newDoc);
    return newDoc;
};

// ---------------- Handle Recordings ----------------
const getAllRecordings = async (clientName) => {
    return await db.executeSelect(clientName, 'GET_ALL_RECORDINGS');
};

const getRecsCount = async (clientName) => {
    return await db.executeCount(clientName, 'GET_ALL_RECORDINGS');
};

const addRecording = async (clientName, recData) => {
    const newRec = {
        id: 'r' + Date.now(),
        ...recData
    };

    // Strict Schema Validation
    validateSchema('recordings', newRec);
    
    // Save to database
    await db.executeWrite(clientName, 'recordings', newRec);
    return newRec;
};

module.exports = { 
    getAllDocuments, 
    uploadDocument, 
    getDocsCount,
    getAllRecordings, 
    addRecording,
    getRecsCount
};