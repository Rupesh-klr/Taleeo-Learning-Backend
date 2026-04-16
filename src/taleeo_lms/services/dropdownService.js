const db = require('../../config/db');
const batchService = require('./batchService');
const courseService = require('./courseService');
const contentService = require('./contentService');

function parseCsvParam(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
    return String(value)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function normalizeItemName(item) {
    const value = String(item || 'courses').trim().toLowerCase();
    if (['course', 'courses'].includes(value)) return 'courses';
    if (['batch', 'batches'].includes(value)) return 'batches';
    if (['module', 'modules'].includes(value)) return 'modules';
    if (['document', 'documents'].includes(value)) return 'documents';
    if (['recording', 'recordings'].includes(value)) return 'recordings';
    if (['student', 'students'].includes(value)) return 'students';
    if (['user', 'users'].includes(value)) return 'users';
    return 'courses';
}

function simplifyCourse(course) {
    return {
        id: course.id || course._id,
        name: course.name || course.title || '',
        duration: course.duration || '',
        image: course.image || '',
        description: course.description || '',
        batches: Array.isArray(course.batches)
            ? course.batches
                .filter(batch => {
                    if (!batch) return false;
                    if (typeof batch !== 'object') return true;
                    return batch.isDeleted !== true;
                })
                .map(batch => {
                return {
                    id: batch.id || batch._id,
                    name: batch.name || ''
                };
            }).filter(Boolean)
            : [],
        modules: Array.isArray(course.modules)
            ? course.modules
                .filter(module => module && module.isDeleted !== true)
                .map(module => ({
                    id: module.id || module._id,
                    title: module.title || module.name || ''
                }))
            : [],
        createdAt: course.createdAt || null,
        isDeleted: Boolean(course.isDeleted)
    };
}

function simplifyBatch(batch) {
    return {
        id: batch.id || batch._id,
        name: batch.name || '',
        type: batch.type || '',
        courseId: batch.courseId || '',
        students: Array.isArray(batch.students) ? batch.students : [],
        studentDetails: Array.isArray(batch.studentDetails) ? batch.studentDetails : []
    };
}

function simplifyModule(module) {
    return {
        id: module.id || module._id,
        title: module.title || module.name || '',
        courseId: module.courseId || '',
        order: module.order || module.orderIndex || 0
    };
}

function simplifyDocument(document) {
    return {
        id: document.id || document._id,
        title: document.title || '',
        module: document.module || '',
        batch: document.batch || '',
        type: document.type || '',
        url: document.url || ''
    };
}

function simplifyRecording(recording) {
    return {
        id: recording.id || recording._id,
        title: recording.title || '',
        date: recording.date || '',
        duration: recording.duration || '',
        batch: recording.batch || '',
        courseId: recording.courseId || '',
        moduleId: recording.moduleId || '',
        url: recording.url || ''
    };
}

function simplifyUser(user) {
    return {
        id: user.id || user._id,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || '',
        roleId: user.roleId || '',
        enrolledBatches: Array.isArray(user.enrolledBatches) ? user.enrolledBatches : []
    };
}

async function getCourses(clientName, options = {}) {
    const courseIds = parseCsvParam(options.id || options.ids || options.courseId);
    if (courseIds.length > 0) {
        const courses = await courseService.getCoursesWithModulesByIds(clientName, courseIds);
        return courses.map(simplifyCourse);
    }

    const data = await courseService.getFullCurriculum(
        clientName,
        options.q || options.searchTerm || '',
        options.limit || 1000,
        options.offset || 0
    );

    return (data.courses || []).map(simplifyCourse);
}

async function getBatches(clientName, options = {}) {
    const courseId = String(options.courseId || '').trim();
    let batches = [];

    if (courseId) {
        // getBatchesByCourseId now filters isDeleted at DB level
        batches = await batchService.getBatchesByCourseId(clientName, courseId);
    } else {
        // getAllBatches now filters isDeleted at DB level
        batches = await batchService.getAllBatches(clientName);
    }

    // Treat `id` as batchId for this endpoint and keep `courseId` dedicated for course filtering.
    const batchIds = parseCsvParam(options.batchId || options.id || options.ids);
    if (batchIds.length > 0) {
        batches = batches.filter(batch => batchIds.includes(String(batch.id || batch._id || '')));
    }
    // batches = await batchService.attachStudentDetails(clientName, batches || []);
    // console.log('Batches with student details:', batches);
    return batches.map(simplifyBatch);
}

async function getModules(clientName, options = {}) {
    const courseId = String(options.courseId || '').trim();
    const moduleIds = parseCsvParam(options.id || options.ids || options.moduleId);

    // Build WHERE clause for database-level filtering to improve performance
    let where = { isDeleted: false };
    if (courseId) {
        where.courseId = courseId;
    }

    // Fetch only needed records from database (not all modules)
    const modules = await db.executeSelect(clientName, 'GET_ALL_MODULES', { where });

    let filtered = modules || [];
    // Only filter by ID list if provided (cannot be done in WHERE clause easily)
    if (moduleIds.length > 0) {
        filtered = filtered.filter(module => moduleIds.includes(String(module.id || module._id || '')));
    }

    return filtered.map(simplifyModule);
}

async function getDocuments(clientName, options = {}) {
    const documents = await contentService.getAllDocuments(clientName);
    const documentIds = parseCsvParam(options.id || options.ids || options.documentId);

    let filtered = documents || [];
    if (documentIds.length > 0) {
        filtered = filtered.filter(document => documentIds.includes(String(document.id || document._id || '')));
    }
    if (options.batchId) {
        filtered = filtered.filter(document => String(document.batch || '') === String(options.batchId));
    }
    if (options.courseId) {
        filtered = filtered.filter(document => String(document.courseId || '') === String(options.courseId));
    }
    if (options.moduleId) {
        filtered = filtered.filter(document => String(document.moduleId || '') === String(options.moduleId));
    }

    return filtered.map(simplifyDocument);
}

async function getRecordings(clientName, options = {}) {
    const recordings = await contentService.getAllRecordings(clientName);
    const recordingIds = parseCsvParam(options.id || options.ids || options.recordingId);

    let filtered = recordings || [];
    if (recordingIds.length > 0) {
        filtered = filtered.filter(recording => recordingIds.includes(String(recording.id || recording._id || '')));
    }
    if (options.batchId) {
        filtered = filtered.filter(recording => String(recording.batch || '') === String(options.batchId));
    }
    if (options.courseId) {
        filtered = filtered.filter(recording => String(recording.courseId || '') === String(options.courseId));
    }
    if (options.moduleId) {
        filtered = filtered.filter(recording => String(recording.moduleId || '') === String(options.moduleId));
    }

    return filtered.map(simplifyRecording);
}

async function getStudents(clientName, options = {}) {
    const students = await db.executeSelect(clientName, 'GET_ALL_STUDENTS', {
        where: { role: 'student', isDeleted: false }
    });
    const studentIds = parseCsvParam(options.id || options.ids || options.studentId);

    let filtered = students || [];
    if (studentIds.length > 0) {
        filtered = filtered.filter(student => studentIds.includes(String(student.id || student._id || '')));
    }

    return filtered.map(simplifyUser);
}

async function getUsers(clientName, options = {}) {
    const users = await db.executeSelect(clientName, 'GET_ALL_USERS', {
        where: { isDeleted: false }
    });
    const userIds = parseCsvParam(options.id || options.ids || options.userId);

    let filtered = users || [];
    if (options.role) {
        filtered = filtered.filter(user => String(user.role || '').toLowerCase() === String(options.role).toLowerCase());
    }
    if (userIds.length > 0) {
        filtered = filtered.filter(user => userIds.includes(String(user.id || user._id || '')));
    }

    return filtered.map(simplifyUser);
}

async function getDropdownData(clientName, item, options = {}) {
    const normalizedItem = normalizeItemName(item);

    let items = [];
    switch (normalizedItem) {
        case 'courses':
            items = await getCourses(clientName, options);
            break;
        case 'batches':
            items = await getBatches(clientName, options);
            break;
        case 'modules':
            items = await getModules(clientName, options);
            break;
        case 'documents':
            items = await getDocuments(clientName, options);
            break;
        case 'recordings':
            items = await getRecordings(clientName, options);
            break;
        case 'students':
            items = await getStudents(clientName, options);
            break;
        case 'users':
            items = await getUsers(clientName, options);
            break;
        default:
            items = [];
    }

    return {
        item: normalizedItem,
        totalRecords: items.length,
        items,
        selected: items.length === 1 ? items[0] : null
    };
}

module.exports = {
    getDropdownData,
    normalizeItemName
};