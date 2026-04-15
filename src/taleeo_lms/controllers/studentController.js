const batchService = require('../services/batchService');
const contentService = require('../services/contentService');
const userService = require('../services/userService');
const attendanceService = require('../services/attendanceService');
const courseService = require('../services/courseService');
const studentService = require('../services/studentService');
const db = require('../../config/db');

const { getUserDetails } = require('../../middleware/jwtMiddleware');

function readBooleanEnv(name, defaultValue = false) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        return defaultValue;
    }
    return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

// Cache is OFF by default. Enable explicitly via env when needed.
const TLMS_ENABLE_STUDENT_DATA_CACHE = readBooleanEnv('TLMS_ENABLE_STUDENT_DATA_CACHE', false);

// In-memory student cache (per server instance)
const STUDENT_CACHE_LIMIT = 150;
const STUDENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const studentCache = new Map();

// In-memory dashboard cache for batches/courses/modules
const DASHBOARD_CACHE_LIMIT = 300;
const DASHBOARD_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const dashboardCache = new Map();

function studentCacheKey(clientName, email) {
    return `${clientName}::${String(email || '').toLowerCase()}`;
}

function pruneStudentCache() {
    if (!TLMS_ENABLE_STUDENT_DATA_CACHE) return;
    const now = Date.now();

    // 1) Remove expired entries by timestamp
    for (const [key, entry] of studentCache.entries()) {
        if (!entry || now - entry.cachedAt > STUDENT_CACHE_TTL_MS) {
            studentCache.delete(key);
        }
    }

    // 2) Enforce max size with LRU eviction (oldest lastAccessAt removed first)
    if (studentCache.size <= STUDENT_CACHE_LIMIT) return;

    const entries = [...studentCache.entries()].sort((a, b) => a[1].lastAccessAt - b[1].lastAccessAt);
    const overflow = studentCache.size - STUDENT_CACHE_LIMIT;
    for (let i = 0; i < overflow; i++) {
        studentCache.delete(entries[i][0]);
    }
}

function dashboardCacheKey(clientName, kind, ids = []) {
    const normalizedIds = [...new Set((ids || []).filter(Boolean))].sort();
    return `${clientName}::${kind}::${normalizedIds.join(',')}`;
}

function pruneDashboardCache() {
    if (!TLMS_ENABLE_STUDENT_DATA_CACHE) return;
    const now = Date.now();

    for (const [key, entry] of dashboardCache.entries()) {
        if (!entry || now - entry.cachedAt > DASHBOARD_CACHE_TTL_MS) {
            dashboardCache.delete(key);
        }
    }

    if (dashboardCache.size <= DASHBOARD_CACHE_LIMIT) return;

    const entries = [...dashboardCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const overflow = dashboardCache.size - DASHBOARD_CACHE_LIMIT;
    for (let i = 0; i < overflow; i++) {
        dashboardCache.delete(entries[i][0]);
    }
}

function getDashboardCache(key) {
    if (!TLMS_ENABLE_STUDENT_DATA_CACHE) return null;
    const entry = dashboardCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.cachedAt > DASHBOARD_CACHE_TTL_MS) {
        dashboardCache.delete(key);
        return null;
    }

    return entry.value;
}

function setDashboardCache(key, value) {
    if (!TLMS_ENABLE_STUDENT_DATA_CACHE) return;
    dashboardCache.set(key, {
        value,
        cachedAt: Date.now()
    });
    pruneDashboardCache();
}

function parseCsvParam(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
    return String(value)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function uniqueStrings(values) {
    return [...new Set((values || []).map(String).map(v => v.trim()).filter(Boolean))];
}

async function getStudentAssignmentContext(req, res) {
    const client = req.clientName;
    const student = await getCurrentStudent(req);
    const enrolledBatchIds = uniqueStrings(Array.isArray(student?.enrolledBatches) ? student.enrolledBatches : []);

    const batches = await batchService.getActiveBatchesBylist(client, enrolledBatchIds);
    const courseIds = uniqueStrings((batches || []).map(batch => batch && batch.courseId).filter(Boolean));
    const coursesWithModules = await courseService.getCoursesWithModulesByIds(client, courseIds);

    const modules = (coursesWithModules || []).flatMap((course) => {
        const courseModules = Array.isArray(course?.modules) ? course.modules : [];
        return courseModules.map((module) => ({
            id: module?.id || module?._id,
            title: module?.title || module?.name || ''
        }));
    });

    const moduleIds = uniqueStrings(modules.map(module => module.id).filter(Boolean));
    const moduleTitles = uniqueStrings(modules.map(module => module.title).filter(Boolean));

    return {
        student,
        enrolledBatchIds,
        courseIds,
        moduleIds,
        moduleTitles
    };
}

const getCurrentStudent = async (req) => {
    try {
        const user = await getUserDetails(req); // 🌟 Get user details from token
        if (!user || !user.email) {
            return null;
        }

        const key = studentCacheKey(req.clientName, user.email);
        const now = Date.now();
        const cached = TLMS_ENABLE_STUDENT_DATA_CACHE ? studentCache.get(key) : null;

        if (cached && now - cached.cachedAt <= STUDENT_CACHE_TTL_MS) {
            cached.lastAccessAt = now;
            studentCache.set(key, cached);
            return cached.student;
        }

        console.log("Authenticated Student Details:", user); // 🌟 Debug: Check authenticated user info
        const student = await userService.findUserByEmail(req.clientName, user.email);
        console.log("Fetched Student Profile:", student); // 🌟 Debug: Check fetched student profile

        if (student && TLMS_ENABLE_STUDENT_DATA_CACHE) {
            studentCache.set(key, {
                student,
                cachedAt: now,
                lastAccessAt: now
            });
            pruneStudentCache();
        } else if (TLMS_ENABLE_STUDENT_DATA_CACHE) {
            // User not found: remove any stale cache record for this email.
            studentCache.delete(key);
        }

        // res.status(200).json(student);
        return student;
    } catch (error) {
        console.error("Error fetching current student:", error);
        throw error;
    }
};

const getStudentDashboardSummary = async (req, res, next) => {
    try {
        const client = req.clientName;
        const user = await getCurrentStudent(req); // 🌟 Get user details from token
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized student session.' });
        }
        const enrolledBatchIds = Array.isArray(user?.enrolledBatches) ? user.enrolledBatches : [];
        const enrolledBatchCacheKey = dashboardCacheKey(client, 'enrolled-batches', enrolledBatchIds);
        
        // console.log(Object.keys(req.cookies)); // 🌟 Debug: Check authenticated user info

        // 🌟 HIGH PERFORMANCE: Fetching existing DB data concurrently
        const [
            attendanceCount,   // totalStudents
            classesCount,      // activeBatchesCount
            totalDocs, 
            totalRecs, 
            enrolledBatchesRaw,
            recentRecsRaw
        ] = await Promise.all([
            userService.getStudentCount(client),
            batchService.getActiveBatchCount(client),
            contentService.getDocsCount(client),
            contentService.getRecsCount(client),
            (async () => {
                const cachedBatches = getDashboardCache(enrolledBatchCacheKey);
                if (cachedBatches) return cachedBatches;

                const batches = await batchService.getActiveBatchesBylist(client, enrolledBatchIds);
                setDashboardCache(enrolledBatchCacheKey, batches);
                return batches;
            })(),
            contentService.getRecentRecordings(client, 2) // Assuming you have this service
        ]);

        // 🌟 STATIC DATA (To be moved to DB later)
        const activeUser = {
            name: user?.name || "Rupesh Kumar",
            email: user?.email || "rupesh@taleeo.local",
            role: user?.role || "Instructor",
            roleId: user?.roleId || "Instructor",
            avatar: (typeof user?.avatar === 'string' && user.avatar.length > 5)
                ? user.avatar
                : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'Rupesh'}`
        };

        const quickActions = [{ label: "Send Announcement", icon: "->", route: "/request#" }
        ];

        // 🌟 FORMATTING DATA to match your JSON Model
        const batches = enrolledBatchesRaw.map(b => ({
            batchId: b.id || b._id,
            title: b.name,
            timing: b.timing,
            days: b.days || "Mon-Fri", // Fallback if not in DB
            type: b.type || "Live Session",
            zoomConfig: {
                meetingId: b.zoomId || "N/A",
                passcode: b.zoomPass || "N/A",
                link: b.zoomLink || "#"
            },
            studentCount: b.studentCount || 0,
            status: b.status || "Active"
        }));

        console.log(user);
        console.log(enrolledBatchesRaw);
        let courseIds = enrolledBatchesRaw.map(b => b.courseId).filter(Boolean);
        console.log(courseIds);

        const coursesCacheKey = dashboardCacheKey(client, 'courses-with-modules', courseIds);
        let coursesWithModules = getDashboardCache(coursesCacheKey);

        if (!coursesWithModules) {
            coursesWithModules = await courseService.getCoursesWithModulesByIds(client, courseIds);
            setDashboardCache(coursesCacheKey, coursesWithModules);
        }

        console.log("Courses with Modules:", coursesWithModules[0]?.modules || []);
        const modules = coursesWithModules.flatMap(course => {
            const courseModules = Array.isArray(course.modules) ? course.modules : [];
            return courseModules.map((module, index) => ({
                id: module.id || module._id || `${course.id || course.courseId}_module_${index + 1}`,
                title: module.title || module.name || `${course.name || 'Course'} Module ${index + 1}`,
                courseId: course.id || course._id,
                courseTitle: course.name || course.title || '',
                order: module.order || index + 1,
                description: module.description || '',
                topics: Array.isArray(module.topics) ? module.topics : [],
                bonus: Array.isArray(module.bonus) ? module.bonus : (Array.isArray(module.outcomes) ? module.outcomes : [])
            }));
        }).sort((a, b) => {
            const byCourse = String(a.courseTitle || '').localeCompare(String(b.courseTitle || ''));
            if (byCourse !== 0) return byCourse;
            return (a.order || 0) - (b.order || 0);
        });
        console.log(modules);

        const recentRecordings = [{},{}].map(r => ({
            id: r.id || r._id,
            title: r.title,
            date: r.createdAt || "Recent",
            duration: r.duration || "00:00",
            thumbnail: r.thumbnail || "/assets/recs/default.png",
            url: r.url || "#"
        }));

        // 🌟 FINAL RESPONSE MAPPING
        const responseBody = {
            stats: {
                studentsAttendance: attendanceCount,
                classesAttended: classesCount,
                recordingsAvailable: totalRecs,
                documentsShared: totalDocs
            },
            activeUser,
            modules,
            batches,
            recentRecordings,
            quickActions,
            recentRecsRaw
        };

        return res.status(200).json(responseBody);

    } catch (error) {
        console.error("Dashboard Summary Error:", error);
        if (res.headersSent) {
            return next(error);
        }
        return res.status(500).json({
            message: 'Error fetching dashboard summary',
            error: error.message
        });
    }
};

const getStudents = async (req, res, next) => {
    try {
        const students = await userService.getAllStudents(req.clientName); // 🌟
        return res.status(200).json(students);
    } catch (error) {
        if (res.headersSent) {
            return next(error);
        }
        return res.status(500).json({ message: 'Error fetching students' });
    }
};

const getStudentRecordings = async (req, res, next) => {
    try {
        const queryBatchIds = parseCsvParam(req.query.batchId);
        const queryCourseIds = parseCsvParam(req.query.courseId);
        const queryModuleIds = parseCsvParam(req.query.moduleId);

        const assignment = await getStudentAssignmentContext(req, res);
        if (!assignment) {
            return res.status(401).json({ message: 'Unauthorized student session.' });
        }

        const allowedBatchIds = queryBatchIds.length > 0 ? queryBatchIds : assignment.enrolledBatchIds;
        const allowedCourseIds = queryCourseIds.length > 0 ? queryCourseIds : assignment.courseIds;
        const allowedModuleIds = queryModuleIds.length > 0 ? queryModuleIds : assignment.moduleIds;

        const recordings = await contentService.getAllRecordings(req.clientName);

        let filtered = (recordings || []).filter((rec) => {
            const byBatch = rec?.batch === 'all' || allowedBatchIds.length === 0 || allowedBatchIds.includes(String(rec?.batch || ''));
            const byCourse = !rec?.courseId || allowedCourseIds.length === 0 || allowedCourseIds.includes(String(rec.courseId));
            const byModule = !rec?.moduleId || allowedModuleIds.length === 0 || allowedModuleIds.includes(String(rec.moduleId));
            return byBatch && byCourse && byModule;
        });

        let isDummy = false;
        if (filtered.length === 0) {
            isDummy = true;
            console.log('[DUMMY] student recordings payload coming soon.');
            console.log('[DUMMY] recordings assignment context:', {
                studentId: assignment?.student?.id,
                allowedBatchIds,
                allowedCourseIds,
                allowedModuleIds
            });

            filtered = [{
                id: 'dummy-recording-1',
                title: 'Recordings coming soon',
                date: new Date().toISOString().split('T')[0],
                duration: '00:00',
                url: '#',
                batch: allowedBatchIds[0] || 'all',
                topics: 'Dummy payload for frontend integration'
            }];
        }

        return res.status(200).json({
            items: filtered,
            isDummy,
            context: {
                batchIds: allowedBatchIds,
                courseIds: allowedCourseIds,
                moduleIds: allowedModuleIds
            }
        });
    } catch (error) {
        console.error('Student recordings error:', error);
        if (res.headersSent) {
            return next(error);
        }
        return res.status(500).json({ message: 'Error fetching student recordings', error: error.message });
    }
};

const getStudentDocuments = async (req, res, next) => {
    try {
        const queryBatchIds = parseCsvParam(req.query.batchId);
        const queryCourseIds = parseCsvParam(req.query.courseId);
        const queryModuleIds = parseCsvParam(req.query.moduleId);

        const assignment = await getStudentAssignmentContext(req, res);
        if (!assignment) {
            return res.status(401).json({ message: 'Unauthorized student session.' });
        }

        const allowedBatchIds = queryBatchIds.length > 0 ? queryBatchIds : assignment.enrolledBatchIds;
        const allowedCourseIds = queryCourseIds.length > 0 ? queryCourseIds : assignment.courseIds;
        const allowedModuleIds = queryModuleIds.length > 0 ? queryModuleIds : assignment.moduleIds;

        const documents = await contentService.getAllDocuments(req.clientName);

        let filtered = (documents || []).filter((doc) => {
            const byBatch = doc?.batch === 'all' || allowedBatchIds.length === 0 || allowedBatchIds.includes(String(doc?.batch || ''));
            const byCourse = !doc?.courseId || allowedCourseIds.length === 0 || allowedCourseIds.includes(String(doc.courseId));
            const byModule = !doc?.moduleId || allowedModuleIds.length === 0 || allowedModuleIds.includes(String(doc.moduleId));
            return byBatch && byCourse && byModule;
        });

        let isDummy = false;
        if (filtered.length === 0) {
            isDummy = true;
            console.log('[DUMMY] student documents payload coming soon.');
            console.log('[DUMMY] documents assignment context:', {
                studentId: assignment?.student?.id,
                allowedBatchIds,
                allowedCourseIds,
                allowedModuleIds,
                moduleTitles: assignment?.moduleTitles || []
            });

            filtered = [{
                id: 'dummy-document-1',
                title: 'Notes & Documents coming soon',
                module: assignment?.moduleTitles?.[0] || 'General',
                batch: allowedBatchIds[0] || 'all',
                url: '#',
                type: 'reference',
                uploadedAt: new Date().toISOString().split('T')[0]
            }];
        }

        return res.status(200).json({
            items: filtered,
            isDummy,
            context: {
                batchIds: allowedBatchIds,
                courseIds: allowedCourseIds,
                moduleIds: allowedModuleIds,
                moduleTitles: assignment?.moduleTitles || []
            }
        });
    } catch (error) {
        console.error('Student documents error:', error);
        if (res.headersSent) {
            return next(error);
        }
        return res.status(500).json({ message: 'Error fetching student documents', error: error.message });
    }
};


module.exports = { 
    getStudents,
    getStudentDashboardSummary,
    getStudentRecordings,
    getStudentDocuments,
};