// Enhanced Login Page Component
// Login page with CANARIS branding, password validation, and session management
// apps/web/src/pages/Auth/LoginPage.tsx

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Link as MuiLink,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  PersonOutline,
  LockOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { BRANDING, getCopyrightText, getLogoPath } from '../../constants/branding';
import { authService } from '../../services/auth.service';
import './LoginPage.css';

interface LoginFormData {
  username: string;
  password: string;
}

interface LoginError {
  message: string;
  accountLocked?: boolean;
  lockedUntil?: string;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(prev => !prev);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.username || !formData.password) {
      setError({ message: 'Please enter both username and password' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authService.login(formData.username, formData.password);

      if (response.success) {
        // Store user info
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('accessToken', response.accessToken);
        
        // Check if password change is forced
        if (response.forcePasswordChange) {
          navigate('/change-password');
        } else {
          // Navigate to dashboard
          navigate('/dashboard');
        }
      } else {
        setError({
          message: response.message || 'Login failed',
          accountLocked: response.accountLocked,
          lockedUntil: response.lockedUntil,
        });
      }
    } catch (err: any) {
      setError({
        message: err.message || 'An error occurred during login. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="login-container">
      {/* Background gradient */}
      <Box className="login-background" />
      
      {/* Login Card */}
      <Card className="login-card" elevation={8}>
        <CardContent className="login-card-content">
          {/* Logo */}
          <Box className="login-logo-container">
            <img
              src={getLogoPath('main')}
              alt={`${BRANDING.companyName} Logo`}
              className="login-logo"
            />
          </Box>

          {/* Welcome Text */}
          <Typography variant="h5" className="login-welcome-text">
            Sign in to start your session
          </Typography>

          {/* Product Name */}
          <Typography variant="body2" className="login-product-name" color="textSecondary">
            {BRANDING.fullProductName}
          </Typography>

          {/* Error Alert */}
          {error && (
            <Alert 
              severity={error.accountLocked ? 'error' : 'warning'} 
              className="login-error-alert"
              onClose={() => setError(null)}
            >
              {error.message}
              {error.accountLocked && error.lockedUntil && (
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Account locked until: {new Date(error.lockedUntil).toLocaleString()}
                </Typography>
              )}
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {/* Username Field */}
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              variant="outlined"
              margin="normal"
              autoComplete="username"
              autoFocus
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutline />
                  </InputAdornment>
                ),
              }}
            />

            {/* Password Field */}
            <TextField
              fullWidth
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              variant="outlined"
              margin="normal"
              autoComplete="current-password"
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleTogglePassword}
                      edge="end"
                      disabled={loading}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Forgot Password Link */}
            <Box className="login-forgot-password">
              <MuiLink href="/forgot-password" variant="body2">
                Forgot password?
              </MuiLink>
            </Box>

            {/* Login Button */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={loading}
              className="login-button"
              sx={{
                mt: 3,
                mb: 2,
                height: 48,
                backgroundColor: BRANDING.colors.primary,
                '&:hover': {
                  backgroundColor: BRANDING.colors.primaryDark,
                },
              }}
            >
              {loading ? (
                <>
                  <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Copyright Footer */}
          <Box className="login-copyright">
            <Typography variant="caption" color="textSecondary">
              {getCopyrightText()}
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
              {BRANDING.versionLabel}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Bottom Info */}
      <Box className="login-bottom-info">
        <Typography variant="body2" color="textSecondary">
          Need help? Contact{' '}
          <MuiLink href={`mailto:${BRANDING.contact.supportEmail}`}>
            {BRANDING.contact.supportEmail}
          </MuiLink>
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginPage;
