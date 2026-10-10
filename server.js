require('dotenv').config();
const express = require('express');
const path = require('path');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`Commute MVP running at http://localhost:${PORT}`);
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.log('No GOOGLE_MAPS_API_KEY set — walk/auto legs will use a distance-based estimate instead of live traffic data.');
  }
});
