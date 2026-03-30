const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const cookieParser = require('cookie-parser');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
// 1. Exact matches for your local development environments
const exactOrigins = [
    'http://localhost:5500', 
    'http://127.0.0.1:5500',
    'http://localhost:3000'
];

// 2. Regex matches for your production domains (allows root and ALL subdomains)
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

        // Check if the origin matches our wildcard subdomains
        const isAllowedDomain = allowedDomainRegexes.some(regex => regex.test(origin));
        if (isAllowedDomain) {
            return callback(null, true);
        }

        // If it fails both checks, block it
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true // Crucial for cookies!
}));
app.use(bodyParser.json());
app.use(cookieParser());

// Base Route
app.get('/', (req, res) => res.send('TALeeO API is running...'));

// Directing traffic to your route files
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);

module.exports = app;