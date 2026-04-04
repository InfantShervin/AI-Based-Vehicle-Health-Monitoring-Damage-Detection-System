const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const analyzeVehicle = async (req, res) => {
    try {
        const { temperature, voltage, cycles } = req.body;
        const file = req.file;

        if (!file || !temperature || !voltage || !cycles) {
           return res.status(400).json({ error: 'Missing image or sensor data' });
        }

        console.log(`Processing an analysis request for: ${file.filename}`);

        // Forward to Advanced ML Service (Python API)
        const formData = new FormData();
        formData.append('temperature', temperature);
        formData.append('voltage', voltage);
        formData.append('cycles', cycles);
        formData.append('file', fs.createReadStream(file.path), file.originalname);

        // Uses environment variable ML_API_URL or defaults to localhost
        const mlUrl = process.env.ML_API_URL || 'http://127.0.0.1:8000';
        
        const mlResponse = await axios.post(`${mlUrl}/predict`, formData, {
            headers: {
                ...formData.getHeaders()
            }
        });

        // Wipe temp image
        fs.unlinkSync(file.path);

        res.status(200).json(mlResponse.data);

    } catch (error) {
        console.error('Error during analysis:', error.message || error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path); // robust cleanup
        }
        res.status(500).json({ error: 'Failed analyzing inputs due to ML service unavailability or processing error.' });
    }
};

module.exports = {
    analyzeVehicle
};
