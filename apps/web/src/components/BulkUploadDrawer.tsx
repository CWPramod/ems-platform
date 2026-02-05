import React, { useState } from 'react';
import {
  Drawer,
  Upload,
  Button,
  Table,
  Space,
  message,
  Typography,
  Alert,
  Divider,
  Tag,
} from 'antd';
import {
  InboxOutlined,
  DownloadOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile, ColumnsType } from 'antd/es/upload/interface';
import { apiService } from '../services/apiService';

const { Title, Text } = Typography;
const { Dragger } = Upload;

interface BulkUploadDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PreviewRow {
  key: number;
  name: string;
  type: string;
  ip: string;
  location: string;
  vendor: string;
  model: string;
  tier: string;
  owner: string;
  department: string;
  tags: string;
  monitoring_enabled: string;
}

interface UploadResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
}

const TEMPLATE_HEADERS = [
  'name',
  'type',
  'ip',
  'location',
  'vendor',
  'model',
  'tier',
  'owner',
  'department',
  'tags',
  'monitoring_enabled',
];

const TEMPLATE_SAMPLE_ROW = [
  'core-router-01',
  'router',
  '192.168.1.1',
  'DC-Mumbai-1',
  'Cisco',
  'Catalyst 9300',
  '1',
  'Network Team',
  'IT Operations',
  'production;core',
  'true',
];

const BulkUploadDrawer: React.FC<BulkUploadDrawerProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleDownloadTemplate = () => {
    const csvContent = [
      TEMPLATE_HEADERS.join(','),
      TEMPLATE_SAMPLE_ROW.join(','),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'device_upload_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): PreviewRow[] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows: PreviewRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: any = { key: i };
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row as PreviewRow);
    }

    return rows;
  };

  const parseJSON = (text: string): PreviewRow[] => {
    try {
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : data.devices || [];
      return items.map((item: any, idx: number) => ({
        key: idx + 1,
        name: item.name || '',
        type: item.type || '',
        ip: item.ip || '',
        location: item.location || '',
        vendor: item.vendor || '',
        model: item.model || '',
        tier: String(item.tier || ''),
        owner: item.owner || '',
        department: item.department || '',
        tags: Array.isArray(item.tags) ? item.tags.join('; ') : item.tags || '',
        monitoring_enabled: String(
          item.monitoring_enabled ?? item.monitoringEnabled ?? 'true'
        ),
      }));
    } catch {
      message.error('Invalid JSON file');
      return [];
    }
  };

  const handleFileChange = (info: any) => {
    const file = info.file as File;
    if (!file) return;

    // Only keep the latest file
    setFileList([info.file]);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const fileName = (file.name || '').toLowerCase();
      let rows: PreviewRow[];

      if (fileName.endsWith('.json')) {
        rows = parseJSON(text);
      } else {
        rows = parseCSV(text);
      }

      setPreviewData(rows);
      if (rows.length > 0) {
        message.success(`Parsed ${rows.length} device(s) from file`);
      } else {
        message.warning('No data rows found in file');
      }
    };

    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('Please select a file first');
      return;
    }

    const file = fileList[0]?.originFileObj || fileList[0];
    if (!file) {
      message.warning('No file selected');
      return;
    }

    setUploading(true);
    try {
      const result = await apiService.bulkUploadDevices(file as File);
      const data = result?.data || result;
      setUploadResult({
        created: data.created || 0,
        errors: data.errors || [],
      });

      if (data.created > 0) {
        message.success(`Successfully created ${data.created} device(s)`);
        onSuccess();
      }

      if (data.errors && data.errors.length > 0) {
        message.warning(`${data.errors.length} row(s) had errors`);
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Upload failed';
      message.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFileList([]);
    setPreviewData([]);
    setUploadResult(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const previewColumns: ColumnsType<PreviewRow> = [
    { title: '#', dataIndex: 'key', width: 50 },
    { title: 'Name', dataIndex: 'name', width: 140 },
    { title: 'Type', dataIndex: 'type', width: 100 },
    { title: 'IP', dataIndex: 'ip', width: 130 },
    { title: 'Location', dataIndex: 'location', width: 120 },
    { title: 'Vendor', dataIndex: 'vendor', width: 100 },
    { title: 'Tier', dataIndex: 'tier', width: 60 },
    { title: 'Owner', dataIndex: 'owner', width: 120 },
  ];

  return (
    <Drawer
      title="Bulk Device Upload"
      placement="right"
      width={640}
      open={visible}
      onClose={handleClose}
      extra={
        <Space>
          <Button onClick={handleReset}>Reset</Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleUpload}
            loading={uploading}
            disabled={previewData.length === 0}
          >
            Upload
          </Button>
        </Space>
      }
    >
      {/* Download Template */}
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownloadTemplate}
        >
          Download CSV Template
        </Button>
        <Text
          type="secondary"
          style={{ marginLeft: 12, fontSize: 12 }}
        >
          Supports .csv and .json files
        </Text>
      </div>

      {/* File Dragger */}
      <Dragger
        accept=".csv,.json"
        multiple={false}
        fileList={fileList}
        beforeUpload={() => false}
        onChange={handleFileChange}
        onRemove={() => {
          handleReset();
          return true;
        }}
        style={{ marginBottom: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Click or drag a CSV / JSON file here
        </p>
        <p className="ant-upload-hint">
          Upload a file containing device records. Use the template for the
          expected format.
        </p>
      </Dragger>

      {/* Upload Result */}
      {uploadResult && (
        <div style={{ marginBottom: 16 }}>
          <Alert
            type={uploadResult.errors.length > 0 ? 'warning' : 'success'}
            showIcon
            icon={
              uploadResult.errors.length > 0 ? (
                <CloseCircleOutlined />
              ) : (
                <CheckCircleOutlined />
              )
            }
            message={
              <Space direction="vertical" size={4}>
                <Text>
                  <Tag color="green">{uploadResult.created}</Tag> device(s)
                  created successfully
                </Text>
                {uploadResult.errors.length > 0 && (
                  <Text>
                    <Tag color="red">{uploadResult.errors.length}</Tag> row(s)
                    had errors
                  </Text>
                )}
              </Space>
            }
            description={
              uploadResult.errors.length > 0 ? (
                <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 8 }}>
                  {uploadResult.errors.map((err, idx) => (
                    <div key={idx} style={{ fontSize: 12 }}>
                      <Text type="danger">
                        Row {err.row}: {err.message}
                      </Text>
                    </div>
                  ))}
                </div>
              ) : undefined
            }
          />
        </div>
      )}

      {/* Preview Table */}
      {previewData.length > 0 && (
        <>
          <Divider orientation="left" plain>
            Preview ({previewData.length} row{previewData.length !== 1 ? 's' : ''})
          </Divider>
          <Table
            columns={previewColumns}
            dataSource={previewData}
            size="small"
            scroll={{ x: 800, y: 360 }}
            pagination={
              previewData.length > 50
                ? { pageSize: 50, showSizeChanger: false }
                : false
            }
          />
        </>
      )}
    </Drawer>
  );
};

export default BulkUploadDrawer;
