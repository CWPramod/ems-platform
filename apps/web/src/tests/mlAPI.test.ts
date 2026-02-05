import { mlAPI } from '../services/api';

// Test ML API connectivity
export async function testMLAPI() {
  console.log('Testing ML API...');

  try {
    // Test health
    const health = await mlAPI.health();
    console.log('✅ Health:', health);

    // Test list models
    const models = await mlAPI.listModels();
    console.log('✅ Models:', models);

    // Test anomaly detection
    const anomalies = await mlAPI.detectAnomalies({
      timeRange: 3600,
      threshold: 0.7,
    });
    console.log('✅ Anomalies:', anomalies);

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests (uncomment to test)
// testMLAPI();