/**
 * A lightweight, high-performance Schema Validator.
 * Protects raw MongoDB/SQL databases from malformed data.
 */
const validateSchema = (schemaName, data) => {
    const schemas = {
        
        roles: {
            required: ['name', 'permissions'],
            validate: (d) => {
                if (!Array.isArray(d.permissions)) throw new Error("Permissions must be an array");
            }
        },

        users: {
            required: ['name', 'email', 'password', 'role'],
            validate: (d) => {
                if (typeof d.email !== 'string' || !d.email.includes('@')) throw new Error("Invalid email format");
                // Allows dynamic roles if you add more later, but ensures it's a string
                if (typeof d.role !== 'string') throw new Error("Role must be a valid string");
            }
        },

        courses: {
            required: ['title', 'status'],
            validate: (d) => {
                if (!['active', 'draft', 'archived'].includes(d.status)) throw new Error("Course status must be active, draft, or archived");
                if (d.price && typeof d.price !== 'number') throw new Error("Price must be a number");
            }
        },

        batches: {
            required: ['courseId', 'name', 'type', 'start', 'end'],
            validate: (d) => {
                if (!['weekend', 'weekday'].includes(d.type)) throw new Error("Batch type must be weekend or weekday");
                // Ensure dates are actually parseable dates
                if (isNaN(Date.parse(d.start)) || isNaN(Date.parse(d.end))) throw new Error("Start and End must be valid date strings");
            }
        },

        attendance: {
            required: ['studentId', 'batchId', 'date', 'status'],
            validate: (d) => {
                if (!['present', 'absent', 'late'].includes(d.status)) throw new Error("Attendance status must be present, absent, or late");
                if (isNaN(Date.parse(d.date))) throw new Error("Attendance date must be a valid date string");
            }
        },

        modules: {
            required: ['courseId', 'title', 'orderIndex'],
            validate: (d) => {
                if (typeof d.orderIndex !== 'number') throw new Error("Order index must be a number to sort modules correctly");
            }
        },

        content: {
            // Content can be PDFs, assignments, or text inside a module
            required: ['moduleId', 'title', 'type', 'url'],
            validate: (d) => {
                if (!['pdf', 'video', 'link', 'text'].includes(d.type)) throw new Error("Content type must be pdf, video, link, or text");
            }
        },

        recordings: {
            // Daily class recordings tied to a specific batch
            required: ['batchId', 'title', 'url', 'date'],
            validate: (d) => {
                if (isNaN(Date.parse(d.date))) throw new Error("Recording date must be a valid date string");
            }
        }
    };

    const targetSchema = schemas[schemaName];
    if (!targetSchema) {
        throw new Error(`CRITICAL: Schema '${schemaName}' does not exist in our validator!`);
    }

    // 1. Check for missing required fields
    targetSchema.required.forEach(field => {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            throw new Error(`DATABASE MISMATCH: Missing required field '${field}' in '${schemaName}' model.`);
        }
    });

    // 2. Run custom type checks
    targetSchema.validate(data);

    return true; // Passed validation!
};
// Helper to automatically attach base audit columns
const attachBaseFields = (data, isUpdate = false, userId = 'system') => {
    const now = Date.now();
    
    if (isUpdate) {
        return {
            ...data,
            modifiedBy: userId,
            modifiedAt: now
        };
    } else {
        return {
            id: data.id || `uuid_${now}_${Math.floor(Math.random() * 1000)}`, // Auto UUID
            ...data,
            isDeleted: false,
            createdBy: userId,
            createdAt: now,
            modifiedBy: userId,
            modifiedAt: now
        };
    }
};

module.exports = { validateSchema, attachBaseFields };