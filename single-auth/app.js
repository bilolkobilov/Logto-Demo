const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { handleAuthRoutes, withLogto } = require('@logto/express');
require('dotenv').config();

const app = express();

const config = {
    appId: process.env.LOGTO_APP_ID || '',
    appSecret: process.env.LOGTO_APP_SECRET || '',
    endpoint: process.env.LOGTO_ENDPOINT || '',
    baseUrl: process.env.LOGTO_BASE_URL || 'http://localhost:3000',
    scopes: ['email', 'profile'],
};

const PORT = Number(process.env.PORT || 3000);

app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'single-auth-secret-key',
    cookie: {maxAge: 13 * 24 * 60 * 60 * 1000},
}));

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static('public'));

app.use(handleAuthRoutes(config));

//Home Page
app.get('/', withLogto(config), (req, res) => {
    res.render('index', {
        isAuthenticated: req.user.isAuthenticated,
        appName: 'Single Auth App',
        appColor: '#6366f1',
        port: PORT,
    });
});

app.get('/dashboard', withLogto(config), (req, res) => {
    if (!req.user.isAuthenticated) {
        return res.redirect('/logto/sign-in');
    }

    res.render('dashboard', {
        appName: 'Single Auth App',
        appColor: '#6366f1',
        port: PORT,
        userId: req.user.claims.sub,
        username: req.user.claims.username,
        email: req.user.claims.email,
    });
});

app.listen(PORT, () => {
    console.log(`App is running on http://localhost:${PORT}`);
});