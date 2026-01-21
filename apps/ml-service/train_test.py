import sys
sys.path.append('.')

from app.services.anomaly_detection import anomaly_detector
import numpy as np

# Get some sample data (just values)
values = [45.5, 45.2, 46.8, 44.5, 47.3, 45.9, 46.5, 45.1, 47.0, 46.2,
          95.5, 50, 54, 11.8, 41, 48, 40, 56, 12.2, 67, 48, 69, 45, 53]

# Create simple features (value + basic stats)
features = []
for i in range(len(values)):
    if i >= 5:
        recent = values[i-5:i+1]
        features.append([
            values[i],
            np.mean(recent),
            np.std(recent),
            np.min(recent),
            np.max(recent),
            values[i-1] if i > 0 else values[i]
        ])

features_array = np.array(features)
print(f"Training with {len(features)} samples...")

result = anomaly_detector.train(features_array, contamination=0.1)
print("Training complete!")
print(result)
