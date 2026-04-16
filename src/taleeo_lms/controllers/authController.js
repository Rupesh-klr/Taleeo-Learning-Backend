const userService = require('../services/userService');
const jwt = require('jsonwebtoken'); 
const db = require('../../config/db');
require('dotenv').config();

const ME_CACHE_TTL_MS = 60 * 1000; // 1 minute
const ME_CACHE_LIMIT = 500;
const meCache = new Map();

const meCacheKey = (clientName, email) => `${clientName}::${String(email || '').toLowerCase()}`;

const getCachedMe = (key) => {
    const entry = meCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ME_CACHE_TTL_MS) {
        meCache.delete(key);
        return null;
    }
    return entry.user;
};

const setCachedMe = (key, user) => {
    meCache.set(key, { user, cachedAt: Date.now() });
    if (meCache.size > ME_CACHE_LIMIT) {
        const oldestKey = meCache.keys().next().value;
        if (oldestKey) meCache.delete(oldestKey);
    }
};

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
        sameSite: isProd ? 'none' : 'lax',
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
        const { oldPass, newPass } = req.body;

        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Not authenticated properly' });
        }

        const userId = req.user.id;
        const userEmail = req.user.email;

        if (!oldPass || String(oldPass).trim().length === 0) {
            return res.status(400).json({ message: 'Old password is required.' });
        }

        if (!newPass || newPass.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        const existingUser = await userService.findUserByEmail(req.clientName, userEmail);
        if (!existingUser) {
            return res.status(404).json({ message: 'User no longer exists in database' });
        }

        if (existingUser.password !== oldPass) {
            return res.status(400).json({ message: 'Old password is incorrect.' });
        }

        if (oldPass === newPass) {
            return res.status(400).json({ message: 'New password must be different from old password.' });
        }

        const data = {
            filter: { id: userId },
            updateData: { 
                $set: { 
                    password: newPass,
                    firstLogin: true,
                    firstLoginDone: true,
                    modifiedAt: Date.now()
                } 
            }
        };

        // clientName identifies which MongoDB cluster to use
        await db.executeWrite(req.clientName, 'users', data, 'updateOne');

        // Invalidate /auth/me cache entry for this user so fresh profile is loaded next call.
        meCache.delete(meCacheKey(req.clientName, userEmail));

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to reset password", error: error.message });
    }
};

const login = async (req, res) => {
    const { email, pass } = req.body;
    try {
        const user = await userService.validateLogin(req.clientName, email, pass);
        if (!user) return res.status(401).json({ message: "Incorrect email or Incorrect Password" });
        console.log(user);
        
        const { accessToken, refreshToken } = generateTokens(user);
        setTokenCookies(res, accessToken, refreshToken);
        res.status(200).json({
            // requiresOtp: user.role === 'student' && !user.firstLoginDone,
            requiresOtp: false,
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

            // 3. Token is valid! Rotate BOTH tokens so browser always has fresh cookies.
            const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded);
            setTokenCookies(res, accessToken, newRefreshToken);

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
        const cacheKey = meCacheKey(req.clientName, req.user.email);
        const cachedUser = getCachedMe(cacheKey);

        if (cachedUser) {
            return res.status(200).json({
                message: "Token is valid!",
                tokenPayload: req.user,
                databaseUser: cachedUser
            });
        }

        // Fast profile lookup by email (single query); role comes from token payload.
        const freshUserData = await userService.findUserByEmailFast(req.clientName, req.user.email);
        
        if (!freshUserData) return res.status(404).json({ message: "User no longer exists in database" });

        if (!freshUserData.role && req.user.role) {
            freshUserData.role = req.user.role;
        }

        delete freshUserData.password; // Never send passwords back
        setCachedMe(cacheKey, freshUserData);

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
        sameSite: isProd ? 'none' : 'lax',
        path: '/'
    };

    // 🌟 Explicitly expire the cookies
    res.clearCookie('token', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    res.status(200).json({ message: "Logged out successfully" });
};

// Added refreshAccessToken to exports!
module.exports = { login, guestLogin, getCurrentUser, refreshAccessToken,logout , resetPassword};