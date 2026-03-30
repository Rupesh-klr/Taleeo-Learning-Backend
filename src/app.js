const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Base Route
app.get('/', (req, res) => res.send('TALeeO API is running...'));

// Directing traffic to your route files
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);

module.exports = app;