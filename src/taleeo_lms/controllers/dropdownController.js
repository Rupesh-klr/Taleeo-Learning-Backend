const dropdownService = require('../services/dropdownService');

const getDropdowns = async (req, res) => {
    try {
        const item = req.query.item || req.params.item || 'courses';
        console.log(`Dropdown request for item: ${item}`); // 🌟 Debug log
        const data = await dropdownService.getDropdownData(req.clientName, item, req.query);
        return res.status(200).json(data);
    } catch (error) {
        console.error('Dropdown data fetch error:', error);
        return res.status(500).json({
            message: 'Failed to fetch dropdown data',
            error: error.message
        });
    }
};

module.exports = { getDropdowns };