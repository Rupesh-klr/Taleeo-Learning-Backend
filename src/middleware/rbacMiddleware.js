const db = require('../config/db');
// 🌟 NEW: A clean, standardized logging function for tracking requests
const logTrace = (action, details) => {
    const timestamp = new Date().toISOString();
    console.log(`[INFO] [${timestamp}] [RBAC_TRACE] ${action} |`, JSON.stringify(details));
};
const requirePermission = async (req, res, next) => {
    try {
        const clientName = req.clientName;
        // Assume req.user is set by your JWT authentication middleware
        const userRoleId = req.user.roleId; 
        const requestedMethod = req.method; // e.g., 'GET', 'POST'
        // const requestedPath = req.path; // e.g., '/batches'
        // 🌟 CRITICAL FIX: Use req.baseUrl + req.path to get the FULL path (e.g., /admin/batches)
        // If you only use req.path, Express might only see '/batches'
        const requestedPath = req.baseUrl + req.path;
        // 1. LOG THE INCOMING REQUEST
        // 1. LOG THE INCOMING REQUEST
        logTrace('REQUEST_INITIATED', { 
            userEmail: req.user.email, 
            roleId: userRoleId, 
            method: requestedMethod, 
            path: requestedPath 
        });

        // 🌟 Make sure NOTHING tries to use the word "permissions" above this line! 

        // 2. Fetch permissions from the database
        const permissions = await db.executeSelect(clientName, 'GET_ROLE_PERMISSIONS', {
            where: { roleId: userRoleId, isDeleted: false }
        });

        // 3. LOG WHAT THE DATABASE FOUND (This MUST come AFTER the database call)
        logTrace('DB_PERMISSIONS_FOUND', { 
            count: permissions.length, 
            rules: permissions.map(p => ({ endpoint: p.endpoint, methods: p.methods })) 
        });
        // 4. Evaluate access
        const hasAccess = permissions.find(perm => {
            // Check if endpoint matches EXACTLY, is a wildcard '/*', or if the path starts with the allowed endpoint
            const pathMatches = perm.endpoint === '/*' || requestedPath.startsWith(perm.endpoint) || requestedPath.includes(perm.endpoint);
            const methodMatches = perm.methods.includes(requestedMethod) || perm.methods.includes('*');
            
            return pathMatches && methodMatches;
        });

        // 5. LOG THE RESULT AND BLOCK/ALLOW
        if (!hasAccess) {
            console.warn(`[WARN] 🛑 ACCESS DENIED for ${req.user.email} attempting ${requestedMethod} on ${requestedPath}`);
            return res.status(403).json({ error: "Access Denied: You do not have permission to perform this action." });
        }

        logTrace('ACCESS_GRANTED', { 
            matchedRule: hasAccess.endpoint,
            maxLimit: hasAccess.maxLimit
        });

        // 6. Enforce dynamic query limits
        if (req.query.limit) {
            if (req.query.limit > hasAccess.maxLimit) {
                req.query.limit = hasAccess.maxLimit; 
            }
        } else {
            req.query.limit = hasAccess.maxLimit; 
        }

        next(); // Proceed to the controller!

        // next(); // User is allowed! Proceed to the controller.

    } catch (error) {
        console.error("RBAC Middleware Error:", error);
        res.status(500).json({ error: "Internal Server Error during authorization." });
    }
};

module.exports = { requirePermission };