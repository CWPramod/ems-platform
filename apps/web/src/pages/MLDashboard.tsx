import { useState, useEffect } from 'react';
import { mlAPI } from '../services/api';
import type {
  MLHealthResponse,
  ModelsListResponse,
  AnomalyDetectionResponse,
  TrainModelResponse,
} from '../types';

export default function MLDashboard() {
  const [health, setHealth] = useState<MLHealthResponse | null>(null);
  const [models, setModels] = useState<ModelsListResponse | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyDetectionResponse | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [, setTrainingResult] = useState<TrainModelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load ML data on mount
  useEffect(() => {
    loadMLData();
    // Refresh every 30 seconds
    const interval = setInterval(loadMLData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMLData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [healthData, modelsData, anomaliesData] = await Promise.all([
        mlAPI.health(),
        mlAPI.listModels(),
        mlAPI.detectAnomalies({ timeRange: 3600, threshold: 0.7 }),
      ]);

      setHealth(healthData);
      setModels(modelsData);
      setAnomalies(anomaliesData);
    } catch (err) {
      setError('Failed to load ML data');
      console.error('ML Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrainModel = async () => {
    try {
      setIsTraining(true);
      setTrainingResult(null);
      
      const result = await mlAPI.trainModel({
        modelType: 'anomaly_detection',
        timeRange: 86400, // Last 24 hours
      });

      setTrainingResult(result);
      
      // Reload models after training
      const modelsData = await mlAPI.listModels();
      setModels(modelsData);
      
      alert(`✅ Model trained successfully!\n\nSamples: ${result.trainingSamples}\nAnomalies: ${result.trainingMetrics?.anomalies_detected}\nDuration: ${result.trainingDuration.toFixed(2)}s`);
    } catch (err) {
      alert('❌ Training failed: ' + (err as Error).message);
      console.error('Training error:', err);
    } finally {
      setIsTraining(false);
    }
  };

  const handleDetectAnomalies = async () => {
    try {
      setLoading(true);
      const result = await mlAPI.detectAnomalies({ timeRange: 3600, threshold: 0.7 });
      setAnomalies(result);
      alert(`✅ Anomaly detection complete!\n\nAssets analyzed: ${result.totalAnalyzed}\nAnomalies found: ${result.anomaliesDetected}`);
    } catch (err) {
      alert('❌ Detection failed: ' + (err as Error).message);
      console.error('Detection error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !health) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ML Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">Error</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadMLData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusColor = {
    healthy: 'bg-green-100 text-green-800 border-green-300',
    degraded: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    unhealthy: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ML Dashboard</h1>
        <p className="text-gray-600 mt-2">Machine Learning & Anomaly Detection</p>
      </div>

      {/* Service Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Service Status</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColor[health?.status || 'unhealthy']}`}>
              {health?.status || 'Unknown'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Database:</span>
              <span className={health?.database ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                {health?.database ? '✓ Connected' : '✗ Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Model Loaded:</span>
              <span className={health?.models?.anomaly_detection ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                {health?.models?.anomaly_detection ? '✓ Active' : '○ Not loaded'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trained Models</h3>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {models?.totalModels || 0}
            </div>
            <p className="text-sm text-gray-600">
              {models?.totalModels === 1 ? 'Model' : 'Models'} Available
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Anomalies</h3>
          <div className="text-center">
            <div className="text-4xl font-bold text-orange-600 mb-2">
              {anomalies?.anomaliesDetected || 0}
            </div>
            <p className="text-sm text-gray-600">
              Found in last hour
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {anomalies?.totalAnalyzed || 0} assets analyzed
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleTrainModel}
            disabled={isTraining}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isTraining ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Training Model...
              </>
            ) : (
              <>
                🎓 Train Model
              </>
            )}
          </button>

          <button
            onClick={handleDetectAnomalies}
            disabled={loading}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            🔍 Detect Anomalies
          </button>

          <button
            onClick={loadMLData}
            disabled={loading}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Trained Models List */}
      {models && models.models.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trained Models</h3>
          <div className="space-y-4">
            {models.models.map((model, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">{model.modelType}</h4>
                    <p className="text-sm text-gray-600">Version: {model.modelVersion}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    model.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {model.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Training Date:</span>
                    <p className="font-medium">{new Date(model.trainingDate).toLocaleString()}</p>
                  </div>
                  {model.metrics && (
                    <div>
                      <span className="text-gray-600">Samples:</span>
                      <p className="font-medium">{(model.metrics as any).samples_trained || 'N/A'}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Anomalies */}
      {anomalies && anomalies.results.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Anomalies ({anomalies.results.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {anomalies.results.map((anomaly, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {anomaly.assetName || `Asset ${anomaly.assetId}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {anomaly.metricName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {anomaly.value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        anomaly.score > 0.8 
                          ? 'bg-red-100 text-red-800' 
                          : anomaly.score > 0.6
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {(anomaly.score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(anomaly.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Anomalies Message */}
      {anomalies && anomalies.results.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
          <p className="text-gray-600">
            No anomalies detected in the last hour. All systems are operating normally.
          </p>
        </div>
      )}
    </div>
  );
}
