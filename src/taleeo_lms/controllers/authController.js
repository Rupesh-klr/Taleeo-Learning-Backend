const userService = require('../services/userService');
const jwt = require('jsonwebtoken'); 
require('dotenv').config();

// Helper function to generate both tokens cleanly
const generateTokens = (user) => {
    const payload = { 
        id: user.id, 
        roleId: user.roleId, 
        role: user.role, 
        email: user.email 
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'pleasedontmissingmyserver', { expiresIn: '15m' }); // Short life
    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET || 'refresh_secret', { expiresIn: '7d' }); // Long life

    return { accessToken, refreshToken };
};

// Helper function to set secure cookies
const setTokenCookies = (res, accessToken, refreshToken) => {
    const isProd = process.env.NODE_ENV === 'production';

    const cookieOptions = {
        httpOnly: true, 
        secure: isProd, // true in production (HTTPS), false in dev (HTTP)
        sameSite: 'lax', 
        path: '/', // 🌟 FIXED: Use '/' to cover all sub-paths/endpoints
        maxAge: 24 * 60 * 60 * 1000 
    };

    res.cookie('token', accessToken, cookieOptions);

    res.cookie('refreshToken', refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000 
    });
};
const resetPassword = async (req, res) => {
    try {
        const { newPass } = req.body;
        const userId = req.user.id; // Extracted from your auth middleware

        if (!newPass || newPass.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        const data = {
            filter: { id: userId },
            updateData: { 
                $set: { 
                    password: newPass,
                    firstLogin: true, // Mark that they've updated their default password
                    modifiedAt: Date.now()
                } 
            }
        };

        // clientName identifies which MongoDB cluster to use
        await db.executeWrite(req.clientName, 'users', data, 'updateOne');

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to reset password", error: error.message });
    }
};

const login = async (req, res) => {
    const { email, pass } = req.body;
    try {
        const user = await userService.validateLogin(req.clientName, email, pass);
        if (!user) return res.status(401).json({ message: "Invalid credentials" });
        console.log(user);
        
        const { accessToken, refreshToken } = generateTokens(user);
        setTokenCookies(res, accessToken, refreshToken);
        res.status(200).json({
            requiresOtp: user.role === 'student' && !user.firstLoginDone,
            user: { id: user.id, name: user.name, roleId: user.roleId, role: user.role, email: user.email }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
};

const guestLogin = async (req, res) => {
    if (process.env.ENABLE_GUEST_LOGIN !== 'true') {
        return res.status(404).json({ error: "Endpoint not found or disabled." });
    }

    try {
        const requestedRole = req.query.role || 'student';
        let roleIdToUse;
        if (requestedRole === 'admin') roleIdToUse = 'role_admin_123';
        else if (requestedRole === 'student') roleIdToUse = 'role_student_123';
        else roleIdToUse = `role_${requestedRole}_123`;

        const mockUser = {
            id: `ghost_${requestedRole}_${Date.now()}`,
            name: `Test ${requestedRole.charAt(0).toUpperCase() + requestedRole.slice(1)}`,
            email: `test_${requestedRole}@local.dev`,
            roleId: roleIdToUse,
            role: requestedRole
        };

        const { accessToken, refreshToken } = generateTokens(mockUser);
        setTokenCookies(res, accessToken, refreshToken);
        
        res.status(200).json({
            message: `Logged in safely as Local ${requestedRole}`,
            requiresOtp: false,
            user: mockUser 
        });
    } catch (error) {
        console.error("Guest Login Error:", error);
        res.status(500).json({ message: "Server Error during guest login" });
    }
};

// 🌟 NEW: The Refresh Endpoint
const refreshAccessToken = async (req, res) => {
    try {
        // 1. Grab the refresh token from the restricted cookie
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: "No refresh token provided." });
        }

        // 2. Verify the refresh token
        const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'refresh_secret';
        jwt.verify(refreshToken, refreshSecret, (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: "Invalid or expired refresh token. Please log in again." });
            }

            // 3. Token is valid! Issue a fresh 15-minute Access Token
            const payload = { 
                id: decoded.id, 
                roleId: decoded.roleId, 
                role: decoded.role, 
                email: decoded.email 
            };
            
            const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET || 'pleasedontmissingmyserver', { expiresIn: '15m' });

            // 4. Send the new Access Token back to the browser
            const isProd = process.env.NODE_ENV === 'production';
            res.cookie('token', newAccessToken, {
                httpOnly: true, 
                secure: false, 
                sameSite: 'lax', 
                path: '/', // 🌟 CRITICAL FIX: Forces the cookie to be available to EVERY endpoint on localhost
                maxAge: 15 * 60 * 1000 
            });

            res.status(200).json({ message: "Token refreshed successfully!" });
        });

    } catch (error) {
        console.error("Refresh Token Error:", error);
        res.status(500).json({ message: "Server Error during token refresh" });
    }
};

// const getCurrentUser = async (req, res) => {
//     try {
//         if (!req.user || !req.user.email) return res.status(401).json({ message: "Not authenticated properly" });

//         const freshUserData = await userService.validateLogin(req.clientName, req.user.email, null);
//         if (!freshUserData) return res.status(404).json({ message: "User no longer exists in database" });

//         delete freshUserData.password;
//         res.status(200).json({
//             message: "Token is valid!",
//             tokenPayload: req.user, 
//             databaseUser: freshUserData 
//         });
//     } catch (error) {
//         console.error("Get Current User Error:", error);
//         res.status(500).json({ message: "Server Error fetching user details" });
//     }
// };
const getCurrentUser = async (req, res) => {
    try {
        if (!req.user || !req.user.email) return res.status(401).json({ message: "Not authenticated properly" });

        // 🌟 THE FIX: Intercept Ghost Users before checking the database!
        if (req.user.id && req.user.id.startsWith('ghost_')) {
            return res.status(200).json({
                message: "Token is valid! (Local Ghost User)",
                tokenPayload: req.user,
                databaseUser: {
                    ...req.user, // The payload from the JWT
        ...(freshUserData || {}),// Overlay with DB data if exists
                    id: req.user.id,
                    name: `Test ${req.user.role}`,
                    email: req.user.email,
                    roleId: req.user.roleId,
                    role: req.user.role,
                    isGhost: true // A helpful flag for your frontend during testing
                }
            });
        }

        // --- NORMAL FLOW FOR REAL USERS ---
        // Fetch the freshest data from the database using the email in the token
        const freshUserData = await userService.validateLogin(req.clientName, req.user.email, null);
        
        if (!freshUserData) return res.status(404).json({ message: "User no longer exists in database" });

        delete freshUserData.password; // Never send passwords back
        res.status(200).json({
            message: "Token is valid!",
            tokenPayload: req.user, 
            databaseUser: freshUserData 
        });
    } catch (error) {
        console.error("Get Current User Error:", error);
        res.status(500).json({ message: "Server Error fetching user details" });
    }
};
const logout = async (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    const clearOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/'
    };

    // 🌟 Explicitly expire the cookies
    res.clearCookie('token', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    res.status(200).json({ message: "Logged out successfully" });
};

// Added refreshAccessToken to exports!
module.exports = { login, guestLogin, getCurrentUser, refreshAccessToken,logout , resetPassword};