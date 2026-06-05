# Shared Auth Frontend Library

Standardized authentication components and utilities for all Statex frontend applications.

## Installation

```bash
# In your frontend project (from statex repo)
# Example: from statex-website/frontend
npm install ../../../shared/auth-frontend
# or
yarn add ../../../shared/auth-frontend
```

## Usage

### 1. Setup AuthProvider

Wrap your app with `AuthProvider`:

```tsx
import { AuthProvider } from '@statex/shared-auth-frontend';

function App() {
  return (
    <AuthProvider authServiceUrl="https://auth.alfares.cz">
      {/* Your app */}
    </AuthProvider>
  );
}
```

### 2. Use Login Form

```tsx
import { LoginForm } from '@statex/shared-auth-frontend';
import { useRouter } from 'next/navigation'; // or react-router

function LoginPage() {
  const router = useRouter();

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1>Login</h1>
      <LoginForm
        onSuccess={() => router.push('/dashboard')}
        registerLinkPath="/register"
      />
    </div>
  );
}
```

### 3. Use Register Form

```tsx
import { RegisterForm } from '@statex/shared-auth-frontend';

function RegisterPage() {
  return (
    <div className="max-w-md mx-auto mt-8">
      <h1>Register</h1>
      <RegisterForm
        onSuccess={() => router.push('/dashboard')}
        loginLinkPath="/login"
      />
    </div>
  );
}
```

### 4. Use Auth Button

```tsx
import { AuthButton } from '@statex/shared-auth-frontend';

function Header() {
  return (
    <header>
      <AuthButton
        loginPath="/login"
        logoutRedirect="/"
        showUserInfo={true}
      />
    </header>
  );
}
```

### 5. Use Auth Hook

```tsx
import { useAuth } from '@statex/shared-auth-frontend';

function ProtectedComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please login</div>;
  }

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Environment Variables

Set in your `.env`:

```bash
NEXT_PUBLIC_AUTH_SERVICE_URL=https://auth.alfares.cz
# or for React apps
REACT_APP_AUTH_SERVICE_URL=https://auth.alfares.cz
```

## Features

- ✅ Standardized login/register forms
- ✅ JWT token management
- ✅ Automatic token refresh
- ✅ Auth context and hooks
- ✅ TypeScript support
- ✅ Works with Next.js and React

## Customization

All components accept `className` props for styling customization. The default styles use Tailwind CSS classes but can be overridden.
