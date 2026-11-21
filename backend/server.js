// ==========================================
// StageSync: Main Express Server
// Module: Core Application Entry Point (Vercel Serverless Ready)
// ==========================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const { query } = require('./db');

// Modular Route Handlers (4 Dedicated Team Members)
const artistRoutes = require('./routes/artists');           // Member 1: Bands & Musician Discovery, 6-Tab Studio Specs
const bookingRoutes = require('./routes/bookings');         // Member 2: Concurrency-Safe Direct Bookings & Conflict Protection
const requirementRoutes = require('./routes/requirements'); // Member 3: Live Gig Requirements & Compatibility Matching
const eventRoutes = require('./routes/events');             // Member 4: Live Events, Venues & Financial Auditing

const app = express();
const PORT = process.env.PORT || 3000;

// Standard Middleware
app.use(cors());
app.use(express.json());

// 1. Core System Health Check
app.get('/api/health', async (req, res) => {
  try {
    const result = await query('SELECT NOW() AS current_time;');
    res.json({
      status: 'healthy',
      database: 'connected',
      schema: 'stagesync',
      time: result.rows[0].current_time,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 2. High-Level Analytics & Dashboard Metrics
app.get('/api/analytics', async (req, res) => {
  try {
    const artists = await query('SELECT COUNT(*) FROM artist_profiles;');
    const events = await query('SELECT COUNT(*) FROM events;');
    const venues = await query('SELECT COUNT(*) FROM venues;');
    const bookings = await query("SELECT COUNT(*) FROM bookings WHERE status = 'CONFIRMED';");

    res.json({
      success: true,
      stats: {
        totalArtists: parseInt(artists.rows[0].count),
        totalEvents: parseInt(events.rows[0].count),
        totalVenues: parseInt(venues.rows[0].count),
        confirmedBookings: parseInt(bookings.rows[0].count),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Mount Modular Routers (4 Distributed Team Modules)
app.use('/api/artists', artistRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/events', eventRoutes);

// Direct shortcuts for venues and financial reports
app.get('/api/venues', eventRoutes.getVenues);
app.get('/api/reports/earnings', eventRoutes.getEarningsReport);

// 4. Static Frontend & DBMS Documentation Serving
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/dbms', express.static(path.join(__dirname, '../dbms')));

// Start HTTP Server Listener (when executed standalone)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`StageSync Backend running on http://localhost:${PORT}`);
    console.log(`Health Check: http://localhost:${PORT}/api/health`);
    console.log(`Modular Architecture: 4 Team Route Domains Mounted`);
    console.log(`==================================================\n`);
  });
}

module.exports = app;

