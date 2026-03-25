require('dotenv').config();
const express = require('express');
const cors = require('cors');

const farmersRouter = require('./routes/farmers');
const schemesRouter = require('./routes/schemes');
const marketRouter  = require('./routes/market');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));          // Allow all origins for Expo dev
app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'Raitha Setu API is running 🌾',
    version: '1.0.0',
    endpoints: [
      'GET  /api/farmers/:uid',
      'POST /api/farmers/:uid',
      'GET  /api/schemes/list',
      'POST /api/schemes/ask',
      'GET  /api/market/listings',
      'POST /api/market/book',
      'GET  /api/market/bookings/:farmerUid',
    ]
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/farmers', farmersRouter);
app.use('/api/schemes', schemesRouter);
app.use('/api/market',  marketRouter);

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌿 Raitha Setu Backend running at http://localhost:${PORT}`);
  console.log(`📋 API Docs: http://localhost:${PORT}/\n`);
});
