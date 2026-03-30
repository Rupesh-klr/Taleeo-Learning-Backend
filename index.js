const app = require('./src/app');
const PORT = process.env.PORT || 3000;

// A simple endpoint to check if the server is online
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ status: 'online' });
});
app.listen(PORT, () => {
    console.log(`🚀 Server launched on http://localhost:${PORT}`);
});