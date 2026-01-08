# AI/ML Strategy - Correlation Engine

**Status:** ✅ LOCKED - ML approach defined  
**Date:** January 8, 2026  
**Author:** Pramod + Claude

---

## Vision

Build an ML-powered correlation engine that:
1. **Learns** your infrastructure patterns over time
2. **Predicts** root causes automatically (70%+ accuracy)
3. **Clusters** related alerts to reduce noise (30-40% reduction)
4. **Calculates** business impact for every alert
5. **Improves** continuously through operator feedback

---

## ML Stack

### Framework
- **scikit-learn** (Python 3.11+)
- **pandas** for data manipulation
- **NumPy** for numerical operations
- **joblib** for model serialization

### Infrastructure
- **FastAPI** microservice for inference
- **PostgreSQL** for training data storage
- **Docker** container for deployment

---

## Use Case 1: Root Cause Analysis (RCA)

### Problem
When multiple alerts fire, which asset is the actual root cause?

### Approach: Random Forest Classifier

**Why Random Forest?**
- Handles non-linear relationships
- Provides feature importance (explainable AI)
- Resistant to overfitting
- Fast inference (<100ms)
- No need for feature scaling

### Training Data

Collect historical events with manually labeled root causes:
```python
Training Features (X):
- event_severity (critical=3, warning=2, info=1)
- asset_type (router, server, application, etc.)
- time_of_day (0-23)
- day_of_week (0-6)
- co_occurring_events (count)
- affected_asset_count
- historical_failure_rate
- dependency_depth (how many things depend on this)
- mttr_history (mean time to resolve for this asset)
- recent_change (0/1 - was there a change in last 24h?)

Target Label (y):
- is_root_cause (0 or 1)
```

### Model Training
```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_recall_fscore_support

# Load training data (last 3-6 months)
X_train, X_test, y_train, y_test = train_test_split(
    features, labels, test_size=0.2, random_state=42
)

# Train Random Forest
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    min_samples_split=20,
    class_weight='balanced',  # Handle imbalanced data
    random_state=42
)

model.fit(X_train, y_train)

# Evaluate
precision, recall, f1, _ = precision_recall_fscore_support(
    y_test, model.predict(X_test), average='binary'
)

print(f"Precision: {precision:.2f}")  # Target: >0.75
print(f"Recall: {recall:.2f}")        # Target: >0.70
print(f"F1 Score: {f1:.2f}")          # Target: >0.72
```

### Feature Importance
```python
importances = model.feature_importances_
# Expected top features:
# 1. dependency_depth (35%)
# 2. historical_failure_rate (25%)
# 3. affected_asset_count (15%)
# 4. co_occurring_events (10%)
# 5. recent_change (10%)
# 6. Others (5%)
```

### Inference (Real-time)
```python
def predict_root_cause(alert_id: str, recent_events: List[Event]):
    # Extract features
    features = extract_features(alert_id, recent_events)
    
    # Predict
    probabilities = model.predict_proba(features)
    root_cause_prob = probabilities[:, 1]  # Probability of being root cause
    
    # Get top candidate
    top_idx = np.argmax(root_cause_prob)
    confidence = root_cause_prob[top_idx]
    
    # Get feature importance for this prediction (SHAP values could be added later)
    reasoning = get_top_features(features[top_idx])
    
    return {
        'root_cause_asset_id': recent_events[top_idx].assetId,
        'confidence': float(confidence),
        'reasoning': reasoning
    }
```

---

## Use Case 2: Alert Clustering

### Problem
Hundreds of duplicate/related alerts create noise. Group them intelligently.

### Approach: DBSCAN (Density-Based Clustering)

**Why DBSCAN?**
- No need to specify number of clusters
- Automatically handles noise/outliers
- Works well with time-series data
- Fast for thousands of alerts

### Feature Engineering
```python
Alert Features for Clustering:
- timestamp (normalized)
- asset_id (one-hot encoded)
- severity (numeric)
- category (one-hot encoded)
- message_embedding (TF-IDF vector, 50 dimensions)
```

### Clustering Algorithm
```python
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer

# Prepare features
scaler = StandardScaler()
features_scaled = scaler.fit_transform(alert_features)

# Run DBSCAN
clustering = DBSCAN(
    eps=0.5,           # Maximum distance between alerts in same cluster
    min_samples=2,     # Minimum alerts to form a cluster
    metric='euclidean'
)

labels = clustering.fit_predict(features_scaled)

# Group alerts
clusters = {}
for alert_id, label in zip(alert_ids, labels):
    if label == -1:  # Noise/outlier
        clusters.setdefault('unclustered', []).append(alert_id)
    else:
        clusters.setdefault(f'cluster_{label}', []).append(alert_id)

return clusters
```

### Suppression Logic
```python
For each cluster:
1. Identify PRIMARY alert (highest impact score)
2. Mark others as SUPPRESSED
3. Link suppressed alerts to primary via correlationId
4. Show only primary in main alert feed
5. Allow drill-down to see suppressed alerts
```

---

## Use Case 3: Pattern Detection

### Problem
Recurring issues that happen periodically (e.g., every Monday at 2am).

### Approach: Time Series Analysis
```python
from statsmodels.tsa.seasonal import seasonal_decompose

# Analyze alert frequency over time
alert_counts = df.groupby('timestamp').size()

# Decompose into trend + seasonal + residual
decomposition = seasonal_decompose(
    alert_counts, 
    model='additive', 
    period=24*7  # Weekly seasonality
)

# Detect patterns
if decomposition.seasonal.max() > threshold:
    pattern_detected = True
    pattern_type = 'weekly' if period == 7*24 else 'daily'
```

---

## Continuous Learning Pipeline

### Training Schedule
```
Initial Training: Use 3-6 months historical data
Retraining: Weekly (every Sunday at 2am)
Model Versioning: Keep last 4 versions
Rollback: If new model accuracy drops >5%, auto-rollback
```

### Feedback Loop
```python
Operator Feedback Collection:
1. When operator resolves alert, ask:
   - "Was the predicted root cause correct?" (Yes/No)
   - "What was the actual root cause?" (Asset dropdown)
   
2. Store feedback:
   {
     alert_id: string,
     predicted_root_cause: string,
     actual_root_cause: string,
     operator_id: string,
     timestamp: Date
   }

3. Use feedback to retrain model weekly
```

### Model Performance Tracking
```python
Metrics to Track (stored in PostgreSQL):
- model_version: string
- accuracy: float
- precision: float
- recall: float
- f1_score: float
- training_date: Date
- training_data_size: int
- feature_importance: JSON

Dashboard KPIs:
- RCA Accuracy Trend (last 12 weeks)
- Alert Reduction % (clustering effectiveness)
- Model Confidence Distribution
- False Positive Rate
```

---

## Explainable AI

Every prediction includes reasoning:
```typescript
Response Example:
{
  "rootCauseAssetId": "ast_abc123",
  "confidence": 0.87,
  "reasoning": [
    "This router has 15 dependent devices (high impact)",
    "Historical failure rate for this asset is 12% (above average)",
    "4 other alerts occurred within 30 seconds (cascading failure pattern)",
    "Recent configuration change detected 2 hours ago"
  ],
  "alternativeHypotheses": [
    { "assetId": "ast_xyz789", "confidence": 0.23 },
    { "assetId": "ast_def456", "confidence": 0.15 }
  ]
}
```

---

## Cold Start Problem

**Challenge:** New EMS deployment has no historical data to train models.

### Solution 1: Pre-trained Models
Ship with models trained on anonymized data from other deployments (if available).

### Solution 2: Rule-based Fallback
During first 3 months, use simple heuristic rules:
```python
if alert.severity == 'critical':
    root_cause = asset_with_most_dependencies
elif recent_change_detected:
    root_cause = recently_changed_asset
else:
    root_cause = first_failing_asset
```

### Solution 3: Transfer Learning
Use publicly available network failure datasets to pre-train, then fine-tune.

---

## Scalability

### Training Performance
```
Data Size: 100K alerts
Training Time: ~5 minutes (on 4-core CPU)
Model Size: ~50MB
Inference Time: <100ms per prediction
```

### Horizontal Scaling
```
ML Service:
- Stateless FastAPI
- Load balance multiple instances
- Model loaded in memory (50MB each)
- Can handle 1000 predictions/second per instance
```

---

## Model Deployment

### Docker Container
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model and code
COPY models/ ./models/
COPY src/ ./src/

# Expose API
EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Model Versioning
```
models/
├── rca_v1.0.0.joblib
├── rca_v1.1.0.joblib
├── clustering_v1.0.0.joblib
└── metadata.json
```

### Health Check
```python
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_version": "1.1.0",
        "model_loaded": model is not None,
        "last_training": "2026-01-07T02:00:00Z"
    }
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Insufficient training data | Low accuracy | Collect 3+ months before enabling |
| Overfitting | Poor generalization | Cross-validation, regularization |
| Model staleness | Degrading accuracy | Weekly retraining, performance monitoring |
| Bias in training data | Incorrect predictions | Balanced class weights, diverse data |
| Cold start | No predictions initially | Rule-based fallback for first 3 months |

---

## Success Criteria

### Phase 4 MVP (AI Module Launch)
- ✅ RCA Accuracy: >70%
- ✅ Alert Reduction: 30%+ through clustering
- ✅ Inference Latency: <100ms
- ✅ Model Retraining: Automated weekly

### 6 Months Post-Launch
- ✅ RCA Accuracy: >80%
- ✅ Alert Reduction: 40%+
- ✅ False Positive Rate: <5%
- ✅ Operator Satisfaction: 4+/5

---

## Future Enhancements (Post-MVP)

1. **Deep Learning** for complex pattern detection
2. **Anomaly Detection** using autoencoders
3. **Predictive Maintenance** (forecast failures before they happen)
4. **Natural Language** alert descriptions using LLMs
5. **Multi-modal Learning** (combine metrics + logs + traces)

---

**Approved by:** Pramod  
**Date:** January 8, 2026  
**Status:** LOCKED ✅