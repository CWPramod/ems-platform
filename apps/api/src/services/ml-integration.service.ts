import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MLIntegrationService {
  private readonly logger = new Logger(MLIntegrationService.name);
  private readonly mlServiceUrl = 'http://localhost:8000/ml';

  async detectAnomaly(value: number, historicalData?: number[]): Promise<any> {
    try {
      const response = await axios.post(`${this.mlServiceUrl}/detect-anomaly`, {
        value,
        historical_data: historicalData,
      });
      
      this.logger.log(`Anomaly detection for value ${value}: ${response.data.is_anomaly}`);
      return response.data;
    } catch (error) {
      this.logger.error(`ML service error: ${error.message}`);
      return null;
    }
  }

  async analyzeRootCause(
    event: any,
    relatedEvents: any[] = [],
    assetMetrics: Record<string, number[]> = {},
  ): Promise<any> {
    try {
      const response = await axios.post(`${this.mlServiceUrl}/analyze-root-cause`, {
        event,
        related_events: relatedEvents,
        asset_metrics: assetMetrics,
      });
      
      this.logger.log(`Root cause analysis: ${response.data.root_cause_asset_id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`ML service error: ${error.message}`);
      return null;
    }
  }

  async calculateBusinessImpact(
    event: any,
    assetTier: number,
    relatedEventsCount: number,
  ): Promise<any> {
    try {
      const response = await axios.post(`${this.mlServiceUrl}/calculate-business-impact`, {
        event,
        asset_tier: assetTier,
        related_events_count: relatedEventsCount,
      });
      
      this.logger.log(`Business impact score: ${response.data.business_impact_score}`);
      return response.data;
    } catch (error) {
      this.logger.error(`ML service error: ${error.message}`);
      return null;
    }
  }

  async isMLServiceAvailable(): Promise<boolean> {
    try {
      const response = await axios.get('http://localhost:8000/health');
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}