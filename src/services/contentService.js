const { readData, writeData } = require('../config/db');

// Handle Documents
const getAllDocuments = async () => {
    return readData('documents');
};

const uploadDocument = async (docData) => {
    const docs = readData('documents');
    const newDoc = {
        id: 'd' + Date.now(),
        ...docData,
        uploadedAt: new Date().toISOString().split('T')[0]
    };
    docs.push(newDoc);
    writeData('documents', docs);
    return newDoc;
};

// Handle Recordings
const getAllRecordings = async () => {
    return readData('recordings');
};

const addRecording = async (recData) => {
    const recs = readData('recordings');
    const newRec = {
        id: 'r' + Date.now(),
        ...recData
    };
    recs.push(newRec);
    writeData('recordings', recs);
    return newRec;
};

module.exports = { getAllDocuments, uploadDocument, getAllRecordings, addRecording };