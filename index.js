const express = require('express');
const { connectDB } = require('./src/config/db');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// 1. Create the MASTER Express App
const masterApp = express();

// ADD NEW CLIENTS HERE IN THE FUTURE
const activeClients = ['taleeo_lms'];

async function startServer() {
    try {
        // console.log('⏳ Initializing database connections...');
        // await Promise.all(activeClients.map(client => connectDB(client)));
        console.log('⏳ Initializing database connections & mounting apps...');
        // Loop through all active clients
        await Promise.all(activeClients.map(async (client) => {
            
            // 1. Connect to the specific client's Database
            await connectDB(client);
            
            // 2. DYNAMICALLY require the app.js from the client's specific folder
            const clientApp = require(`./src/${client}/app`);
            
            // 3. Mount it to the dynamic URL endpoint
            masterApp.use(`/api/v1/${client}`, clientApp);
            
            console.log(`✅ Mounted routes for: /api/v1/${client}`);
        }));
        masterApp.get('/api/v1/health', (req, res) => {
            res.status(200).json({ status: 'online', message: "KLR servers are active" });
        });
        masterApp.get('/', (req, res) => {
            res.status(200).json({ status: 'online', message: "KLR servers are active" });
        });
        // 5. Use masterApp to listen on the port
        masterApp.listen(PORT, () => {
            console.log(`🚀 Server launched on http://localhost:${PORT}`);
            // console.log(`🔗 Taleeo LMS API Base: http://localhost:${PORT}/api/v1/taleeo_lms`);
        });

    } catch (error) {
        console.error('❌ Failed to start server. Database connection error:', error);
        process.exit(1);
    }
}

startServer();