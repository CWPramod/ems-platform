import { useState, useEffect } from 'react';
import { Alert, Button } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'http://localhost:3100';

interface LicenseWarning {
  status: string;
  valid: boolean;
  warnings: string[];
  daysRemaining: number | null;
}

/**
 * Displays a banner at the top of the app when the license is
 * expiring soon, in grace period, or expired.
 * Polls every 5 minutes.
 */
export default function LicenseWarningBanner() {
  const [warning, setWarning] = useState<LicenseWarning | null>(null);
  const navigate = useNavigate();

  const checkLicense = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/licenses/status`);
      const data = res.data.data;
      if (data.warnings && data.warnings.length > 0) {
        setWarning({
          status: data.status,
          valid: data.valid,
          warnings: data.warnings,
          daysRemaining: data.daysRemaining,
        });
      } else {
        setWarning(null);
      }
    } catch {
      // Silently fail - don't block the UI for license check errors
    }
  };

  useEffect(() => {
    checkLicense();
    const interval = setInterval(checkLicense, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!warning) return null;

  const alertType = !warning.valid ? 'error' :
    warning.status === 'grace_period' ? 'warning' : 'info';

  return (
    <Alert
      type={alertType}
      banner
      showIcon
      icon={<WarningOutlined />}
      message={warning.warnings.join(' ')}
      action={
        <Button size="small" type="link" onClick={() => navigate('/license')}>
          Manage License
        </Button>
      }
      style={{ borderRadius: 0 }}
    />
  );
}
