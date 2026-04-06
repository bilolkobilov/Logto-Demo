# Logto Demo Projects

This repository has two authentication demos:

## 1) central-auth
Multi-app SSO setup.

- `main-app` is the central auth server (Logto integration).
- `client-app/app-one` and `client-app/app-two` are client apps.
- Users can sign in once and access both client apps.
- Logout is coordinated through the main app.

Simple logic used:
- Event-driven auth checks (on page load and when tab/window becomes active).
- No continuous interval polling to avoid refresh loops.
- Session/cookie based auth state.

## 2) single-auth
Single app with direct Logto login.

- One app handles its own login and dashboard.
- No cross-app SSO flow.

Simple logic used:
- Standard Logto sign-in/sign-out flow.
- Session-based user state in one app.

## Environment and security
- API keys/secrets are stored in `.env` files.
- Use `.env.example` as a template.
