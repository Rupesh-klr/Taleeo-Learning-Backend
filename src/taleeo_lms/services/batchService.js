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
    // Filter out deleted batches at database level for performance
    return await db.executeSelect(clientName, 'GET_ACTIVE_BATCHES', { where: { isDeleted: false } });
};

const attachStudentDetails = async (clientName, batches = []) => {
    if (!Array.isArray(batches) || batches.length === 0) {
        return [];
    }

    const studentIds = [...new Set(
        batches
            .flatMap(batch => (Array.isArray(batch.students) ? batch.students : []))
            .map(id => String(id))
            .filter(Boolean)
    )];

    if (studentIds.length === 0) {
        return batches.map(batch => ({ ...batch, studentDetails: [] }));
    }

    const users = await db.executeSelect(clientName, 'GET_ALL_USERS', {
        where: { isDeleted: false, role: 'student' },
        limit: 10000
    });

    const userMap = new Map(
        (users || [])
            .filter(user => studentIds.includes(String(user.id || user._id || '')))
            .map(user => [
                String(user.id || user._id),
                {
                    id: user.id || user._id,
                    name: user.name || '',
                    email: user.email || '',
                    phone: user.phone || '',
                    role: user.role || '',
                    isDeleted: Boolean(user.isDeleted),
                    enrolledBatches: Array.isArray(user.enrolledBatches) ? user.enrolledBatches : []
                }
            ])
    );

    return batches.map(batch => {
        const batchStudentIds = Array.isArray(batch.students) ? batch.students : [];
        const studentDetails = batchStudentIds
            .map(id => userMap.get(String(id)))
            .filter(Boolean);

        return {
            ...batch,
            studentDetails
        };
    });
};

const getBatchesByCourseId = async (clientName, courseId) => {
    if (!courseId) return [];

    // Filter both courseId and isDeleted at database level for performance
    const batches = await db.executeSelect(clientName, 'GET_ACTIVE_BATCHES', {
        where: { courseId, isDeleted: false }
    });

    return await attachStudentDetails(clientName, batches || []);
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
    getBatchesByCourseId,
    getActiveBatchCount ,
    softDeleteBatch,
    attachStudentDetails
};