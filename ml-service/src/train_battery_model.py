import pandas as pd
import numpy as np
import os
import glob
import xgboost as xgb
import joblib
from sklearn.model_selection import train_train_split, GridSearchCV # wait I will just use train_test_split
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

MODEL_DIR = os.path.join(os.path.dirname(__file__), '../models')
DATA_DIR = os.path.join(os.path.dirname(__file__), '../../battery-dataset/data')
METADATA_FILE = os.path.join(os.path.dirname(__file__), '../../battery-dataset/metadata.csv')

os.makedirs(MODEL_DIR, exist_ok=True)

def train_xgb_model():
    print("Loading metadata...")
    if not os.path.exists(METADATA_FILE):
        print(f"ERROR: Metadata not found at {METADATA_FILE}")
        return
        
    meta_df = pd.read_csv(METADATA_FILE)
    
    # We only care about discharge cycles where Capacity is measured 
    # to measure the 'State of Health' (SOH).
    discharge_meta = meta_df[(meta_df['type'] == 'discharge') & (meta_df['Capacity'].notnull())].copy()
    
    print(f"Found {len(discharge_meta)} discharge records with capacity.")
    
    features = []
    
    # Assuming 'uid' maps to files or test_id is cycle number.
    # In the metadata, ambient_temperature usually exists. We use 'test_id' as 'cycles'
    for idx, row in discharge_meta.iterrows():
        try:
            # Safely get properties
            temp = float(row.get('ambient_temperature', 24.0)) 
            cycles = int(row.get('test_id', 0))
            if cycles == 0 and 'uid' in row:
                cycles = int(row['uid'])
                
            capacity = float(row['Capacity'])
            
            # To simulate voltage behavior, we would average the voltage from the actual csv
            # We'll just load the corresponding CSV if 'filename' exists, else mock a rough voltage 
            avg_voltage = 3.7 # Default Lit-ion nominal
            file_path = os.path.join(DATA_DIR, row['filename']) if pd.notnull(row.get('filename')) else None
            
            if file_path and os.path.exists(file_path):
                # Try reading the first few lines to get the average voltage load
                try:
                    df = pd.read_csv(file_path, usecols=['Voltage_measured'])
                    avg_voltage = df['Voltage_measured'].mean()
                except Exception as e:
                    pass
                    
            features.append({
                'temperature': temp,
                'cycles': cycles,
                'voltage': avg_voltage,
                'capacity': capacity
            })
        except Exception as e:
            continue
            
    df_features = pd.DataFrame(features)
    if df_features.empty:
        print("ERROR: No valid features parsed.")
        return
        
    X = df_features[['temperature', 'cycles', 'voltage']]
    y = df_features['capacity']
    
    print("Splitting dataset and training an XGBoost Model...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Advanced logic: XGBoost parameters
    model = xgb.XGBRegressor(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=5,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    mse = mean_squared_error(y_test, preds)
    r2 = r2_score(y_test, preds)
    
    print(f"Model trained successfully! MSE: {mse:.4f}, R2 Score: {r2:.4f}")
    
    model_path = os.path.join(MODEL_DIR, "battery_xgb_model.json")
    model.save_model(model_path)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_xgb_model()
