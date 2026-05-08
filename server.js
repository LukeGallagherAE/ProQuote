require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

const storageRoutes = require('./routes/storage');
const quotesRoutes  = require('./routes/quotes');
const emailRoutes   = require('./routes/email');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // large limit — quotes can contain base64 photos
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/storage', storageRoutes);
app.use('/api/quotes',  quotesRoutes);
app.use('/api/email',   emailRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, version: '2.1.0' }));

// Serve the app for any non-API route (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ProQuote 2.1 running at http://localhost:${PORT}`);
});
