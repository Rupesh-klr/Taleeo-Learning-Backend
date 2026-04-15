const db = require('../../config/db');
const { validateSchema } = require('../models/schemaValidator');

const getActiveBatchCount = async (clientName) => {
    return await db.executeCount(clientName, 'GET_ACTIVE_BATCHES');
};

const getActiveBatches = async (clientName) => {
    return await db.executeSelect(clientName, 'GET_ACTIVE_BATCHES');
};

const getActiveBatchesBylist = async (clientName, enrolledBatchIds = []) => {
    if (!Array.isArray(enrolledBatchIds) || enrolledBatchIds.length === 0) {
        return [];
    }

    const uniqueIds = [...new Set(enrolledBatchIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
        return [];
    }

    return await db.executeSelect(clientName, 'GET_BATCHES_BY_IDS', {
        where: {
            id: { $in: uniqueIds },
            isDeleted: { $ne: true }
        },
        limit: uniqueIds.length
    });
};
const softDeleteBatch = async (clientName, batchId) => {
    const data = {
        filter: { id: batchId },
        updateData: { $set: { isDeleted: true } } // 🌟 Only toggle flag
    };
    return await db.executeWrite(clientName, 'batches', data, 'updateOne');
};

const getAllBatches = async (clientName) => {
    // Passing an empty where clause {} fetches ALL batches, overriding the default
    return await db.executeSelect(clientName, 'GET_ACTIVE_BATCHES', { where: {} });
};

const createBatch = async (clientName, batchData) => {
    const newBatch = {
        id: 'b' + Date.now(),
        ...batchData,
        active: true,
        students: []
    };

    // 1. Strict Schema Check
    validateSchema('batches', newBatch);

    // 2. Save to database
    await db.executeWrite(clientName, 'batches', newBatch);
    return newBatch;
};

module.exports = { 
    getAllBatches, 
    createBatch, 
    getActiveBatches, 
    getActiveBatchesBylist,
    getActiveBatchCount ,
    softDeleteBatch
};