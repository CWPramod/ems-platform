import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Drawer,
  Steps,
  Form,
  Input,
  InputNumber,
  Button,
  Progress,
  Table,
  Tag,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ImportOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiService } from '../services/apiService';

const { Text } = Typography;

interface NetworkScanDrawerProps {
  visible: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

interface DiscoveredDevice {
  ip: string;
  hostname: string;
  type: string;
  vendor: string;
  model: string;
  osVersion: string;
  snmpReachable: boolean;
  icmpReachable: boolean;
  openPorts: number[];
  responseTimeMs: number;
  macAddress: string;
}

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;

const DEVICE_TYPE_COLORS: Record<string, string> = {
  router: 'blue',
  switch: 'cyan',
  firewall: 'red',
  server: 'green',
  access_point: 'purple',
  printer: 'orange',
  unknown: 'default',
};

export default function NetworkScanDrawer({
  visible,
  onClose,
  onImportComplete,
}: NetworkScanDrawerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [scanId, setScanId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [totalIPs, setTotalIPs] = useState(0);
  const [scannedIPs, setScannedIPs] = useState(0);
  const [devicesFound, setDevicesFound] = useState(0);
  const [results, setResults] = useState<DiscoveredDevice[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [scanning, setScanning] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [form] = Form.useForm();
  const [importForm] = Form.useForm();

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const resetState = useCallback(() => {
    stopPolling();
    setCurrentStep(0);
    setScanId(null);
    setProgress(0);
    setTotalIPs(0);
    setScannedIPs(0);
    setDevicesFound(0);
    setResults([]);
    setSelectedRowKeys([]);
    setImporting(false);
    setScanning(false);
    form.resetFields();
    importForm.resetFields();
  }, [stopPolling, form, importForm]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const fetchResults = async (id: string) => {
    try {
      const response = await apiService.getScanResults(id);
      const data = response?.data || response;
      const devices: DiscoveredDevice[] = Array.isArray(data) ? data : data?.data || [];
      setResults(devices);
      // Pre-select all devices
      setSelectedRowKeys(devices.map((d: DiscoveredDevice) => d.ip));
    } catch (error: any) {
      message.error('Failed to fetch scan results');
    }
  };

  const pollScanStatus = useCallback(
    (id: string) => {
      const poll = async () => {
        try {
          const response = await apiService.getScanStatus(id);
          const status = response?.data || response;

          setProgress(status.progress || 0);
          setTotalIPs(status.totalIPs || 0);
          setScannedIPs(status.scannedIPs || 0);
          setDevicesFound(status.devicesFound || 0);

          if (status.status === 'completed') {
            stopPolling();
            setScanning(false);
            setCurrentStep(2);
            await fetchResults(id);
            message.success(
              `Scan complete! ${status.devicesFound || 0} device(s) discovered.`
            );
          } else if (status.status === 'failed' || status.status === 'error') {
            stopPolling();
            setScanning(false);
            message.error('Scan failed. Please try again.');
            setCurrentStep(0);
          }
        } catch (error: any) {
          stopPolling();
          setScanning(false);
          message.error('Failed to get scan status');
        }
      };

      // Poll immediately, then every 2 seconds
      poll();
      pollingRef.current = setInterval(poll, 2000);
    },
    [stopPolling]
  );

  const handleStartScan = async () => {
    try {
      const values = await form.validateFields();
      setScanning(true);
      setCurrentStep(1);
      setProgress(0);
      setScannedIPs(0);
      setDevicesFound(0);

      const params: any = {
        startIp: values.startIp,
        endIp: values.endIp,
      };
      if (values.snmpCommunity) {
        params.snmpCommunity = values.snmpCommunity;
      }
      if (values.timeout) {
        params.timeout = values.timeout;
      }

      const response = await apiService.startNetworkScan(params);
      const data = response?.data || response;
      const newScanId = data.scanId;

      if (!newScanId) {
        message.error('No scan ID returned from server');
        setScanning(false);
        setCurrentStep(0);
        return;
      }

      setScanId(newScanId);
      message.info(data.message || 'Scan started');
      pollScanStatus(newScanId);
    } catch (error: any) {
      if (error?.errorFields) {
        // Form validation error -- do nothing, form shows inline errors
        setCurrentStep(0);
        setScanning(false);
        return;
      }
      const msg =
        error?.response?.data?.message || error?.message || 'Failed to start scan';
      message.error(msg);
      setScanning(false);
      setCurrentStep(0);
    }
  };

  const handleImport = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select at least one device to import');
      return;
    }

    if (!scanId) {
      message.error('No scan ID available');
      return;
    }

    try {
      const importValues = await importForm.validateFields();
      setImporting(true);

      const payload: any = {
        deviceIPs: selectedRowKeys,
      };
      if (importValues.tier) {
        payload.tier = importValues.tier;
      }
      if (importValues.location) {
        payload.location = importValues.location;
      }

      const response = await apiService.importDiscoveredDevices(scanId, payload);
      const data = response?.data || response;

      const imported = data.imported || 0;
      const skipped = data.skipped || 0;
      const errors = data.errors || 0;

      if (imported > 0) {
        message.success(
          `Successfully imported ${imported} device(s)` +
            (skipped > 0 ? `, ${skipped} skipped` : '') +
            (errors > 0 ? `, ${errors} error(s)` : '')
        );
      } else if (skipped > 0) {
        message.warning(`All ${skipped} device(s) were skipped (already exist)`);
      } else {
        message.info('No devices were imported');
      }

      if (onImportComplete) {
        onImportComplete();
      }

      handleClose();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      const msg =
        error?.response?.data?.message || error?.message || 'Import failed';
      message.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const columns: ColumnsType<DiscoveredDevice> = [
    {
      title: 'IP Address',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (ip: string) => (
        <Text code style={{ fontFamily: 'monospace' }}>
          {ip}
        </Text>
      ),
    },
    {
      title: 'Hostname',
      dataIndex: 'hostname',
      key: 'hostname',
      width: 150,
      ellipsis: true,
      render: (hostname: string) => hostname || '-',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type: string) => (
        <Tag color={DEVICE_TYPE_COLORS[type?.toLowerCase()] || 'default'}>
          {type || 'unknown'}
        </Tag>
      ),
    },
    {
      title: 'Vendor',
      dataIndex: 'vendor',
      key: 'vendor',
      width: 100,
      ellipsis: true,
      render: (vendor: string) => vendor || '-',
    },
    {
      title: 'Model',
      dataIndex: 'model',
      key: 'model',
      width: 110,
      ellipsis: true,
      render: (model: string) => model || '-',
    },
    {
      title: 'OS Version',
      dataIndex: 'osVersion',
      key: 'osVersion',
      width: 110,
      ellipsis: true,
      render: (os: string) => os || '-',
    },
    {
      title: 'SNMP',
      dataIndex: 'snmpReachable',
      key: 'snmpReachable',
      width: 70,
      align: 'center',
      render: (reachable: boolean) =>
        reachable ? (
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
        ) : (
          <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
        ),
    },
    {
      title: 'Response (ms)',
      dataIndex: 'responseTimeMs',
      key: 'responseTimeMs',
      width: 110,
      align: 'right',
      render: (ms: number) =>
        ms != null ? (
          <Text type={ms > 200 ? 'warning' : undefined}>{ms}</Text>
        ) : (
          '-'
        ),
    },
    {
      title: 'Open Ports',
      dataIndex: 'openPorts',
      key: 'openPorts',
      width: 160,
      render: (ports: number[]) =>
        ports && ports.length > 0 ? (
          <Space size={2} wrap>
            {ports.map((port: number) => (
              <Tag key={port} style={{ margin: 1 }}>
                {port}
              </Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: 'MAC Address',
      dataIndex: 'macAddress',
      key: 'macAddress',
      width: 150,
      render: (mac: string) =>
        mac ? (
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{mac}</Text>
        ) : (
          '-'
        ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys as string[]);
    },
  };

  // --- Step content renderers ---

  const renderScanForm = () => (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ timeout: 5000 }}
      style={{ maxWidth: 500, margin: '24px auto 0' }}
    >
      <Form.Item
        name="startIp"
        label="Start IP Address"
        rules={[
          { required: true, message: 'Start IP is required' },
          {
            pattern: IPV4_REGEX,
            message: 'Please enter a valid IPv4 address',
          },
        ]}
      >
        <Input placeholder="e.g. 192.168.1.1" />
      </Form.Item>

      <Form.Item
        name="endIp"
        label="End IP Address"
        rules={[
          { required: true, message: 'End IP is required' },
          {
            pattern: IPV4_REGEX,
            message: 'Please enter a valid IPv4 address',
          },
        ]}
      >
        <Input placeholder="e.g. 192.168.1.254" />
      </Form.Item>

      <Form.Item
        name="snmpCommunity"
        label="SNMP Community String (optional)"
      >
        <Input.Password placeholder="e.g. public" />
      </Form.Item>

      <Form.Item
        name="timeout"
        label="Timeout (ms, optional)"
      >
        <InputNumber
          min={500}
          max={30000}
          step={500}
          style={{ width: '100%' }}
          placeholder="5000"
        />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={handleStartScan}
          loading={scanning}
          block
          size="large"
        >
          Start Scan
        </Button>
      </Form.Item>
    </Form>
  );

  const renderScanProgress = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
        padding: '40px 24px',
      }}
    >
      <LoadingOutlined style={{ fontSize: 48, marginBottom: 24, color: '#1668dc' }} />
      <Progress
        percent={progress}
        status="active"
        style={{ width: '100%', maxWidth: 400, marginBottom: 16 }}
      />
      <Text style={{ fontSize: 16, marginBottom: 8 }}>
        Scanning {scannedIPs} of {totalIPs} IPs...
      </Text>
      <Text type="secondary">
        {devicesFound} device(s) found so far
      </Text>
      <Button
        style={{ marginTop: 24 }}
        onClick={handleClose}
      >
        Cancel
      </Button>
    </div>
  );

  const renderResults = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 15 }}>
          {results.length} device(s) discovered
        </Text>
      </div>

      <Table
        rowKey="ip"
        columns={columns}
        dataSource={results}
        rowSelection={rowSelection}
        size="small"
        scroll={{ x: 1200, y: 360 }}
        pagination={
          results.length > 50
            ? { pageSize: 50, showSizeChanger: false }
            : false
        }
      />

      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: '1px solid #303030',
          borderRadius: 8,
        }}
      >
        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
          Import Settings
        </Text>
        <Form
          form={importForm}
          layout="inline"
          initialValues={{ tier: 3 }}
          style={{ flexWrap: 'wrap', gap: 8 }}
        >
          <Form.Item name="tier" label="Tier">
            <Select style={{ width: 80 }}>
              <Select.Option value={1}>1</Select.Option>
              <Select.Option value={2}>2</Select.Option>
              <Select.Option value={3}>3</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="location" label="Location">
            <Input placeholder="e.g. DC-Mumbai-1" style={{ width: 180 }} />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              icon={<ImportOutlined />}
              onClick={handleImport}
              loading={importing}
              disabled={selectedRowKeys.length === 0}
            >
              Import Selected ({selectedRowKeys.length})
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );

  const stepItems = [
    { title: 'Configure' },
    { title: 'Scanning' },
    { title: 'Results' },
  ];

  return (
    <Drawer
      title="Network Discovery Scan"
      placement="right"
      width={800}
      open={visible}
      onClose={handleClose}
      destroyOnClose
    >
      <Steps
        current={currentStep}
        items={stepItems}
        style={{ marginBottom: 32 }}
      />

      {currentStep === 0 && renderScanForm()}
      {currentStep === 1 && renderScanProgress()}
      {currentStep === 2 && renderResults()}
    </Drawer>
  );
}
