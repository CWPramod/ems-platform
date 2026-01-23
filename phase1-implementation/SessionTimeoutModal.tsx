// Session Timeout Warning Modal
// Displays warning when session is about to expire and auto-logs out
// apps/web/src/components/Auth/SessionTimeoutModal.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  LinearProgress,
  Box,
  Alert,
} from '@mui/material';
import { Warning, Timer } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { BRANDING } from '../../constants/branding';

interface SessionTimeoutModalProps {
  sessionTimeoutMinutes?: number;
  warningMinutes?: number;
  onSessionExtended?: () => void;
  onSessionExpired?: () => void;
}

const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  sessionTimeoutMinutes = BRANDING.session.timeoutMinutes,
  warningMinutes = BRANDING.session.warningMinutes,
  onSessionExtended,
  onSessionExpired,
}) => {
  const navigate = useNavigate();
  
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningMinutes * 60);
  const [extendingSession, setExtendingSession] = useState(false);

  const warningThresholdMs = warningMinutes * 60 * 1000;
  const sessionTimeoutMs = sessionTimeoutMinutes * 60 * 1000;

  /**
   * Handle session timeout (auto logout)
   */
  const handleSessionExpired = useCallback(async () => {
    setShowWarning(false);
    
    if (onSessionExpired) {
      onSessionExpired();
    }
    
    await authService.logout();
    navigate('/login');
  }, [navigate, onSessionExpired]);

  /**
   * Handle extend session
   */
  const handleExtendSession = async () => {
    setExtendingSession(true);
    
    try {
      await authService.refreshSession();
      authService.updateLastActivity();
      
      setShowWarning(false);
      setSecondsRemaining(warningMinutes * 60);
      
      if (onSessionExtended) {
        onSessionExtended();
      }
    } catch (error) {
      console.error('Failed to extend session:', error);
      await handleSessionExpired();
    } finally {
      setExtendingSession(false);
    }
  };

  /**
   * Handle logout manually
   */
  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  /**
   * Monitor session activity
   */
  useEffect(() => {
    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      authService.updateLastActivity();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, []);

  /**
   * Check session status periodically
   */
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const minutesSinceActivity = authService.getMinutesSinceLastActivity();
      const remainingMinutes = sessionTimeoutMinutes - minutesSinceActivity;

      // Show warning if within warning threshold
      if (remainingMinutes <= warningMinutes && remainingMinutes > 0) {
        setShowWarning(true);
        setSecondsRemaining(remainingMinutes * 60);
      }

      // Auto logout if session expired
      if (minutesSinceActivity >= sessionTimeoutMinutes) {
        handleSessionExpired();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }, [sessionTimeoutMinutes, warningMinutes, handleSessionExpired]);

  /**
   * Countdown timer for warning modal
   */
  useEffect(() => {
    if (!showWarning) return;

    const countdownInterval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          handleSessionExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [showWarning, handleSessionExpired]);

  /**
   * Format seconds to MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Calculate progress percentage
   */
  const progressPercentage = (secondsRemaining / (warningMinutes * 60)) * 100;

  if (!showWarning) {
    return null;
  }

  return (
    <Dialog
      open={showWarning}
      onClose={() => {}} // Prevent closing by clicking outside
      disableEscapeKeyDown
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Warning color="warning" fontSize="large" />
          <Typography variant="h6" component="span">
            Session Timeout Warning
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your session is about to expire due to inactivity
        </Alert>

        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
            <Timer fontSize="small" />
            <Typography variant="h4" component="div" color="warning.main">
              {formatTime(secondsRemaining)}
            </Typography>
          </Box>
          
          <Typography variant="body2" color="textSecondary">
            Time remaining before automatic logout
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={progressPercentage}
          color="warning"
          sx={{ height: 8, borderRadius: 4 }}
        />

        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          Would you like to extend your session?
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleLogout}
          color="inherit"
          disabled={extendingSession}
        >
          Logout Now
        </Button>
        <Button
          onClick={handleExtendSession}
          variant="contained"
          color="primary"
          disabled={extendingSession}
          autoFocus
          sx={{
            backgroundColor: BRANDING.colors.primary,
            '&:hover': {
              backgroundColor: BRANDING.colors.primaryDark,
            },
          }}
        >
          {extendingSession ? 'Extending...' : 'Continue Session'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionTimeoutModal;
