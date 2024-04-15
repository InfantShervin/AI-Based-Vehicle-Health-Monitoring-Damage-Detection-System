import time
import random
import requests
import pandas as pd
import os

# The Node.js Live Webhook Endpoint
WEBHOOK_URL = "http://127.0.0.1:5000/api/iot-webhook"
METADATA_FILE = os.path.join(os.path.dirname(__file__), '../../battery-dataset/metadata.csv')

def simulate_aws_iot():
    print("🔋 AWS IoT Live Simulator Started!")
    print("Reading physical sensor dataset...")

    if not os.path.exists(METADATA_FILE):
        print("ERROR: Could not find battery metadata. Run this inside ml-service/src/")
        return
        
    df = pd.read_csv(METADATA_FILE)
    discharge_df = df[df['type'] == 'discharge'].copy()
    
    print(f"Loaded {len(discharge_df)} IoT Simulation Ticks. Streaming to Webhook...")
    
    for idx, row in discharge_df.iterrows():
        temp = float(row.get('ambient_temperature', 24.0)) 
        cycles = int(row.get('test_id', random.randint(1, 500)))

        # Simulate voltage fluctuating up and down
        voltage = 3.7 - (cycles / 1000) + random.uniform(-0.1, 0.1)
        
        # Calculate a mock SHAP health score dropping gradually
        health_score = max(10, 100 - (cycles / 10) - (temp > 30) * 10)
        
        payload = {
            "temperature": round(temp, 2),
            "voltage": round(voltage, 2),
            "cycles": cycles,
            "health_score": round(health_score, 1)
        }
        
        try:
            # Simulate AWS Lambda hitting our Express Route
            res = requests.post(WEBHOOK_URL, json=payload)
            print(f"📡 Emitted: Temp={temp}°C, Cycles={cycles}, Volts={voltage:.2f} -> Response: {res.status_code}")
        except Exception as e:
            print(f"Failed to post to Webhook: {e}")
            
        # Send data every 2 seconds
        time.sleep(2)

if __name__ == "__main__":
    simulate_aws_iot()
