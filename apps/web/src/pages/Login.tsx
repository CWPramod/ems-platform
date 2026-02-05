// Professional Login Page — Dark Blue Theme
// Enterprise-grade login with CANARIS branding
// apps/web/src/pages/Login.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Space, Divider, Alert } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import CanarisLogo from '../components/CanarisLogo';

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError(null);

    const success = await login(values.username, values.password);

    if (success) {
      navigate('/');
    } else {
      setError('Invalid username or password');
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #071222 0%, #0a1628 30%, #0f2035 60%, #162d4a 100%)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow effects */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '10%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(30,136,229,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '15%',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(30,136,229,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <Card
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(15, 32, 53, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(30, 58, 95, 0.6)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(30,136,229,0.1)',
          borderRadius: '16px',
        }}
      >
        {/* Logo & Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <CanarisLogo size="lg" />
          </div>
          <Title level={4} style={{ margin: 0, color: '#8ba3c1', fontWeight: 400, letterSpacing: '0.5px' }}>
            Enterprise Management System
          </Title>
        </div>

        <Divider style={{ borderColor: '#1e3a5f' }} />

        {/* Login Form */}
        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          autoComplete="off"
        >
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: '24px' }}
            />
          )}

          <Form.Item
            label={<span style={{ color: '#8ba3c1' }}>Username</span>}
            name="username"
            rules={[
              { required: true, message: 'Please input your username!' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#1e88e5' }} />}
              placeholder="Enter your username"
              autoComplete="username"
              style={{
                background: '#0a1628',
                borderColor: '#1e3a5f',
                color: '#e6edf5',
              }}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: '#8ba3c1' }}>Password</span>}
            name="password"
            rules={[
              { required: true, message: 'Please input your password!' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#1e88e5' }} />}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                background: '#0a1628',
                borderColor: '#1e3a5f',
                color: '#e6edf5',
              }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<LoginOutlined />}
              block
              style={{
                height: '45px',
                fontSize: '16px',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #1e88e5, #1565c0)',
                border: 'none',
                borderRadius: '8px',
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ borderColor: '#1e3a5f' }} />

        {/* Demo Credentials */}
        <div style={{ textAlign: 'center' }}>
          <Space direction="vertical" size="small">
            <Text style={{ fontSize: '12px', color: '#5c7a99' }}>
              Demo Credentials:
            </Text>
            <Text code style={{ fontSize: '12px', background: '#0a1628', color: '#8ba3c1', borderColor: '#1e3a5f' }}>
              Username: admin | Password: Admin@123456
            </Text>
          </Space>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Text style={{ fontSize: '12px', color: '#3d5a7a' }}>
            &copy; 2026 CANARIS. All rights reserved.
          </Text>
        </div>
      </Card>
    </div>
  );
}
