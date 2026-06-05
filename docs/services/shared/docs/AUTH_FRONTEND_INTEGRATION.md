# Frontend Auth Integration Guide

## Adding Login/Register to All Frontends

**Last Updated**: 2026-02-18

---

## 📋 Overview

This guide explains how to add standardized login/register functionality to all frontend applications in the Statex ecosystem.

---

## 🎯 Integration Approaches

### Approach 1: React/Next.js Apps (Recommended)

Use the shared `@statex/shared-auth-frontend` library.

**Apps**: `beauty/frontend`, `crypto-ai-agent/frontend`, `flipflop-service/services/frontend`, `allegro-service/services/frontend`, etc.

### Approach 2: Vanilla HTML/JS Apps

Use direct API calls to `auth-microservice`.

**Apps**: `shop-assistant/public/*.html`

---

## 🚀 React/Next.js Integration

### Step 1: Install Shared Library

```bash
# Option 1: Link local package (development)
cd statex/shared/auth-frontend
npm install
npm run build

# In your frontend project (from statex app: ../../../shared/auth-frontend; from other: ../../statex/shared/auth-frontend)
npm install ../../statex/shared/auth-frontend

# Option 2: Publish to npm (production)
# (Future: publish to private npm registry)
```

### Step 2: Setup AuthProvider

```tsx
// app.tsx or _app.tsx or main.tsx
import { AuthProvider } from '@statex/shared-auth-frontend';

function App() {
  return (
    <AuthProvider authServiceUrl={process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}>
      {/* Your app */}
    </AuthProvider>
  );
}
```

### Step 3: Create Login Page

```tsx
// pages/login.tsx or app/login/page.tsx
import { LoginForm } from '@statex/shared-auth-frontend';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Login</h1>
        <LoginForm
          onSuccess={() => router.push('/dashboard')}
          registerLinkPath="/register"
        />
      </div>
    </div>
  );
}
```

### Step 4: Create Register Page

```tsx
// pages/register.tsx or app/register/page.tsx
import { RegisterForm } from '@statex/shared-auth-frontend';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Register</h1>
        <RegisterForm
          onSuccess={() => router.push('/dashboard')}
          loginLinkPath="/login"
        />
      </div>
    </div>
  );
}
```

### Step 5: Add Auth Button to Header

```tsx
// components/Header.tsx
import { AuthButton } from '@statex/shared-auth-frontend';

export function Header() {
  return (
    <header>
      <nav>
        {/* Your nav items */}
        <AuthButton
          loginPath="/login"
          logoutRedirect="/"
          showUserInfo={true}
        />
      </nav>
    </header>
  );
}
```

### Step 6: Protect Routes

```tsx
// components/ProtectedRoute.tsx
import { useAuth } from '@statex/shared-auth-frontend';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

---

## 📄 Vanilla HTML/JS Integration

For apps like `shop-assistant` that use static HTML files.

### Step 1: Create Login Page

```html
<!-- public/login.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Login - Shop Assistant</title>
  <style>
    /* Add your styles */
  </style>
</head>
<body>
  <div class="login-container">
    <h1>Login</h1>
    <form id="login-form">
      <div>
        <label for="email">Email</label>
        <input type="email" id="email" required>
      </div>
      <div>
        <label for="password">Password</label>
        <input type="password" id="password" required>
      </div>
      <div id="error-message" style="color: red; display: none;"></div>
      <button type="submit">Login</button>
      <p><a href="register.html">Don't have an account? Register</a></p>
    </form>
  </div>

  <script>
    const AUTH_SERVICE_URL = 'https://auth.alfares.cz'; // or from env

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error-message');

      try {
        const response = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Login failed');
        }

        const data = await response.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Redirect
        window.location.href = '/';
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
      }
    });
  </script>
</body>
</html>
```

### Step 2: Create Register Page

```html
<!-- public/register.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Register - Shop Assistant</title>
</head>
<body>
  <div class="register-container">
    <h1>Register</h1>
    <form id="register-form">
      <div>
        <label for="email">Email *</label>
        <input type="email" id="email" required>
      </div>
      <div>
        <label for="firstName">First Name</label>
        <input type="text" id="firstName">
      </div>
      <div>
        <label for="lastName">Last Name</label>
        <input type="text" id="lastName">
      </div>
      <div>
        <label for="password">Password *</label>
        <input type="password" id="password" required minlength="8">
      </div>
      <div>
        <label for="confirmPassword">Confirm Password *</label>
        <input type="password" id="confirmPassword" required minlength="8">
      </div>
      <div id="error-message" style="color: red; display: none;"></div>
      <button type="submit">Register</button>
      <p><a href="login.html">Already have an account? Login</a></p>
    </form>
  </div>

  <script>
    const AUTH_SERVICE_URL = 'https://auth.alfares.cz';

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const errorDiv = document.getElementById('error-message');

      if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.style.display = 'block';
        return;
      }

      try {
        const response = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value,
            password,
            firstName: document.getElementById('firstName').value || undefined,
            lastName: document.getElementById('lastName').value || undefined,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Registration failed');
        }

        const data = await response.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        window.location.href = '/';
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
      }
    });
  </script>
</body>
</html>
```

### Step 3: Add Auth Button to Existing Pages

```html
<!-- Add to index.html, test.html, etc. -->
<nav>
  <!-- Your existing nav -->
  <div id="auth-buttons">
    <a href="login.html" id="login-link" style="display: none;">Login</a>
    <span id="user-info" style="display: none;"></span>
    <button id="logout-btn" style="display: none;">Logout</button>
  </div>
</nav>

<script>
  // Check auth status
  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (token && user) {
    document.getElementById('login-link').style.display = 'none';
    document.getElementById('user-info').textContent = user.email;
    document.getElementById('user-info').style.display = 'inline';
    document.getElementById('logout-btn').style.display = 'inline';
  } else {
    document.getElementById('login-link').style.display = 'inline';
  }

  // Logout handler
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.reload();
  });
</script>
```

---

## 🔧 Environment Variables

Add to your frontend `.env`:

```bash
# For Next.js
NEXT_PUBLIC_AUTH_SERVICE_URL=https://auth.alfares.cz

# For React (Create React App)
REACT_APP_AUTH_SERVICE_URL=https://auth.alfares.cz

# For vanilla JS (set in script or use default)
# AUTH_SERVICE_URL=https://auth.alfares.cz
```

---

## 📝 Checklist for Each Frontend

- [ ] Install/link shared auth library (React/Next.js) OR create vanilla auth pages (HTML/JS)
- [ ] Add `AuthProvider` wrapper (React/Next.js)
- [ ] Create `/login` page/route
- [ ] Create `/register` page/route
- [ ] Add auth button to header/navigation
- [ ] Add protected route wrapper (if needed)
- [ ] Set `AUTH_SERVICE_URL` environment variable
- [ ] Test login flow
- [ ] Test register flow
- [ ] Test logout flow
- [ ] Test token refresh (automatic)

---

## 🎨 Styling

The shared components use Tailwind CSS classes by default. For vanilla HTML, use your existing styles or add Tailwind CSS.

**Customization**: All React components accept `className` prop for custom styling.

---

## 🔗 API Endpoints Used

- `POST /auth/login` - Login
- `POST /auth/register` - Register
- `POST /auth/refresh` - Refresh token
- `GET /auth/profile` - Get user profile
- `POST /auth/validate` - Validate token

---

## 📚 Related Documentation

- [RBAC Usage Guide](./RBAC_USAGE_GUIDE.md)
- [Auth Microservice README](../auth-microservice/README.md)
- [Shared Auth Frontend README](../statex/shared/auth-frontend/README.md)

---

**Last Updated**: 2026-02-18
