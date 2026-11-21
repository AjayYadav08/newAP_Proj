// ==========================================
// StageSync: Booking & Concurrency Engine
// Module: Member 2 (Algorithm B - Concurrency-Safe Booking & Overlap Check)
// ==========================================

const express = require('express');
const router = express.Router();
const { query } = require('../db');

// 1. Get all bookings with event and artist details
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT b.id, b.status, b.fee, b.start_time, b.end_time,
             e.title AS event_title,
             CASE 
               WHEN ap.stage_name = 'Aarav Strings' THEN 'Chrysalis (Band)'
               ELSE ap.stage_name 
             END AS artist_name,
             ap.professional_type,
             ap.city AS artist_city
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      JOIN artist_profiles ap ON b.artist_id = ap.id
      ORDER BY b.start_time DESC;
    `);

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get single booking by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
      SELECT b.*, e.title AS event_title, ap.stage_name AS artist_name
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      JOIN artist_profiles ap ON b.artist_id = ap.id
      WHERE b.id = $1;
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Create new booking with Algorithm B Overlap Conflict Check
router.post('/', async (req, res) => {
  try {
    const { event_id, artist_id, start_time, end_time, fee } = req.body;

    // Basic input validation
    if (!event_id || !artist_id || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'Missing required booking parameters: event_id, artist_id, start_time, end_time',
      });
    }

    // Map known legacy requirement IDs to their UUID equivalents for seamless backwards-compatibility
    const GIG_ID_MAP = {
      'gig-req-001': '88888888-8888-8888-8888-888888888803',
      'gig-req-002': '88888888-8888-8888-8888-888888888804',
      'gig-req-003': '88888888-8888-8888-8888-888888888805',
    };
    const targetEventId = GIG_ID_MAP[event_id] || event_id;

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(targetEventId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Event Reference: Please choose an active event or opportunity from the dropdown list.',
      });
    }

    // Step 1: Algorithm B - Temporal overlap check
    const conflictCheck = await query(
      `
      SELECT b.id, b.start_time, b.end_time, e.title AS event_title, b.event_id
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE b.artist_id = $1
        AND b.status NOT IN ('CANCELLED')
        AND b.start_time < $3
        AND b.end_time > $2;
    `,
      [artist_id, start_time, end_time]
    );

    // If overlap is found, reject with clean, informative 409 Conflict message
    if (conflictCheck.rows.length > 0) {
      const conflict = conflictCheck.rows[0];
      const isSameEvent = conflict.event_id === targetEventId;

      const conflictDate = new Date(conflict.start_time).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const conflictStart = new Date(conflict.start_time).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const conflictEnd = new Date(conflict.end_time).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      let errorMsg;
      if (isSameEvent) {
        errorMsg = `Deal is already locked for this opportunity! A confirmed booking is active for "${conflict.event_title}" on ${conflictDate} (${conflictStart} – ${conflictEnd}).`;
      } else {
        errorMsg = `Schedule Conflict: The performer is already booked for "${conflict.event_title}" on ${conflictDate} (${conflictStart} – ${conflictEnd}). Please select an alternate time slot.`;
      }

      return res.status(409).json({
        success: false,
        error: errorMsg,
        conflict: conflict,
        isSameEvent: isSameEvent,
      });
    }

    // Step 2: Ensure target event exists in PostgreSQL to satisfy foreign key constraint
    const eventCheck = await query('SELECT id, organizer_id FROM events WHERE id = $1', [targetEventId]);
    let organizerId = '11111111-1111-1111-1111-111111111102';
    if (eventCheck.rows.length === 0) {
      await query(
        `INSERT INTO events (id, title, event_type, status, start_time, end_time, organizer_id, budget, description)
         VALUES ($1, $2, 'CONCERT', 'PUBLISHED', $3, $4, $5::uuid, $6, 'Live Performance Gig')
         ON CONFLICT (id) DO NOTHING;`,
        [targetEventId, 'Opportunity Live Gig', start_time, end_time, organizerId, fee || 15000]
      );
    } else if (eventCheck.rows[0].organizer_id) {
      organizerId = eventCheck.rows[0].organizer_id;
    }

    // Step 3: Insert confirmed booking into PostgreSQL
    const insertResult = await query(
      `
      INSERT INTO bookings (event_id, artist_id, status, fee, start_time, end_time, created_by)
      VALUES ($1, $2, 'CONFIRMED', $3, $4, $5, $6::uuid)
      RETURNING *;
    `,
      [targetEventId, artist_id, fee || 15000, start_time, end_time, organizerId]
    );

    res.status(201).json({ success: true, booking: insertResult.rows[0] });
  } catch (err) {
    // Catch database-level GiST exclusion constraint error (error code 23P01)
    if (err.code === '23P01') {
      return res.status(409).json({
        success: false,
        error: 'Concurrency Conflict: Another booking was just confirmed for this performer during the requested time window.',
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Cancel a booking
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
      UPDATE bookings
      SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, status, updated_at;
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    res.json({ success: true, message: 'Booking successfully cancelled', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

