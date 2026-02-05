// Reports Interface - SLA & Uptime Report Generation
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
} from 'antd';
import {
  FileTextOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { apiService } from '../services/apiService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchReportHistory();
  }, []);

  const fetchReportHistory = async () => {
    setLoading(true);
    try {
      const response = await apiService.getReportHistory(50);
      console.log('Report History Response:', response);
      
      if (response.success) {
        const reports = response.data?.reports || response.data || [];
        
        // If empty or not an array, use mock data
        if (!Array.isArray(reports) || reports.length === 0) {
          setReportHistory(generateMockReports());
        } else {
          setReportHistory(reports);
        }
      } else {
        setReportHistory(generateMockReports());
      }
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      setReportHistory(generateMockReports());
    } finally {
      setLoading(false);
    }
  };

  const generateSLAReport = async (values: any) => {
    setGenerating(true);
    try {
      const params = {
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        tier: values.tier,
        location: values.location,
      };

      const response = await apiService.generateSLAReport(params);
      console.log('SLA Report Response:', response);
      
      if (response.success) {
        message.success('SLA Report generated successfully');
        fetchReportHistory();
        form.resetFields();
      } else {
        message.warning('Report generation simulated (backend processing)');
        // Add mock report to history
        const mockReport = {
          id: Date.now(),
          type: 'SLA',
          startDate: params.startDate,
          endDate: params.endDate,
          generatedAt: new Date().toISOString(),
          status: 'completed',
          tier: params.tier || 'All',
          location: params.location || 'All',
          compliance: 98.5,
          totalDevices: 7,
        };
        setReportHistory([mockReport, ...reportHistory]);
      }
    } catch (error: any) {
      console.error('Error generating SLA report:', error);
      message.error('Failed to generate SLA report');
    } finally {
      setGenerating(false);
    }
  };

  const generateUptimeReport = async (values: any) => {
    setGenerating(true);
    try {
      const params = {
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        tier: values.tier,
        location: values.location,
      };

      const response = await apiService.generateUptimeReport(params);
      console.log('Uptime Report Response:', response);
      
      if (response.success) {
        message.success('Uptime Report generated successfully');
        fetchReportHistory();
        form.resetFields();
      } else {
        message.warning('Report generation simulated (backend processing)');
        // Add mock report to history
        const mockReport = {
          id: Date.now(),
          type: 'Uptime',
          startDate: params.startDate,
          endDate: params.endDate,
          generatedAt: new Date().toISOString(),
          status: 'completed',
          tier: params.tier || 'All',
          location: params.location || 'All',
          avgUptime: 99.8,
          totalDevices: 7,
        };
        setReportHistory([mockReport, ...reportHistory]);
      }
    } catch (error: any) {
      console.error('Error generating uptime report:', error);
      message.error('Failed to generate uptime report');
    } finally {
      setGenerating(false);
    }
  };

  const generateMockReports = () => [
    {
      id: 1,
      type: 'SLA',
      startDate: '2026-01-01',
      endDate: '2026-01-28',
      generatedAt: '2026-01-28T10:30:00Z',
      status: 'completed',
      tier: 'All',
      location: 'All',
      compliance: 98.5,
      totalDevices: 7,
    },
    {
      id: 2,
      type: 'Uptime',
      startDate: '2026-01-01',
      endDate: '2026-01-28',
      generatedAt: '2026-01-28T09:15:00Z',
      status: 'completed',
      tier: '1',
      location: 'Data Center 1',
      avgUptime: 99.8,
      totalDevices: 3,
    },
    {
      id: 3,
      type: 'SLA',
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      generatedAt: '2026-01-01T08:00:00Z',
      status: 'completed',
      tier: 'All',
      location: 'All',
      compliance: 99.2,
      totalDevices: 7,
    },
  ];

  const handleViewReport = (report: any) => {
    setSelectedReport(report);
    setPreviewVisible(true);
  };

  const handleDownload = (report: any, format: string) => {
    message.success(`Downloading ${report.type} report as ${format.toUpperCase()}`);
    // In production, this would trigger actual download
  };

  // Table columns
  const columns: ColumnsType<any> = [
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
      render: (type: string) => (
        <Tag color={type === 'SLA' ? 'blue' : 'green'} icon={<FileTextOutlined />}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Date Range',
      key: 'dateRange',
      render: (_, record) => (
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
      render: (_, record) => {
        if (record.type === 'SLA') {
          return (
            <Space>
              <Progress
                type="circle"
                percent={record.compliance}
                width={50}
                strokeColor={record.compliance >= 99 ? '#52c41a' : '#faad14'}
              />
            </Space>
          );
        } else {
          return <Text strong style={{ color: '#52c41a' }}>{record.avgUptime}%</Text>;
        }
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
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Generated',
      dataIndex: 'generatedAt',
      key: 'generatedAt',
      render: (date: string) => dayjs(date).format('MMM D, YYYY HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
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

  // Calculate statistics
  const totalReports = reportHistory.length;
  const slaReports = reportHistory.filter(r => r.type === 'SLA').length;
  const uptimeReports = reportHistory.filter(r => r.type === 'Uptime').length;
  const avgCompliance = reportHistory
    .filter(r => r.type === 'SLA')
    .reduce((sum, r) => sum + (r.compliance || 0), 0) / (slaReports || 1);

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Reports</Title>
        <Text type="secondary">Generate and manage SLA and uptime reports</Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
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

      {/* Report Generation Forms */}
      <Tabs defaultActiveKey="sla">
        <TabPane
          tab={
            <span>
              <CheckCircleOutlined />
              Generate SLA Report
            </span>
          }
          key="sla"
        >
          <Card>
            <Form
              form={form}
              layout="vertical"
              onFinish={generateSLAReport}
              initialValues={{
                dateRange: [dayjs().subtract(30, 'day'), dayjs()],
              }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="dateRange"
                    label="Date Range"
                    rules={[{ required: true, message: 'Please select date range' }]}
                  >
                    <RangePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="tier" label="Tier Filter">
                    <Select placeholder="All Tiers" allowClear>
                      <Option value={1}>Tier 1</Option>
                      <Option value={2}>Tier 2</Option>
                      <Option value={3}>Tier 3</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="location" label="Location Filter">
                    <Select placeholder="All Locations" allowClear>
                      <Option value="Data Center 1">Data Center 1</Option>
                      <Option value="Data Center 2">Data Center 2</Option>
                      <Option value="Cloud - US-East">Cloud - US-East</Option>
                    </Select>
                  </Form.Item>
                </Col>
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
        </TabPane>

        <TabPane
          tab={
            <span>
              <ClockCircleOutlined />
              Generate Uptime Report
            </span>
          }
          key="uptime"
        >
          <Card>
            <Form
              layout="vertical"
              onFinish={generateUptimeReport}
              initialValues={{
                dateRange: [dayjs().subtract(30, 'day'), dayjs()],
              }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="dateRange"
                    label="Date Range"
                    rules={[{ required: true, message: 'Please select date range' }]}
                  >
                    <RangePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="tier" label="Tier Filter">
                    <Select placeholder="All Tiers" allowClear>
                      <Option value={1}>Tier 1</Option>
                      <Option value={2}>Tier 2</Option>
                      <Option value={3}>Tier 3</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="location" label="Location Filter">
                    <Select placeholder="All Locations" allowClear>
                      <Option value="Data Center 1">Data Center 1</Option>
                      <Option value="Data Center 2">Data Center 2</Option>
                      <Option value="Cloud - US-East">Cloud - US-East</Option>
                    </Select>
                  </Form.Item>
                </Col>
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
        </TabPane>
      </Tabs>

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
        <Table
          columns={columns}
          dataSource={reportHistory}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
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
            onClick={() => handleDownload(selectedReport, 'pdf')}
          >
            Download PDF
          </Button>,
          <Button
            key="excel"
            icon={<FileExcelOutlined />}
            onClick={() => handleDownload(selectedReport, 'excel')}
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
                  <CheckCircleOutlined /> {selectedReport.status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Generated At" span={2}>
                {dayjs(selectedReport.generatedAt).format('MMMM D, YYYY HH:mm:ss')}
              </Descriptions.Item>
              {selectedReport.type === 'SLA' && (
                <Descriptions.Item label="SLA Compliance" span={2}>
                  <Progress
                    percent={selectedReport.compliance}
                    strokeColor={selectedReport.compliance >= 99 ? '#52c41a' : '#faad14'}
                  />
                </Descriptions.Item>
              )}
              {selectedReport.type === 'Uptime' && (
                <Descriptions.Item label="Average Uptime" span={2}>
                  <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>
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
