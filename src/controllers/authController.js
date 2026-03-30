const userService = require('../services/userService');

const login = async (req, res) => {
    const { email, pass } = req.body;
    console.log(email+pass)
    try {
        const user = await userService.validateLogin(email, pass);
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        
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