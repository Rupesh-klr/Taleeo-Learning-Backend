const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../../data');

const readData = (filename) => {
    const filePath = path.join(DATA_PATH, `${filename}.json`);
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        console.log(data);
        return JSON.parse(data);
    } catch (err) {
        return []; // Return empty array if file is missing or empty
    }
};

const writeData = (filename, data) => {
    const filePath = path.join(DATA_PATH, `${filename}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

module.exports = { readData, writeData };