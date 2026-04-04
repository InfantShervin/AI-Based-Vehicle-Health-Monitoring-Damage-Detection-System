import os
from ultralytics import YOLO

# Resolve paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
DATASET_YAML = os.path.join(BASE_DIR, 'roboflow-dataset', 'data.yaml')
MODEL_DIR = os.path.join(os.path.dirname(__file__), '../models')

os.makedirs(MODEL_DIR, exist_ok=True)

def train_yolo_damage_model():
    print(f"Checking for YOLO dataset config at: {DATASET_YAML}")
    if not os.path.exists(DATASET_YAML):
        print("\nERROR: data.yaml not found.")
        print("Please ensure your roboflow dataset is placed exactly at '../roboflow-dataset/data.yaml'")
        return

    print("\nLoading Pretrained YOLOv8n model...")
    # Load a pretrained model (recommended for transfer learning)
    model = YOLO('yolov8n.pt')

    print("\nStarting Training (Transfer Learning)...")
    # For 'no heavy training', we do a quick fine-tune (1-5 epochs)
    # The user can just run this script manually if they wish to have the real custom model.
    try:
        results = model.train(
            data=DATASET_YAML,
            epochs=1,    # Just 1 epoch to demonstrate capability without burning hour-long compute
            imgsz=640,
            project=MODEL_DIR,
            name='yolo_damage',
            exist_ok=True
        )
        print("\nTraining completed successfully.")
        print(f"Custom model saved tightly inside {MODEL_DIR}/yolo_damage/weights/best.pt")
    except Exception as e:
        print(f"Error during training: {e}")

if __name__ == "__main__":
    train_yolo_damage_model()
