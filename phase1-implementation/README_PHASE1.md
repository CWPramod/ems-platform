# Phase 1 Implementation Guide - Enhanced Authentication & RBAC

## 📋 Overview

This folder contains all the files needed to implement **Phase 1** of the EMS Platform NMS upgrade:
- Enhanced Authentication (password policies, session management)
- Role-Based Access Control (RBAC)
- CANARIS Branding

**Timeline:** Weeks 1-3  
**Created:** January 23, 2026

---

## 📁 Files Included

### Backend Files (NestJS)

1. **Database Migrations:**
   - `001_add_enhanced_auth_tables.sql` - Auth tables (password history, sessions, audit log)
   - `002_add_rbac_tables.sql` - RBAC tables (roles, permissions, mappings)

2. **Services:**
   - `password-policy.service.ts` - Password validation and strength checking
   - `session-manager.service.ts` - Session creation, validation, cleanup
   - `rbac.service.ts` - Permission checking and role management

3. **Controllers:**
   - `auth.controller.ts` - Enhanced auth endpoints (login, logout, password change)

4. **Guards & Decorators:**
   - `rbac.guard.ts` - Permission-based route protection
   - `rbac.decorators.ts` - Custom decorators (@Permissions, @AdminOnly, etc.)

### Frontend Files (React)

5. **Branding:**
   - `branding.ts` - Central branding configuration
   - `canaris-logo.jpg` - CANARIS logo file

6. **Components:**
   - `LoginPage.tsx` - Enhanced login page with branding
   - `LoginPage.css` - Login page styles
   - `SessionTimeoutModal.tsx` - Session timeout warning component

7. **Services:**
   - `auth.service.ts` - Frontend authentication API client

8. **Documentation:**
   - `README_PHASE1.md` - This file

---

## 🚀 Installation Instructions

### Step 1: Database Migrations

Run the SQL migrations in order:

```bash
# Navigate to your EMS Platform directory
cd /path/to/ems-platform

# Run migration 1 - Enhanced Auth Tables
psql -U your_username -d ems_platform -f phase1-implementation/001_add_enhanced_auth_tables.sql

# Run migration 2 - RBAC Tables
psql -U your_username -d ems_platform -f phase1-implementation/002_add_rbac_tables.sql

# Verify tables were created
psql -U your_username -d ems_platform -c "\dt"
```

**Expected new tables:**
- `password_history`
- `user_sessions`
- `login_audit_log`
- `password_policies`
- `roles`
- `permissions`
- `role_permissions`
- `user_permissions`

### Step 2: Backend Integration

#### 2.1 Copy Service Files

```bash
# Copy services to auth module
cp phase1-implementation/password-policy.service.ts apps/api/src/auth/
cp phase1-implementation/session-manager.service.ts apps/api/src/auth/
cp phase1-implementation/auth.controller.ts apps/api/src/auth/

# Create RBAC module directory
mkdir -p apps/api/src/rbac/guards
mkdir -p apps/api/src/rbac/decorators

# Copy RBAC files
cp phase1-implementation/rbac.service.ts apps/api/src/rbac/
cp phase1-implementation/rbac.guard.ts apps/api/src/rbac/guards/
cp phase1-implementation/rbac.decorators.ts apps/api/src/rbac/decorators/
```

#### 2.2 Update Auth Module

Edit `apps/api/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordPolicyService } from './password-policy.service';
import { SessionManagerService } from './session-manager.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      'User',
      'PasswordHistory',
      'UserSession',
      'LoginAuditLog',
      'PasswordPolicy',
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordPolicyService, SessionManagerService],
  exports: [AuthService, PasswordPolicyService, SessionManagerService],
})
export class AuthModule {}
```

#### 2.3 Create RBAC Module

Create `apps/api/src/rbac/rbac.module.ts`:

```typescript
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacService } from './rbac.service';
import { RbacGuard, AdminGuard } from './guards/rbac.guard';

@Global() // Make RBAC available everywhere
@Module({
  imports: [
    TypeOrmModule.forFeature([
      'Role',
      'Permission',
      'RolePermission',
      'UserPermission',
      'User',
    ]),
  ],
  providers: [RbacService, RbacGuard, AdminGuard],
  exports: [RbacService, RbacGuard, AdminGuard],
})
export class RbacModule {}
```

#### 2.4 Register RBAC Module in App Module

Edit `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { RbacModule } from './rbac/rbac.module';
// ... other imports

@Module({
  imports: [
    // ... other modules
    RbacModule, // Add this
  ],
})
export class AppModule {}
```

#### 2.5 Install Required Dependencies

```bash
# Navigate to API directory
cd apps/api

# Install dependencies if not already installed
npm install bcrypt
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @nestjs/schedule # For cron jobs
npm install @nestjs/config # For environment variables

# Install types
npm install --save-dev @types/bcrypt @types/passport-jwt
```

### Step 3: Frontend Integration

#### 3.1 Copy Frontend Files

```bash
# Create directories
mkdir -p apps/web/src/constants
mkdir -p apps/web/src/pages/Auth
mkdir -p apps/web/src/services
mkdir -p apps/web/src/components/Auth
mkdir -p apps/web/public/assets/logos

# Copy branding
cp phase1-implementation/branding.ts apps/web/src/constants/
cp phase1-implementation/canaris-logo.jpg apps/web/public/assets/logos/

# Copy components
cp phase1-implementation/LoginPage.tsx apps/web/src/pages/Auth/
cp phase1-implementation/LoginPage.css apps/web/src/pages/Auth/
cp phase1-implementation/SessionTimeoutModal.tsx apps/web/src/components/Auth/

# Copy services
cp phase1-implementation/auth.service.ts apps/web/src/services/
```

#### 3.2 Install Frontend Dependencies

```bash
# Navigate to web directory
cd apps/web

# Install Material-UI if not already installed
npm install @mui/material @emotion/react @emotion/styled
npm install @mui/icons-material
npm install axios
npm install react-router-dom
```

#### 3.3 Update App.tsx

Update `apps/web/src/App.tsx` to include the login route and session timeout:

```typescript
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Auth/LoginPage';
import SessionTimeoutModal from './components/Auth/SessionTimeoutModal';
import Dashboard from './pages/Dashboard';
import { authService } from './services/auth.service';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = authService.isAuthenticated();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      {children}
      <SessionTimeoutModal />
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

#### 3.4 Update Environment Variables

Create or update `apps/web/.env`:

```env
REACT_APP_API_URL=http://localhost:3000
```

### Step 4: Using RBAC in Controllers

Here are examples of how to use the RBAC system in your controllers:

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RbacGuard, AdminGuard } from './rbac/guards/rbac.guard';
import { Permissions, AdminOnly, CurrentUser, UserId } from './rbac/decorators/rbac.decorators';

@Controller('api/v1/devices')
@UseGuards(JwtAuthGuard) // Require authentication
export class DevicesController {
  
  // Everyone can view devices
  @Get()
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async getAllDevices() {
    // ...
  }

  // Only users with device:create permission can add devices
  @Post()
  @Permissions('device:create')
  @UseGuards(RbacGuard)
  async createDevice(@CurrentUser() user: any) {
    // user object contains userId, username, email, role
  }

  // Only admins can delete devices
  @Delete(':id')
  @AdminOnly()
  @UseGuards(AdminGuard)
  async deleteDevice(@UserId() userId: number) {
    // Only admins reach here
  }

  // Multiple permissions (user must have ALL)
  @Post('configure')
  @Permissions('device:update', 'nms:config:manage')
  @UseGuards(RbacGuard)
  async configureDevice() {
    // User must have both permissions
  }
}
```

### Step 5: Testing the Implementation

#### 5.1 Start Backend

```bash
cd apps/api
npm run start:dev
```

#### 5.2 Start Frontend

```bash
cd apps/web
npm start
```

#### 5.3 Test Login

1. Navigate to `http://localhost:3000/login`
2. You should see:
   - CANARIS logo
   - Professional login form
   - Copyright message at bottom
3. Try logging in with existing credentials

#### 5.4 Test Password Validation

The system will now enforce:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

#### 5.5 Test Session Timeout

1. Login successfully
2. Leave the application idle for 25 minutes
3. At 25 minutes, you should see a session timeout warning modal
4. You'll have 5 minutes to extend or logout

#### 5.6 Test RBAC

Try accessing protected routes:
- Admin user should access all features
- Regular user should be blocked from admin functions

---

## 🔐 Default Roles & Permissions

### Admin Role
- **Full access** to all features
- Can manage users
- Can configure system settings
- Can access remote terminals
- Can run discovery
- Can manage configurations

### User Role
- **Read-only** access to most features
- Can view dashboards, reports, graphs
- Can export reports
- Can acknowledge alerts
- **Cannot** add/edit/delete devices
- **Cannot** configure thresholds
- **Cannot** manage users
- **Cannot** access remote terminals

---

## 📊 Database Verification

Verify the implementation with these queries:

```sql
-- Check roles
SELECT * FROM roles;

-- Check permissions count
SELECT COUNT(*) FROM permissions;

-- Check role-permission mappings
SELECT r.name AS role, COUNT(rp.permission_id) AS permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.name;

-- Check user roles
SELECT u.username, r.name AS role
FROM users u
JOIN roles r ON u.role_id = r.id;

-- Check session timeout policy
SELECT * FROM password_policies WHERE is_active = TRUE;
```

---

## 🎨 Customizing Branding

To customize the CANARIS branding:

1. **Update Logo:**
   - Replace `apps/web/public/assets/logos/canaris-logo.jpg`

2. **Update Colors:**
   - Edit `apps/web/src/constants/branding.ts`
   - Change the `colors.primary` value

3. **Update Copyright:**
   - Edit `apps/web/src/constants/branding.ts`
   - Change `copyrightYear` and `copyrightText`

---

## 🛠️ Troubleshooting

### Issue: Database migration fails

**Solution:**
- Check PostgreSQL connection
- Verify database name is correct
- Ensure you have proper permissions

### Issue: Login fails with 500 error

**Solution:**
- Check if all tables were created
- Verify JWT_SECRET is set in environment variables
- Check backend logs for specific error

### Issue: Session timeout doesn't work

**Solution:**
- Verify SessionTimeoutModal is included in App.tsx
- Check browser console for JavaScript errors
- Ensure cookies are enabled in browser

### Issue: RBAC permissions not working

**Solution:**
- Verify RbacModule is imported in AppModule
- Check if user has a role assigned
- Verify role-permission mappings in database

---

## 📝 Next Steps

After completing Phase 1, you should:

1. ✅ Test all authentication flows
2. ✅ Verify RBAC is working correctly
3. ✅ Ensure CANARIS branding appears everywhere
4. ✅ Test session timeout on different browsers
5. ✅ Document any issues found

**Then proceed to Phase 2:** Masters Module Implementation

---

## 🆘 Support

If you encounter issues:
1. Check the implementation plan: `EMS_NMS_IMPLEMENTATION_PLAN.md`
2. Review backend logs: `apps/api/logs`
3. Check browser console for frontend errors
4. Verify all dependencies are installed

---

## ✅ Checklist

Use this checklist to ensure Phase 1 is complete:

- [ ] Database migrations executed successfully
- [ ] All backend services copied and integrated
- [ ] RBAC module created and registered
- [ ] Frontend components copied
- [ ] Dependencies installed (backend & frontend)
- [ ] Environment variables configured
- [ ] Login page shows CANARIS logo
- [ ] Password validation working
- [ ] Session timeout warning appears
- [ ] Admin can access all features
- [ ] User has limited access
- [ ] Copyright message appears on login
- [ ] All tests passing

---

**Phase 1 Implementation Complete!** 🎉

You now have:
- ✅ Enhanced authentication with password policies
- ✅ Session management with auto-logout
- ✅ Role-based access control (Admin/User)
- ✅ CANARIS branding throughout the platform

Ready to move to **Phase 2: Masters Module**!

---

**Created by:** Claude + Pramod  
**Date:** January 23, 2026  
**Phase:** 1 of 6
