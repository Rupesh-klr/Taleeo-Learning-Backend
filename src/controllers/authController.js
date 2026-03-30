const userService = require('../services/userService');

const login = async (req, res) => {
    const { email, pass } = req.body;
    console.log(email+pass)
    try {
        const user = await userService.validateLogin(email, pass);
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        res.cookie('token', 'your_jwt_token_here', {
            httpOnly: true, // Prevents frontend JavaScript from stealing the cookie (security)
            secure: process.env.NODE_ENV === 'production', // Use true in production (HTTPS), false for local dev (HTTP)
            sameSite: 'lax', // Helps protect against CSRF attacks
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        // Return user data (In production, generate a JWT token here)
        res.status(200).json({
            requiresOtp: user.role === 'student' && !user.firstLoginDone,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};

module.exports = { login };