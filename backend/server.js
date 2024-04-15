const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const winston = require('winston');
const CloudWatchTransport = require('winston-cloudwatch');
const { mqtt } = require('aws-iot-device-sdk-v2');
const AWS = require('aws-sdk');
const aedes = require('aedes')();
const httpServer = require('http');
const websocket = require('websocket-stream');

const apiRoutes = require('./routes/api');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MQTT_PORT = 1883;
const WS_MQTT_PORT = 8888; // Separate port for MQTT over WebSockets

const server = http.createServer(app);

// --- MQTT BROKER SETUP (Aedes) ---
const mqttNetServer = require('net').createServer(aedes.handle);
mqttNetServer.listen(MQTT_PORT, '0.0.0.0', () => {
    console.log(`📡 MQTT Broker (TCP) running on 0.0.0.0:${MQTT_PORT}`);
});

// MQTT over WebSockets for Frontend
const mqttWsServer = http.createServer(); // Use the same http module
websocket.createServer({ server: mqttWsServer }, aedes.handle);
mqttWsServer.listen(WS_MQTT_PORT, '0.0.0.0', () => {
    console.log(`🌐 MQTT over WebSockets running on 0.0.0.0:${WS_MQTT_PORT}`);
});

aedes.on('client', (client) => {
    if (client) console.log(`🔌 MQTT Client Connected: ${client.id}`);
});

aedes.on('publish', (packet, client) => {
    // Only log device publishes to keep logs clean
    if (client && packet.topic === IOT_TOPIC) {
        console.log(`📤 MQTT Publish from ${client.id}: ${packet.topic}`);
    }
});

// --- AWS SDK CONFIGURATION ---
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'VehicleTelemetry';

// --- PROFESSIONAL LOGGING (CloudWatch) ---
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ]
});

if (process.env.AWS_REGION && process.env.CLOUDWATCH_LOG_GROUP) {
    logger.add(new CloudWatchTransport({
        logGroupName: process.env.CLOUDWATCH_LOG_GROUP,
        logStreamName: `server-logs-${new Date().toISOString().split('T')[0]}`,
        awsRegion: process.env.AWS_REGION
    }));
}

app.use(cors());
app.use(express.json());

// --- SOCKET.IO SETUP (Keep for backward compatibility) ---
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    logger.info(`🔌 Socket.IO Client Connected: ${socket.id}`);
});

// --- AWS IoT MQTT INTEGRATION ---
const IOT_TOPIC = "vehicle/telemetry";
const LIVE_TOPIC = "vehicle/telemetry/live";

// --- BUILT-IN TELEMETRY SIMULATOR ---
function startTelemetrySimulator() {
    logger.info("🔄 Starting built-in vehicle telemetry simulator...");

    let cycleCount = 100;
    let baseHealth = 92;
    let baseTemp = 25;
    let baseVoltage = 3.85;
    let trend = -1;

    setInterval(() => {
        const tempNoise = (Math.random() - 0.5) * 4;
        const voltNoise = (Math.random() - 0.5) * 0.15;
        const healthDrift = (Math.random() - 0.3) * 0.8;

        baseTemp = Math.max(18, Math.min(55, baseTemp + tempNoise));
        baseVoltage = Math.max(2.8, Math.min(4.2, baseVoltage + voltNoise * trend));
        baseHealth = Math.max(15, Math.min(100, baseHealth + healthDrift * trend));
        cycleCount += Math.floor(Math.random() * 3) + 1;

        if (baseHealth < 30 || baseVoltage < 3.0) trend = 1;
        if (baseHealth > 95 || baseVoltage > 4.15) trend = -1;

        const telemetry = {
            temperature: parseFloat(baseTemp.toFixed(1)),
            voltage: parseFloat(baseVoltage.toFixed(3)),
            cycles: cycleCount,
            health_score: parseFloat(baseHealth.toFixed(1)),
            source: "simulator",
            timestamp: new Date().toISOString(),
            vin: "DEMO-VEHICLE-001"
        };

        // 1. Broadcast to Socket.IO
        io.emit('iot-battery-tick', telemetry);
        
        // 2. Publish to local MQTT (for Frontend)
        aedes.publish({
            topic: LIVE_TOPIC,
            payload: JSON.stringify(telemetry),
            qos: 0,
            retain: false
        });

        logger.info("📡 Simulated telemetry tick published", telemetry);
    }, 3000);
}

async function connectToAwsIot() {
    try {
        if (!process.env.AWS_IOT_ENDPOINT) {
            logger.warn("⚠️ AWS_IOT_ENDPOINT not set. Falling back to telemetry simulator.");
            startTelemetrySimulator();
            return;
        }

        logger.info(`📡 Connecting to AWS IoT Core: ${process.env.AWS_IOT_ENDPOINT}`);
        // Integration with AWS IoT Core for real devices would go here
    } catch (err) {
        logger.error(`❌ AWS IoT Connection Error: ${err.message}`);
        startTelemetrySimulator();
    }
}

connectToAwsIot();

// --- TELEMETRY HISTORY API ---
app.get('/api/telemetry/history', async (req, res) => {
    const vin = req.query.vin || "DEMO-VEHICLE-001";
    
    const params = {
        TableName: DYNAMODB_TABLE,
        KeyConditionExpression: "vin = :v",
        ExpressionAttributeValues: {
            ":v": vin
        },
        ScanIndexForward: false,
        Limit: 50
    };

    try {
        const data = await dynamodb.query(params).promise();
        res.json(data.Items.reverse());
    } catch (err) {
        logger.error(`DynamoDB Query Error: ${err.message}`);
        res.json([]);
    }
});

// --- LIVE TELEMETRY WEBHOOK (AWS Lambda Bridge) ---
app.post('/api/iot-webhook', (req, res) => {
    const sensorData = req.body;
    const token = req.headers['x-api-key'];

    if (process.env.SECRET_TOKEN && token !== process.env.SECRET_TOKEN) {
        logger.warn("❌ Unauthorized Webhook Attempt");
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Broadcast to Socket.IO
    io.emit('iot-battery-tick', sensorData);

    // Publish to local MQTT (for Frontend Graph)
    aedes.publish({
        topic: LIVE_TOPIC,
        payload: Buffer.from(JSON.stringify(sensorData)),
        qos: 0,
        retain: false
    }, (err) => {
        if (err) console.error("❌ Aedes Publish Error:", err);
        else console.log(`📤 Bridged to MQTT: ${LIVE_TOPIC}`);
    });
    
    logger.info("📡 AWS IoT Webhook Received", { vin: sensorData.vin, temp: sensorData.temperature });
    res.status(200).json({ status: "Success" });
});

app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'System Error. Check logs.' });
});

server.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Advanced Live Server running on port ${PORT}`);
});
