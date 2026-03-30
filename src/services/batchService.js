const { readData, writeData } = require('../config/db');

const getAllBatches = async () => {
    return readData('batches'); // Reads from data/batches.json
};

const createBatch = async (batchData) => {
    const batches = readData('batches');
    const newBatch = {
        id: 'b' + Date.now(),
        ...batchData,
        active: true,
        students: []
    };
    batches.push(newBatch);
    writeData('batches', batches); // Saves back to data/batches.json
    return newBatch;
};

module.exports = { getAllBatches, createBatch };