import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  message,
  Row,
  Col,
  Divider,
} from 'antd';
import { apiService } from '../services/apiService';

const { TextArea } = Input;

interface CustomerFormModalProps {
  visible: boolean;
  customer?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const customerTypeOptions = [
  { value: 'HO', label: 'Head Office' },
  { value: 'Branch', label: 'Branch' },
];

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  visible,
  customer,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [headOffices, setHeadOffices] = useState<any[]>([]);
  const [loadingHO, setLoadingHO] = useState(false);
  const [customerType, setCustomerType] = useState<string>('Branch');
  const isEdit = !!customer;

  // Load head offices when the modal opens
  useEffect(() => {
    if (visible) {
      fetchHeadOffices();
    }
  }, [visible]);

  // Populate form when editing
  useEffect(() => {
    if (visible) {
      if (customer) {
        const type = customer.customerType || 'Branch';
        setCustomerType(type);
        form.setFieldsValue({
          customerCode: customer.customerCode,
          customerName: customer.customerName,
          customerType: type,
          parentCustomerId: customer.parentCustomerId,
          contactPerson: customer.contactPerson,
          email: customer.email,
          phone: customer.phone,
          mobile: customer.mobile,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          country: customer.country || 'India',
          postalCode: customer.postalCode,
          industry: customer.industry,
          companySize: customer.companySize,
          notes: customer.notes,
        });
      } else {
        form.resetFields();
        setCustomerType('Branch');
        form.setFieldsValue({
          customerType: 'Branch',
          country: 'India',
        });
      }
    }
  }, [visible, customer, form]);

  const fetchHeadOffices = async () => {
    try {
      setLoadingHO(true);
      const data = await apiService.getHeadOffices();
      setHeadOffices(Array.isArray(data) ? data : data?.data || []);
    } catch {
      // Non-critical — the dropdown will just be empty
      setHeadOffices([]);
    } finally {
      setLoadingHO(false);
    }
  };

  const handleTypeChange = (value: string) => {
    setCustomerType(value);
    if (value === 'HO') {
      form.setFieldValue('parentCustomerId', undefined);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Remove parentCustomerId if type is HO
      if (values.customerType === 'HO') {
        delete values.parentCustomerId;
      }

      if (isEdit) {
        await apiService.updateCustomer(customer.id, values);
        message.success('Customer updated successfully');
      } else {
        await apiService.createCustomer(values);
        message.success('Customer created successfully');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      if (error?.errorFields) {
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
      title={isEdit ? 'Edit Customer' : 'Add Customer'}
      open={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={isEdit ? 'Update' : 'Create'}
      confirmLoading={loading}
      width={800}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        {/* ---- Basic Info ---- */}
        <Divider orientation="left" plain>
          Basic Information
        </Divider>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="customerCode"
              label="Customer Code"
              rules={[{ required: true, message: 'Please enter customer code' }]}
            >
              <Input placeholder="e.g. CUST-001" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="customerName"
              label="Customer Name"
              rules={[{ required: true, message: 'Please enter customer name' }]}
            >
              <Input placeholder="e.g. Acme Corp" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="customerType"
              label="Customer Type"
              rules={[{ required: true, message: 'Please select type' }]}
            >
              <Select
                options={customerTypeOptions}
                placeholder="Select type"
                onChange={handleTypeChange}
              />
            </Form.Item>
          </Col>
        </Row>

        {customerType === 'Branch' && (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="parentCustomerId"
                label="Parent Head Office"
              >
                <Select
                  placeholder="Select head office"
                  allowClear
                  loading={loadingHO}
                  options={headOffices.map((ho: any) => ({
                    value: ho.id,
                    label: `${ho.customerCode} - ${ho.customerName}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="industry" label="Industry">
              <Input placeholder="e.g. Telecom" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="companySize" label="Company Size">
              <Input placeholder="e.g. 500-1000" />
            </Form.Item>
          </Col>
        </Row>

        {/* ---- Contact ---- */}
        <Divider orientation="left" plain>
          Contact Details
        </Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="contactPerson" label="Contact Person">
              <Input placeholder="Full name" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input placeholder="email@example.com" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="phone" label="Phone">
              <Input placeholder="+91-XXXXXXXXXX" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="mobile" label="Mobile">
              <Input placeholder="+91-XXXXXXXXXX" />
            </Form.Item>
          </Col>
        </Row>

        {/* ---- Address ---- */}
        <Divider orientation="left" plain>
          Address
        </Divider>

        <Form.Item name="address" label="Address">
          <TextArea rows={2} placeholder="Street address" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="city" label="City">
              <Input placeholder="City" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="state" label="State">
              <Input placeholder="State" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="country" label="Country">
              <Input placeholder="Country" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="postalCode" label="Postal Code">
              <Input placeholder="Postal code" />
            </Form.Item>
          </Col>
        </Row>

        {/* ---- Notes ---- */}
        <Form.Item name="notes" label="Notes">
          <TextArea rows={3} placeholder="Additional notes..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CustomerFormModal;
