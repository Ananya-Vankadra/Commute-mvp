require('dotenv').config();
const { timingSafeEqual } = require('crypto');
const express = require('express');
const path = require('path');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

function requireAdminAuth(req, res, next) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username && !password && process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!username || !password) {
    return res.status(503).send('Admin authentication is not configured.');
  }

  const authorization = req.get('authorization') || '';
  const credentials = /^Basic\s+(.+)$/i.exec(authorization);
  if (!credentials) {
    res.set('WWW-Authenticate', 'Basic realm="Commute Admin"');
    return res.status(401).send('Authentication required.');
  }

  const decoded = Buffer.from(credentials[1], 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  const supplied = Buffer.from(decoded);
  const expected = Buffer.from(`${username}:${password}`);

  if (
    separator < 0 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    res.set('WWW-Authenticate', 'Basic realm="Commute Admin"');
    return res.status(401).send('Authentication required.');
  }

  next();
}

app.use(express.json());
app.use('/admin.html', requireAdminAuth);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);

app.use('/api/admin', requireAdminAuth, adminRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Commute MVP running at http://localhost:${PORT}`);
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.log('No GOOGLE_MAPS_API_KEY set — walk/auto legs will use a distance-based estimate instead of live traffic data.');
  }
});
