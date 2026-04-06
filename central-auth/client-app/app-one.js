const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());
app.use(session({
    secret: 'app-one-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 14 * 24 * 60 * 60 * 1000 },
}));

const MAIN_APP = 'http://localhost:3002';
const APP_NAME = 'App One';
const APP_COLOR = '#6366f1'; // indigo
const PORT = 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
// Check local session on every request
function checkSession(req, res, next) {
    req.isLoggedIn = !!req.session.user;
    next();
}
app.use(checkSession);

// ─── / ───────────────────────────────────────────────────────────────────────
// If session exists go to dashboard
// If no session: check hasEverLoggedIn cookie
//   - if true: auto-redirect to main-app (SSO behavior)
//   - if false: show login button (first time or after logout)
app.get('/', (req, res) => {
    if (req.isLoggedIn) {
        return res.render('dashboard', {
            appName: APP_NAME,
            appColor: APP_COLOR,
            port: PORT,
            user: req.session.user,
        });
    }

    if (req.query.authError === 'not_configured') {
        return res.render('index', {
            appName: APP_NAME,
            appColor: APP_COLOR,
            port: PORT,
            isAuthUnavailable: true,
        });
    }

    if (req.query.loggedOut === '1') {
        return res.render('index', {
            appName: APP_NAME,
            appColor: APP_COLOR,
            port: PORT,
            isLoggedOut: true,
        });
    }

    // Check if user has ever logged in (cookie set by main-app)
    const hasEverLoggedIn = req.cookies.hasEverLoggedIn === 'true';

    if (hasEverLoggedIn) {
        // User has logged in before - auto-redirect to check Logto session (SSO)
        const returnUrl = `http://localhost:${PORT}/auth-success`;
        return res.redirect(`${MAIN_APP}/auth?redirectTo=${encodeURIComponent(returnUrl)}`);
    }

    // First time visit or after logout - show login button
    res.render('index', {
        appName: APP_NAME,
        appColor: APP_COLOR,
        port: PORT,
    });
});

app.get('/login', (req, res) => {
    const returnUrl = `http://localhost:${PORT}/auth-success`;
    res.redirect(`${MAIN_APP}/auth?redirectTo=${encodeURIComponent(returnUrl)}`);
});

// ─── /auth-success ────────────────────────────────────────────────────────────
// main-app sends user here after login with user info in query params
app.get('/auth-success', (req, res) => {
    const { userId, email, username } = req.query;

    if (!userId) {
        return res.redirect('/');
    }

    // Save user in local session
    req.session.user = {
        userId,
        email: decodeURIComponent(email || ''),
        username: decodeURIComponent(username || ''),
    };

    res.render('dashboard', {
        appName: APP_NAME,
        appColor: APP_COLOR,
        port: PORT,
        user: req.session.user,
    });
});

// ─── /check-session ───────────────────────────────────────────────────────────
// Heartbeat endpoint - client periodically checks if session is still valid
app.get('/check-session', (req, res) => {
    res.json({ 
        isLoggedIn: !!req.session.user,
        timestamp: Date.now()
    });
});

// ─── /clear-session ───────────────────────────────────────────────────────────
// Called by main-app during logout to clear this app's session
app.post('/clear-session', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(`[${APP_NAME}] Failed to clear session:`, err);
            return res.sendStatus(500);
        }
        console.log(`[${APP_NAME}] Session cleared by main-app`);
        res.sendStatus(200);
    });
});

app.listen(PORT, () => {
    console.log(`${APP_NAME} running on http://localhost:${PORT}`);
});