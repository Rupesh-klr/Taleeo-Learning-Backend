const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { requirePermission } = require('../middleware/rbacMiddleware');
// Assume you have a jwt middleware that validates the token and sets req.user
const { verifyToken } = require('../middleware/jwtMiddleware');

const app = express();

// Middleware
// 1. Exact matches for stable local URLs
const exactOrigins = [
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

// 2. Regex for localhost/127 with any local dev port (Vite, Live Server, etc.)
const localOriginRegexes = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^https:\/\/localhost:\d+$/,
    /^https:\/\/127\.0\.0\.1:\d+$/
];

app.use(cookieParser());

// 3. Regex matches for your production domains (allows root and ALL subdomains)
// The (.*\.)? part means "any characters followed by a dot, optional"
const allowedDomainRegexes = [
    /^https:\/\/(.*\.)?holistichealervedika\.com$/,
    /^https:\/\/(.*\.)?rathhindia\.in$/
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like Postman, curl, or server-to-server)
        if (!origin) {
            return callback(null, true);
        }

        // Check if the origin matches our exact local URLs
        if (exactOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Check dynamic local origins first (localhost/127 on any port)
        const isLocalAllowed = localOriginRegexes.some(regex => regex.test(origin));
        if (isLocalAllowed) {
            return callback(null, true);
        }

        // Check if the origin matches allowed production domains
        const isAllowedDomain = allowedDomainRegexes.some(regex => regex.test(origin));
        if (isAllowedDomain) {
            return callback(null, true);
        }

        // If it fails both checks, block it
        callback(new Error('Not allowed by CORS'));
    },
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
    // , // Crucial for cookies!,
    ,methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(bodyParser.json());
// 🌟 NEW: INJECT CLIENT NAME MIDDLEWARE
// This ensures every request knows which database to hit
app.use((req, res, next) => {
    req.clientName = 'taleeo_lms';
    next();
});
// Base Route
app.get('/', (req, res) => res.send(`API is running for ${req.clientName}...`));
// Directing traffic to your route files
// Directing traffic to your route files
app.use('/auth', authRoutes); // Note: Removed /api/v1/ here because master index.js handles the prefix!
app.use('/public', publicRoutes); // Note: Removed /api/v1/ here because master index.js handles the prefix!
// app.use('/public', publicRoutes); // Note: Removed /api/v1/ here because master index.js handles the prefix!
app.use('/admin', adminRoutes);
app.use('/student', studentRoutes);

// Global error handler: ensures unhandled route errors produce one consistent response.
app.use((err, req, res, next) => {
    console.error('Unhandled API error:', err);

    if (res.headersSent) {
        return next(err);
    }

    const status = Number(err?.status || err?.statusCode || 500);
    return res.status(status).json({
        message: err?.message || 'Internal server error'
    });
});

module.exports = app;