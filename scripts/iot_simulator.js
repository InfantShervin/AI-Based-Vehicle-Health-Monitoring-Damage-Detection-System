/**
 * Vehicle Telemetry Simulator (v2)
 * Supports:
 * - AWS_MODE: Connects to AWS IoT Core (Production level)
 * - LOCAL_MODE: Connects to backend MQTT bridge (Quick Test)
 */
const { iot, mqtt } = require('aws-iot-device-sdk-v2');
const mqtt_local = require('mqtt');
const path = require('path');

async function startAwsMode() {
    console.log("☁️  Starting Simulator in AWS MODE...");
    
    const endpoint = process.env.AWS_IOT_ENDPOINT;
    if (!endpoint) {
        console.error("❌ ERROR: AWS_IOT_ENDPOINT environment variable is missing!");
        process.exit(1);
    }

    // Paths to your certificates
    const certPath = path.join(__dirname, '../certs/device.cert.pem');
    const keyPath = path.join(__dirname, '../certs/private.key.pem');
    const caPath = path.join(__dirname, '../certs/root-CA.crt');

    const config_builder = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(certPath, keyPath);
    config_builder.with_certificate_authority_from_path(undefined, caPath);
    config_builder.with_clean_session(false);
    config_builder.with_client_id(`vehicle-simulator-${Math.floor(Math.random() * 1000)}`);
    config_builder.with_endpoint(endpoint);

    const config = config_builder.build();
    const client = new mqtt.MqttClient();
    const connection = client.new_connection(config);

    console.log(`🔗 Connecting to AWS Endpoint: ${endpoint}...`);
    await connection.connect();
    console.log("✅ AWS IoT Connected Successfully!");

    return connection;
}

async function startLocalMode() {
    console.log("🏠 Starting Simulator in LOCAL MODE...");
    const broker = "mqtt://100.25.24.173:1883";
    console.log(`🔗 Connecting to Local Bridge: ${broker}`);
    return mqtt_local.connect(broker);
}

async function main() {
    const isAws = process.env.USE_AWS === "true";
    let connection;

    try {
        if (isAws) {
            connection = await startAwsMode();
        } else {
            connection = await startLocalMode();
        }
    } catch (err) {
        console.error("❌ Connection Failed:", err.message);
        process.exit(1);
    }

    const topic = isAws ? "vehicle/telemetry" : "vehicle/telemetry/live";
    console.log(`📡 Sending telemetry to topic: [${topic}] every 3s...`);

    setInterval(() => {
        const payload = {
            vin: "DEMO-VEHICLE-001",
            timestamp: new Date().toISOString(),
            temperature: parseFloat((25 + Math.random() * 10).toFixed(1)),
            voltage: parseFloat((3.8 + Math.random() * 0.4).toFixed(3)),
            cycles: 1250,
            health_score: 92.5
        };

        const json = JSON.stringify(payload);
        if (isAws) {
            connection.publish(topic, json, mqtt.QoS.AtLeastOnce);
        } else {
            connection.publish(topic, json);
        }
        console.log(`📤 Published Data: ${json}`);
    }, 3000);
}

main().catch(console.error);
