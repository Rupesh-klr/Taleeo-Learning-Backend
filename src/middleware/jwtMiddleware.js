const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
    try {
        let token = req.cookies && req.cookies.token;

        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ error: "Access Denied: No authentication token provided." });
        }

        const tokenSecret = process.env.JWT_SECRET || 'pleasedontmissingmyserver';
        const decoded = jwt.verify(token, tokenSecret);

        // 🌟 FATAL SECURITY SHIELD: Block Ghost Tokens in Production!
        // If the token belongs to a ghost, but the server is not in dev mode, kill the request instantly.
        if (decoded.id && decoded.id.startsWith('ghost_')) {
            if (process.env.ENABLE_GUEST_LOGIN !== 'true') {
                return res.status(403).json({ 
                    error: "SECURITY ALERT: Local Dev Ghost tokens are strictly forbidden in this environment." 
                });
            }
        }

        // Attach user to request
        req.user = decoded;
        next();

    } catch (error) {
        console.error("JWT Verification Error:", error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Session expired. Please log in again." });
        }
        return res.status(401).json({ error: "Invalid token." });
    }
};

module.exports = { verifyToken };
// const jwt = require('jsonwebtoken');
// require('dotenv').config();

// const verifyToken = (req, res, next) => {
//     try {
//         // 1. Look for the token in the cookies first
//         let token = req.cookies && req.cookies.token;

//         // 2. Fallback: If not in cookies, check the Authorization header (useful for Postman testing)
//         if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
//             token = req.headers.authorization.split(' ')[1];
//         }

//         // 3. If no token is found anywhere, reject the request immediately
//         if (!token) {
//             return res.status(401).json({ error: "Access Denied: No authentication token provided." });
//         }

//         // 4. Verify the token using your secret from .env
//         const tokenSecret = process.env.JWT_SECRET || 'pleasedontmissingmyserver';
//         const decoded = jwt.verify(token, tokenSecret);

//         // 5. Attach the decoded payload to req.user so the RBAC middleware can use it!
//         // (This will contain the user's id, email, and roleId that you signed during login)
//         req.user = decoded;

//         // 6. Token is valid! Move on to the next middleware (your RBAC check)
//         next();

//     } catch (error) {
//         console.error("JWT Verification Error:", error.message);
        
//         // Differentiate between expired tokens and completely invalid ones
//         if (error.name === 'TokenExpiredError') {
//             return res.status(401).json({ error: "Session expired. Please log in again." });
//         }
        
//         return res.status(401).json({ error: "Invalid token." });
//     }
// };

// module.exports = { verifyToken };