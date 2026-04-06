const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { handleAuthRoutes, withLogto } = require('@logto/express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(express.json());

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORS Configuration - Allow cross-port communication
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001'];
    
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
    }
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

const MAIN_APP_PORT = process.env.MAIN_APP_PORT || '3002';
const APP_ONE_PORT = process.env.APP_ONE_PORT || '3000';
const APP_TWO_PORT = process.env.APP_TWO_PORT || '3001';
const config = {
    appId: process.env.LOGTO_APP_ID || '',
    appSecret: process.env.LOGTO_APP_SECRET || '',
    endpoint: process.env.LOGTO_ENDPOINT || '',
    baseUrl: process.env.LOGTO_BASE_URL || `http://localhost:${MAIN_APP_PORT}`,
    scopes: ['email', 'profile'],
};

// Registered client apps — add more here as you scale
const CLIENT_APPS = {
    [APP_ONE_PORT]: `http://localhost:${APP_ONE_PORT}`,
    [APP_TWO_PORT]: `http://localhost:${APP_TWO_PORT}`,
};

function isLogtoConfigured() {
    const values = [config.appId, config.appSecret, config.endpoint].map((value) => (value || '').trim());

    if (values.some((value) => !value)) {
        return false;
    }

    const placeholderTokens = ['your-main-app-id', 'your-main-app-secret', 'your-logto-endpoint'];
    return !values.some((value) => placeholderTokens.some((token) => value.includes(token)));
}

const LOGTO_ENABLED = isLogtoConfigured();

function trackLoggedInApp(req, redirectTo) {
    const port = new URL(redirectTo).port;
    if (!req.session.loggedInApps) req.session.loggedInApps = [];
    if (!req.session.loggedInApps.includes(port)) {
        req.session.loggedInApps.push(port);
    }
}

app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'main-app-secret-key',
    resave: false,
    saveUninitialized: true, // Changed to true - required for Logto sign-in flow
    cookie: { 
        maxAge: 14 * 24 * 60 * 60 * 1000,
        httpOnly: false, // Allow JavaScript access for cross-origin requests
        sameSite: 'lax',
        secure: false // Set to true in production with HTTPS
    },
    name: 'main-app-session' // Explicit session name
}));

// ─── /auth-status ─────────────────────────────────────────────────────────────
// Endpoint for client apps to check if user is authenticated in Main App
// This enables cross-port SSO detection
// Returns true if ANY app has an active session (user is logged in somewhere)
app.get('/auth-status', (req, res) => {
    const loggedInApps = req.session.loggedInApps || [];
    const hasActiveSession = loggedInApps.length > 0;
    
    res.json({
        isAuthenticated: hasActiveSession,
        loggedInApps: loggedInApps,
        timestamp: Date.now()
    });
});

if (LOGTO_ENABLED) {
    app.use(handleAuthRoutes(config));
}

// ─── /auth ────────────────────────────────────────────────────────────────────
// App One and App Two hit this when user needs to log in
// ?redirectTo=http://localhost:3000/auth-success
if (LOGTO_ENABLED) {
    app.get('/auth', withLogto(config), (req, res) => {
        const redirectTo = req.query.redirectTo;

        if (!redirectTo) {
            return res.status(400).send('Missing redirectTo parameter');
        }

        if (req.user.isAuthenticated) {
            trackLoggedInApp(req, redirectTo);

            // Set cookie to enable auto-redirect on subsequent visits
            res.cookie('hasEverLoggedIn', 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 year

            const { sub: userId, email = '', username = '' } = req.user.claims;
            return res.redirect(
                `${redirectTo}?userId=${userId}&email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}`
            );
        }

        // Not logged in — save where to return after login
        req.session.redirectTo = redirectTo;
        return res.redirect('/logto/sign-in');
    });
} else {
    app.get('/auth', (req, res) => {
        const redirectTo = req.query.redirectTo;

        if (!redirectTo) {
            return res.status(400).send('Missing redirectTo parameter');
        }

        const appRoot = new URL(redirectTo).origin;
        return res.redirect(`${appRoot}/?authError=not_configured`);
    });
}

// ─── / ───────────────────────────────────────────────────────────────────────
// SDK redirects here after login (baseUrl = http://localhost:3002 = '/')
// Also where Logto redirects after logout (post_logout_redirect_uri)
if (LOGTO_ENABLED) {
    app.get('/', withLogto(config), async (req, res) => {
        const loginRedirect = req.session.redirectTo;
        const logoutFrom = req.cookies.logoutFrom;

        // ── Coming back after login ──
        if (req.user.isAuthenticated && loginRedirect) {
            trackLoggedInApp(req, loginRedirect);

            // Set cookie to enable auto-redirect on subsequent visits
            res.cookie('hasEverLoggedIn', 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 year

            const { sub: userId, email = '', username = '' } = req.user.claims;
            delete req.session.redirectTo;

            return res.redirect(
                `${loginRedirect}?userId=${userId}&email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}`
            );
        }

        // ── Coming back after logout ──
        if (logoutFrom) {
            res.clearCookie('logoutFrom');
            const redirectUrl = CLIENT_APPS[logoutFrom] || 'http://localhost:3000';
            return res.redirect(redirectUrl);
        }

        return res.send('Main App — Auth Server');
    });
} else {
    app.get('/', (req, res) => {
        const logoutFrom = req.cookies.logoutFrom;

        if (logoutFrom) {
            res.clearCookie('logoutFrom');
            const redirectUrl = CLIENT_APPS[logoutFrom] || 'http://localhost:3000';
            return res.redirect(redirectUrl);
        }

        return res.send('Main App — Local Auth Mode');
    });
}

// ─── /logout ──────────────────────────────────────────────────────────────────
// App One or App Two calls this when user clicks logout
// ?from=3000 or ?from=3001
app.get('/logout', async (req, res) => {
    const from = req.query.from;
    const loggedInApps = req.session.loggedInApps || [];
    const fromPort = String(from || '');
    const fromApp = CLIENT_APPS[fromPort] || 'http://localhost:3000';
    const shouldUseLogtoSignOut = isLogtoConfigured();

    // Clear hasEverLoggedIn cookie so next visit shows login button
    res.clearCookie('hasEverLoggedIn');

    // Save which app initiated logout only when using Logto sign-out redirect flow.
    if (shouldUseLogtoSignOut) {
        res.cookie('logoutFrom', fromPort, { maxAge: 60 * 1000 }); // 1 min
    }

    // Notify all logged-in apps to clear their sessions
    const clearPromises = loggedInApps.map(async (port) => {
        try {
            await fetch(`http://localhost:${port}/clear-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from }),
            });
            console.log(`[Main App] Cleared session on port ${port}`);
        } catch (err) {
            console.error(`[Main App] Failed to clear session on port ${port}:`, err.message);
        }
    });

    await Promise.all(clearPromises);

    req.session.destroy((err) => {
        if (err) {
            console.error('[Main App] Failed to destroy main-app session:', err);
        }

        if (shouldUseLogtoSignOut) {
            return res.redirect('/logto/sign-out');
        }

        return res.redirect(`${fromApp}/?loggedOut=1`);
    });
});

app.listen(Number(MAIN_APP_PORT), () => {
    console.log(`Main App running on http://localhost:${MAIN_APP_PORT}`);
});