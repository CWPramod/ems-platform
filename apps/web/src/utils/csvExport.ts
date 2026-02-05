// CSV Export Utility for Reports
// File: src/utils/csvExport.ts

export const exportToCSV = (data: any[], filename: string, reportType: string, groupBy: string) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  let csvContent = '';
  let headers: string[] = [];
  let rows: string[][] = [];

  // Device-wise reports
  if (groupBy === 'device') {
    if (reportType === 'uptime') {
      headers = [
        'Device Name',
        'IP Address',
        'Type',
        'Location',
        'Tier',
        'Uptime %',
        'Downtime Hours',
        'Downtime Minutes',
        'Current Status',
        'Health Score',
      ];

      rows = data.map((item) => [
        item.deviceName || '',
        item.deviceIp || '',
        item.type || '',
        item.location || '',
        item.tier?.toString() || '',
        item.uptimePercent?.toFixed(2) || '0',
        item.downtimeHours?.toFixed(2) || '0',
        item.downtimeMinutes?.toFixed(2) || '0',
        item.currentStatus || '',
        item.healthScore?.toString() || '0',
      ]);
    } else if (reportType === 'sla') {
      headers = [
        'Device Name',
        'IP Address',
        'Type',
        'Location',
        'Tier',
        'SLA Target %',
        'Actual Uptime %',
        'Compliance Status',
        'Breach %',
      ];

      rows = data.map((item) => [
        item.deviceName || '',
        item.deviceIp || '',
        item.type || '',
        item.location || '',
        item.tier?.toString() || '',
        item.slaTarget?.toString() || '99',
        item.actualUptime?.toFixed(2) || '0',
        item.status || '',
        item.breach?.toFixed(2) || '0',
      ]);
    } else if (reportType === 'performance') {
      headers = [
        'Device Name',
        'IP Address',
        'Type',
        'Location',
        'Tier',
        'CPU %',
        'Memory %',
        'Bandwidth In (Mbps)',
        'Bandwidth Out (Mbps)',
        'Packet Loss %',
        'Latency (ms)',
        'Health Score',
      ];

      rows = data.map((item) => [
        item.deviceName || '',
        item.deviceIp || '',
        item.type || '',
        item.location || '',
        item.tier?.toString() || '',
        item.metrics?.cpu?.toFixed(2) || '0',
        item.metrics?.memory?.toFixed(2) || '0',
        item.metrics?.bandwidthIn?.toFixed(2) || '0',
        item.metrics?.bandwidthOut?.toFixed(2) || '0',
        item.metrics?.packetLoss?.toFixed(2) || '0',
        item.metrics?.latency?.toFixed(2) || '0',
        item.metrics?.healthScore?.toString() || '0',
      ]);
    }
  }
  // Tier-wise reports
  else if (groupBy === 'tier') {
    headers = ['Tier', 'Device Count', 'Average Uptime %', 'Compliant', 'Total', 'Compliance %'];

    rows = data.map((item) => [
      item.tier?.toString() || '',
      item.deviceCount?.toString() || '0',
      item.averageUptime?.toFixed(2) || '0',
      item.slaCompliance?.compliant?.toString() || '0',
      item.slaCompliance?.total?.toString() || '0',
      item.slaCompliance?.percentage?.toString() || '0',
    ]);
  }
  // Location-wise reports
  else if (groupBy === 'location') {
    headers = [
      'Location',
      'Device Count',
      'Device Types',
      'Average Uptime %',
      'Compliant',
      'Total',
      'Compliance %',
    ];

    rows = data.map((item) => [
      item.location || '',
      item.deviceCount?.toString() || '0',
      Object.entries(item.deviceTypes || {})
        .map(([type, count]) => `${type}:${count}`)
        .join(', '),
      item.averageUptime?.toFixed(2) || '0',
      item.slaCompliance?.compliant?.toString() || '0',
      item.slaCompliance?.total?.toString() || '0',
      item.slaCompliance?.percentage?.toString() || '0',
    ]);
  }

  // Build CSV content
  csvContent = headers.join(',') + '\n';
  rows.forEach((row) => {
    csvContent += row.map((cell) => `"${cell}"`).join(',') + '\n';
  });

  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateReportFilename = (
  reportType: string,
  groupBy: string,
  timeRange: string
): string => {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${reportType}-report-${groupBy}-${timeRange}-${timestamp}.csv`;
};
