const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const http = require('http');
const https = require('https');
const url = require('url');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    console.log("📥 Received AWS IoT Event:", JSON.stringify(event, null, 2));

    const timestamp = event.timestamp || new Date().toISOString();
    const vin = event.vin || "DEMO-VEHICLE-001";
    
    // 1. Save to DynamoDB (Persistence)
    const params = {
        TableName: process.env.DYNAMODB_TABLE || "VehicleTelemetry",
        Item: {
            vin: vin,
            timestamp: timestamp,
            temperature: event.temperature || 0,
            voltage: event.voltage || 0.0,
            cycles: event.cycles || 0,
            health_score: event.health_score || 100,
            source: "aws-iot-v3-modern"
        }
    };

    try {
        await dynamodb.send(new PutCommand(params));
        console.log("✅ Successfully saved to DynamoDB (SDK v3)");
    } catch (err) {
        console.error("❌ DynamoDB Write Error:", err);
    }

    // 2. Trigger Backend Webhook (Real-Time Bridge)
    if (process.env.BACKEND_URL) {
        console.log(`🔗 Triggering Backend: ${process.env.BACKEND_URL}`);
        await triggerWebhook(process.env.BACKEND_URL, {
            ...event,
            timestamp,
            vin
        });
    }

    return { statusCode: 200, body: "Telemetry Processed Successfully" };
};

async function triggerWebhook(webhookUrl, data) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(webhookUrl);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.SECRET_TOKEN || 'no-token',
                'User-Agent': 'AWS-Lambda-IoT-Bridge-v3'
            },
            timeout: 5000 // 5 second timeout
        };

        const req = protocol.request(options, (res) => {
            console.log(`📡 Webhook Response: ${res.statusCode}`);
            resolve();
        });

        req.on('error', (e) => {
            console.error(`❌ Webhook Connection Error: ${e.message}`);
            resolve(); // Don't crash the Lambda if backend is down
        });

        req.write(JSON.stringify(data));
        req.end();
    });
}
