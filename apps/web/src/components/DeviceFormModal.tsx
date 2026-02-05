import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Row,
  Col,
} from 'antd';
import { apiService } from '../services/apiService';

interface DeviceFormModalProps {
  visible: boolean;
  device?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const deviceTypes = [
  { value: 'router', label: 'Router' },
  { value: 'switch', label: 'Switch' },
  { value: 'firewall', label: 'Firewall' },
  { value: 'load_balancer', label: 'Load Balancer' },
  { value: 'server', label: 'Server' },
  { value: 'vm', label: 'Virtual Machine' },
  { value: 'container', label: 'Container' },
];

const tierOptions = [
  { value: 1, label: 'Tier 1 - Critical' },
  { value: 2, label: 'Tier 2 - Important' },
  { value: 3, label: 'Tier 3 - Standard' },
];

const ipPattern =
  /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

const DeviceFormModal: React.FC<DeviceFormModalProps> = ({
  visible,
  device,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const isEdit = !!device;

  useEffect(() => {
    if (visible) {
      if (device) {
        form.setFieldsValue({
          name: device.name,
          type: device.type,
          ip: device.ip,
          location: device.location,
          region: device.region,
          vendor: device.vendor,
          model: device.model,
          tier: device.tier,
          owner: device.owner,
          department: device.department,
          tags: device.tags || [],
          monitoringEnabled:
            device.monitoringEnabled !== undefined
              ? device.monitoringEnabled
              : true,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          tier: 3,
          monitoringEnabled: true,
        });
      }
    }
  }, [visible, device, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isEdit) {
        await apiService.updateDevice(device.id, values);
        message.success('Device updated successfully');
      } else {
        await apiService.createDevice(values);
        message.success('Device created successfully');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      if (error?.errorFields) {
        // Validation error — form will show inline messages
        return;
      }
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'An error occurred';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Device' : 'Add Device'}
      open={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={isEdit ? 'Update' : 'Create'}
      confirmLoading={loading}
      width={720}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="Device Name"
              rules={[{ required: true, message: 'Please enter device name' }]}
            >
              <Input placeholder="e.g. core-router-01" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="type"
              label="Device Type"
              rules={[{ required: true, message: 'Please select device type' }]}
            >
              <Select options={deviceTypes} placeholder="Select type" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="ip"
              label="IP Address"
              rules={[
                { required: true, message: 'Please enter IP address' },
                {
                  pattern: ipPattern,
                  message: 'Please enter a valid IPv4 address',
                },
              ]}
            >
              <Input placeholder="e.g. 192.168.1.1" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="location"
              label="Location"
              rules={[{ required: true, message: 'Please enter location' }]}
            >
              <Input placeholder="e.g. DC-Mumbai-1" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="region"
              label="Region"
            >
              <Input placeholder="e.g. Asia-Pacific" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="vendor"
              label="Vendor / Make"
              rules={[{ required: true, message: 'Please enter vendor' }]}
            >
              <Input placeholder="e.g. Cisco" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="model"
              label="Model"
            >
              <Input placeholder="e.g. Catalyst 9300" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="tier"
              label="Tier"
              rules={[{ required: true, message: 'Please select tier' }]}
            >
              <Select options={tierOptions} placeholder="Select tier" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="owner"
              label="Owner"
              rules={[{ required: true, message: 'Please enter owner' }]}
            >
              <Input placeholder="e.g. Network Team" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="department"
              label="Department"
            >
              <Input placeholder="e.g. IT Operations" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="tags"
              label="Tags"
            >
              <Select
                mode="tags"
                placeholder="Add tags (press Enter to add)"
                tokenSeparators={[',']}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="monitoringEnabled"
              label="Monitoring Enabled"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default DeviceFormModal;
