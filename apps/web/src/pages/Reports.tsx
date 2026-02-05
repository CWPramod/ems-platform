// Reports Interface - SLA, Uptime, Performance & Traffic Report Generation
// apps/web/src/pages/Reports.tsx

import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  DatePicker,
  Select,
  Form,
  message,
  Tabs,
  Divider,
  Progress,
  Modal,
  Descriptions,
  Alert,
  Empty,
} from 'antd';
import {
  FileTextOutlined,
  // DownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  // CloseCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  BarChartOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { apiService } from '../services/apiService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface ReportResult {
  reportType: string;
  generatedAt: string;
  parameters: Record<string, any>;
  summary?: Record<string, any>;
  data: any[];
  rowCount: number;
}

const DEVICE_TYPE_OPTIONS = [
  { value: 'router', label: 'Router' },
  { value: 'switch', label: 'Switch' },
  { value: 'firewall', label: 'Firewall' },
  { value: 'server', label: 'Server' },
  { value: 'load_balancer', label: 'Load Balancer' },
  { value: 'application', label: 'Application' },
];

const TIER_OPTIONS = [
  { value: 1, label: 'Tier 1' },
  { value: 2, label: 'Tier 2' },
  { value: 3, label: 'Tier 3' },
];

const LOCATION_OPTIONS = [
  { value: 'Data Center 1', label: 'Data Center 1' },
  { value: 'Data Center 2', label: 'Data Center 2' },
  { value: 'Cloud - US-East', label: 'Cloud - US-East' },
];

function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatNumber(val: any, decimals: number = 2): string {
  if (val === null || val === undefined) return '-';
  const num = Number(val);
  if (isNaN(num)) return '-';
  return num.toFixed(decimals);
}

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [lastGeneratedReport, setLastGeneratedReport] = useState<ReportResult | null>(null);
  const [slaForm] = Form.useForm();
  const [uptimeForm] = Form.useForm();
  const [performanceForm] = Form.useForm();
  const [trafficForm] = Form.useForm();

  useEffect(() => {
    fetchReportHistory();
  }, []);

  const fetchReportHistory = async () => {
    setLoading(true);
    try {
      const response = await apiService.getReportHistory(50);
      if (response.success) {
        const reports = response.data?.reports || response.data || [];
        if (Array.isArray(reports)) {
          setReportHistory(reports);
        } else {
          setReportHistory([]);
        }
      } else {
        setReportHistory([]);
      }
    } catch {
      setReportHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const generateSLAReport = async (values: any) => {
    setGenerating(true);
    setLastGeneratedReport(null);
    try {
      const params = {
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        tier: values.tier,
        location: values.location,
      };

      const response = await apiService.generateSLAReport(params);
      if (response.success) {
        message.success('SLA Report generated successfully');
        if (response.data) {
          setLastGeneratedReport(response.data);
        }
        fetchReportHistory();
        slaForm.resetFields();
      } else {
        message.warning('Report generation returned no data');
      }
    } catch {
      message.error('Failed to generate SLA report');
    } finally {
      setGenerating(false);
    }
  };

  const generateUptimeReport = async (values: any) => {
    setGenerating(true);
    setLastGeneratedReport(null);
    try {
      const params = {
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        tier: values.tier,
        location: values.location,
      };

      const response = await apiService.generateUptimeReport(params);
      if (response.success) {
        message.success('Uptime Report generated successfully');
        if (response.data) {
          setLastGeneratedReport(response.data);
        }
        fetchReportHistory();
        uptimeForm.resetFields();
      } else {
        message.warning('Report generation returned no data');
      }
    } catch {
      message.error('Failed to generate uptime report');
    } finally {
      setGenerating(false);
    }
  };

  const generatePerformanceReport = async (values: any) => {
    setGenerating(true);
    setLastGeneratedReport(null);
    try {
      const params = {
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        tier: values.tier,
        location: values.location,
        deviceType: values.deviceType,
      };

      const response = await apiService.generatePerformanceReport(params);
      if (response.success) {
        message.success('Performance Report generated successfully');
        if (response.data) {
          setLastGeneratedReport(response.data);
        }
        fetchReportHistory();
        performanceForm.resetFields();
      } else {
        message.warning('Report generation returned no data');
      }
    } catch {
      message.error('Failed to generate performance report');
    } finally {
      setGenerating(false);
    }
  };

  const generateTrafficReport = async (values: any) => {
    setGenerating(true);
    setLastGeneratedReport(null);
    try {
      const params = {
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        tier: values.tier,
        location: values.location,
        deviceType: values.deviceType,
      };

      const response = await apiService.generateTrafficReport(params);
      if (response.success) {
        message.success('Traffic Report generated successfully');
        if (response.data) {
          setLastGeneratedReport(response.data);
        }
        fetchReportHistory();
        trafficForm.resetFields();
      } else {
        message.warning('Report generation returned no data');
      }
    } catch {
      message.error('Failed to generate traffic report');
    } finally {
      setGenerating(false);
    }
  };

  const handleViewReport = (report: any) => {
    setSelectedReport(report);
    setPreviewVisible(true);
  };

  const handleDownload = (report: any, format: string) => {
    message.success(`Downloading ${report.type || report.reportType} report as ${format.toUpperCase()}`);
  };

  // --- Performance report result columns ---
  const performanceResultColumns: ColumnsType<any> = [
    {
      title: 'Device',
      dataIndex: 'device',
      key: 'device',
      fixed: 'left',
      width: 160,
      render: (val: string) => <Text strong>{val || '-'}</Text>,
    },
    {
      title: 'CPU Avg (%)',
      dataIndex: 'cpuAvg',
      key: 'cpuAvg',
      width: 100,
      render: (val: any) => formatNumber(val),
    },
    {
      title: 'CPU Max (%)',
      dataIndex: 'cpuMax',
      key: 'cpuMax',
      width: 100,
      render: (val: any) => formatNumber(val),
    },
    {
      title: 'Memory Avg (%)',
      dataIndex: 'memoryAvg',
      key: 'memoryAvg',
      width: 110,
      render: (val: any) => formatNumber(val),
    },
    {
      title: 'Memory Max (%)',
      dataIndex: 'memoryMax',
      key: 'memoryMax',
      width: 110,
      render: (val: any) => formatNumber(val),
    },
    {
      title: 'Disk Avg (%)',
      dataIndex: 'diskAvg',
      key: 'diskAvg',
      width: 100,
      render: (val: any) => formatNumber(val),
    },
    {
      title: 'Disk Max (%)',
      dataIndex: 'diskMax',
      key: 'diskMax',
      width: 100,
      render: (val: any) => formatNumber(val),
    },
    {
      title: 'BW In Avg',
      dataIndex: 'bandwidthInAvg',
      key: 'bandwidthInAvg',
      width: 110,
      render: (val: any) => formatBytes(Number(val) || 0),
    },
    {
      title: 'BW In Max',
      dataIndex: 'bandwidthInMax',
      key: 'bandwidthInMax',
      width: 110,
      render: (val: any) => formatBytes(Number(val) || 0),
    },
    {
      title: 'BW Out Avg',
      dataIndex: 'bandwidthOutAvg',
      key: 'bandwidthOutAvg',
      width: 110,
      render: (val: any) => formatBytes(Number(val) || 0),
    },
    {
      title: 'BW Out Max',
      dataIndex: 'bandwidthOutMax',
      key: 'bandwidthOutMax',
      width: 110,
      render: (val: any) => formatBytes(Number(val) || 0),
    },
    {
      title: 'Data Points',
      dataIndex: 'dataPoints',
      key: 'dataPoints',
      width: 100,
    },
  ];

  // --- Traffic report result columns ---
  const trafficResultColumns: ColumnsType<any> = [
    {
      title: 'Device',
      dataIndex: 'device',
      key: 'device',
      fixed: 'left',
      width: 160,
      render: (val: string) => <Text strong>{val || '-'}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (val: string) => <Tag>{val || '-'}</Tag>,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 140,
    },
    {
      title: 'Bytes In',
      dataIndex: 'bytesIn',
      key: 'bytesIn',
      width: 110,
      render: (val: any) => formatBytes(Number(val) || 0),
    },
    {
      title: 'Bytes Out',
      dataIndex: 'bytesOut',
      key: 'bytesOut',
      width: 110,
      render: (val: any) => formatBytes(Number(val) || 0),
    },
    {
      title: 'Total (GB)',
      dataIndex: 'totalGB',
      key: 'totalGB',
      width: 100,
      render: (val: any) => formatNumber(val),
    },
    {
      title: 'Packets In',
      dataIndex: 'packetsIn',
      key: 'packetsIn',
      width: 110,
      render: (val: any) => (val != null ? Number(val).toLocaleString() : '-'),
    },
    {
      title: 'Packets Out',
      dataIndex: 'packetsOut',
      key: 'packetsOut',
      width: 110,
      render: (val: any) => (val != null ? Number(val).toLocaleString() : '-'),
    },
    {
      title: 'Flows',
      dataIndex: 'flows',
      key: 'flows',
      width: 80,
      render: (val: any) => (val != null ? Number(val).toLocaleString() : '-'),
    },
    {
      title: 'Protocols',
      dataIndex: 'protocols',
      key: 'protocols',
      width: 140,
      render: (val: any) => {
        if (!val) return '-';
        if (Array.isArray(val)) return val.join(', ');
        return String(val);
      },
    },
  ];

  // --- Report history table columns ---
  const historyColumns: ColumnsType<any> = [
    {
      title: 'Report ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: number) => <Text code>#{id}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          SLA: 'blue',
          Uptime: 'green',
          Performance: 'purple',
          Traffic: 'orange',
        };
        return (
          <Tag color={colorMap[type] || 'default'} icon={<FileTextOutlined />}>
            {type}
          </Tag>
        );
      },
    },
    {
      title: 'Date Range',
      key: 'dateRange',
      render: (_: any, record: any) => (
        <Text>
          {dayjs(record.startDate).format('MMM D, YYYY')} - {dayjs(record.endDate).format('MMM D, YYYY')}
        </Text>
      ),
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      render: (tier: string) => <Tag>{tier === 'All' ? 'All Tiers' : `Tier ${tier}`}</Tag>,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: 'Devices',
      dataIndex: 'totalDevices',
      key: 'totalDevices',
    },
    {
      title: 'Result',
      key: 'result',
      render: (_: any, record: any) => {
        if (record.type === 'SLA' && record.compliance != null) {
          return (
            <Progress
              type="circle"
              percent={record.compliance}
              size={50}
              strokeColor={record.compliance >= 99 ? '#52c41a' : '#faad14'}
            />
          );
        }
        if (record.type === 'Uptime' && record.avgUptime != null) {
          return <Text strong style={{ color: '#52c41a' }}>{record.avgUptime}%</Text>;
        }
        if (record.type === 'Performance') {
          return <Tag color="purple"><BarChartOutlined /> Performance</Tag>;
        }
        if (record.type === 'Traffic') {
          return <Tag color="orange"><SwapOutlined /> Traffic</Tag>;
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag
          icon={status === 'completed' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          color={status === 'completed' ? 'success' : 'processing'}
        >
          {status ? status.toUpperCase() : 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      title: 'Generated',
      dataIndex: 'generatedAt',
      key: 'generatedAt',
      render: (date: string) => date ? dayjs(date).format('MMM D, YYYY HH:mm') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewReport(record)}
          >
            View
          </Button>
          <Button
            type="link"
            icon={<FilePdfOutlined />}
            onClick={() => handleDownload(record, 'pdf')}
          >
            PDF
          </Button>
          <Button
            type="link"
            icon={<FileExcelOutlined />}
            onClick={() => handleDownload(record, 'excel')}
          >
            Excel
          </Button>
        </Space>
      ),
    },
  ];

  // --- Shared form fields renderer ---
  const renderBaseFormFields = () => (
    <>
      <Col xs={24} md={8}>
        <Form.Item
          name="dateRange"
          label="Date Range"
          rules={[{ required: true, message: 'Please select date range' }]}
        >
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} md={4}>
        <Form.Item name="tier" label="Tier Filter">
          <Select placeholder="All Tiers" allowClear options={TIER_OPTIONS} />
        </Form.Item>
      </Col>
      <Col xs={24} md={4}>
        <Form.Item name="location" label="Location Filter">
          <Select placeholder="All Locations" allowClear options={LOCATION_OPTIONS} />
        </Form.Item>
      </Col>
    </>
  );

  const renderDeviceTypeField = () => (
    <Col xs={24} md={4}>
      <Form.Item name="deviceType" label="Device Type">
        <Select placeholder="All Types" allowClear options={DEVICE_TYPE_OPTIONS} />
      </Form.Item>
    </Col>
  );

  // --- Generated report result panel ---
  const renderLastGeneratedReport = () => {
    if (!lastGeneratedReport) return null;

    const { reportType, generatedAt, data, rowCount, summary } = lastGeneratedReport;

    let resultTable = null;
    let summaryCards = null;

    if (reportType === 'performance' || reportType === 'Performance') {
      resultTable = (
        <Table
          columns={performanceResultColumns}
          dataSource={data || []}
          rowKey={(_, idx) => String(idx)}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1400 }}
          size="small"
        />
      );
    } else if (reportType === 'traffic' || reportType === 'Traffic') {
      if (summary) {
        summaryCards = (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="Total Devices"
                  value={summary.totalDevices ?? '-'}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="Total Bytes In"
                  value={formatBytes(Number(summary.totalBytesIn) || 0)}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="Total Bytes Out"
                  value={formatBytes(Number(summary.totalBytesOut) || 0)}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="Total Flows"
                  value={summary.totalFlows != null ? Number(summary.totalFlows).toLocaleString() : '-'}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>
        );
      }
      resultTable = (
        <Table
          columns={trafficResultColumns}
          dataSource={data || []}
          rowKey={(_, idx) => String(idx)}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1300 }}
          size="small"
        />
      );
    }

    return (
      <Card
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>
              Generated {reportType} Report — {rowCount} row{rowCount !== 1 ? 's' : ''}
            </span>
          </Space>
        }
        extra={
          <Text type="secondary">{dayjs(generatedAt).format('MMM D, YYYY HH:mm:ss')}</Text>
        }
        style={{ marginTop: 16 }}
      >
        {summaryCards}
        {resultTable ? (
          resultTable
        ) : (
          <Alert
            type="info"
            message={`Report generated with ${rowCount} record(s). View in report history for full details.`}
            showIcon
          />
        )}
      </Card>
    );
  };

  // --- Tab items (new API) ---
  const tabItems = [
    {
      key: 'sla',
      label: (
        <span>
          <CheckCircleOutlined /> Generate SLA Report
        </span>
      ),
      children: (
        <>
          <Card>
            <Form
              form={slaForm}
              layout="vertical"
              onFinish={generateSLAReport}
              initialValues={{
                dateRange: [dayjs().subtract(30, 'day'), dayjs()],
              }}
            >
              <Row gutter={16}>
                {renderBaseFormFields()}
              </Row>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<FileTextOutlined />}
                  loading={generating}
                  size="large"
                >
                  Generate SLA Report
                </Button>
              </Form.Item>
            </Form>
          </Card>
          {lastGeneratedReport &&
            (lastGeneratedReport.reportType === 'sla' || lastGeneratedReport.reportType === 'SLA') &&
            renderLastGeneratedReport()}
        </>
      ),
    },
    {
      key: 'uptime',
      label: (
        <span>
          <ClockCircleOutlined /> Generate Uptime Report
        </span>
      ),
      children: (
        <>
          <Card>
            <Form
              form={uptimeForm}
              layout="vertical"
              onFinish={generateUptimeReport}
              initialValues={{
                dateRange: [dayjs().subtract(30, 'day'), dayjs()],
              }}
            >
              <Row gutter={16}>
                {renderBaseFormFields()}
              </Row>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<ClockCircleOutlined />}
                  loading={generating}
                  size="large"
                >
                  Generate Uptime Report
                </Button>
              </Form.Item>
            </Form>
          </Card>
          {lastGeneratedReport &&
            (lastGeneratedReport.reportType === 'uptime' || lastGeneratedReport.reportType === 'Uptime') &&
            renderLastGeneratedReport()}
        </>
      ),
    },
    {
      key: 'performance',
      label: (
        <span>
          <BarChartOutlined /> Generate Performance Report
        </span>
      ),
      children: (
        <>
          <Card>
            <Form
              form={performanceForm}
              layout="vertical"
              onFinish={generatePerformanceReport}
              initialValues={{
                dateRange: [dayjs().subtract(30, 'day'), dayjs()],
              }}
            >
              <Row gutter={16}>
                {renderBaseFormFields()}
                {renderDeviceTypeField()}
              </Row>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<BarChartOutlined />}
                  loading={generating}
                  size="large"
                >
                  Generate Performance Report
                </Button>
              </Form.Item>
            </Form>
          </Card>
          {lastGeneratedReport &&
            (lastGeneratedReport.reportType === 'performance' || lastGeneratedReport.reportType === 'Performance') &&
            renderLastGeneratedReport()}
        </>
      ),
    },
    {
      key: 'traffic',
      label: (
        <span>
          <SwapOutlined /> Generate Traffic Report
        </span>
      ),
      children: (
        <>
          <Card>
            <Form
              form={trafficForm}
              layout="vertical"
              onFinish={generateTrafficReport}
              initialValues={{
                dateRange: [dayjs().subtract(30, 'day'), dayjs()],
              }}
            >
              <Row gutter={16}>
                {renderBaseFormFields()}
                {renderDeviceTypeField()}
              </Row>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SwapOutlined />}
                  loading={generating}
                  size="large"
                >
                  Generate Traffic Report
                </Button>
              </Form.Item>
            </Form>
          </Card>
          {lastGeneratedReport &&
            (lastGeneratedReport.reportType === 'traffic' || lastGeneratedReport.reportType === 'Traffic') &&
            renderLastGeneratedReport()}
        </>
      ),
    },
  ];

  // --- Calculate statistics ---
  const totalReports = reportHistory.length;
  const slaReports = reportHistory.filter(r => r.type === 'SLA').length;
  const uptimeReports = reportHistory.filter(r => r.type === 'Uptime').length;
  const avgCompliance = reportHistory
    .filter(r => r.type === 'SLA')
    .reduce((sum, r) => sum + (r.compliance || 0), 0) / (slaReports || 1);

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>Reports</Title>
        <Text type="secondary">
          Generate and manage SLA, uptime, performance, and traffic reports
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Reports"
              value={totalReports}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="SLA Reports"
              value={slaReports}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Uptime Reports"
              value={uptimeReports}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Avg SLA Compliance"
              value={avgCompliance.toFixed(1)}
              suffix="%"
              valueStyle={{ color: avgCompliance >= 99 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Report Generation Tabs */}
      <Tabs defaultActiveKey="sla" items={tabItems} />

      <Divider />

      {/* Report History */}
      <Card
        title="Report History"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchReportHistory} loading={loading}>
            Refresh
          </Button>
        }
      >
        {reportHistory.length === 0 && !loading ? (
          <Empty description="No reports generated yet. Use the tabs above to generate your first report." />
        ) : (
          <Table
            columns={historyColumns}
            dataSource={reportHistory}
            loading={loading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      {/* Report Preview Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            {selectedReport?.type} Report #{selectedReport?.id}
          </Space>
        }
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={700}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            Close
          </Button>,
          <Button
            key="pdf"
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={() => selectedReport && handleDownload(selectedReport, 'pdf')}
          >
            Download PDF
          </Button>,
          <Button
            key="excel"
            icon={<FileExcelOutlined />}
            onClick={() => selectedReport && handleDownload(selectedReport, 'excel')}
          >
            Download Excel
          </Button>,
        ]}
      >
        {selectedReport && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Report Type">{selectedReport.type}</Descriptions.Item>
              <Descriptions.Item label="Report ID">#{selectedReport.id}</Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {dayjs(selectedReport.startDate).format('MMMM D, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="End Date">
                {dayjs(selectedReport.endDate).format('MMMM D, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Tier Filter">{selectedReport.tier}</Descriptions.Item>
              <Descriptions.Item label="Location Filter">{selectedReport.location}</Descriptions.Item>
              <Descriptions.Item label="Total Devices">{selectedReport.totalDevices}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color="success">
                  <CheckCircleOutlined /> {selectedReport.status ? selectedReport.status.toUpperCase() : 'UNKNOWN'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Generated At" span={2}>
                {dayjs(selectedReport.generatedAt).format('MMMM D, YYYY HH:mm:ss')}
              </Descriptions.Item>
              {selectedReport.type === 'SLA' && selectedReport.compliance != null && (
                <Descriptions.Item label="SLA Compliance" span={2}>
                  <Progress
                    percent={selectedReport.compliance}
                    strokeColor={selectedReport.compliance >= 99 ? '#52c41a' : '#faad14'}
                  />
                </Descriptions.Item>
              )}
              {selectedReport.type === 'Uptime' && selectedReport.avgUptime != null && (
                <Descriptions.Item label="Average Uptime" span={2}>
                  <Text strong style={{ fontSize: 18, color: '#52c41a' }}>
                    {selectedReport.avgUptime}%
                  </Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}
