# StageSync — Live Event Management Platform

StageSync is a studio-grade live event production and artist booking management system. It provides real-time artist scheduling, concurrency-safe booking, setlist duration calculation, and equipment inventory tracking on top of a fully normalized PostgreSQL database.

---

## 1. Quick Start

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v15+) running locally on port 5432

### Setup Database
```bash
# 1. Connect to PostgreSQL and execute the schema (23 tables)
psql -d postgres -f dbms/03_schema.sql

# 2. Populate realistic seed data and run queries
psql -d postgres -f dbms/04_queries.sql
```

### Start the Application
```bash
# Install dependencies (Express, pg, cors)
npm install

# Start the server
npm start
```

Open your browser and navigate to:
**`http://localhost:3000`**

---

## 2. Project Architecture

The project has been scaled down and simplified into a clean, readable architecture designed for college viva demonstration:

```text
├── backend/                       # Modular Backend Architecture (7 Clean Files)
│   ├── db.js                      # PostgreSQL connection pool using 'pg' (35 lines)
│   ├── server.js                  # Main Express app, middleware & router mounting (80 lines)
│   └── routes/                    # Team Member Domains (~80-115 lines each)
│       ├── artists.js             # Member 1: Artist Profiles, Genres, Skills & Band Lineup (Q1 & Q7)
│       ├── bookings.js            # Member 2: Concurrency Engine & Algorithm B Conflict Check
│       ├── setlists.js            # Member 3: Performance Engine & Algorithm C Duration Calculator
│       ├── events.js              # Member 4: Events, Venues & Financial Auditing (Q4.2 & Q5)
│       └── equipment.js           # Member 4: Hardware Inventory & Algorithm E Anti-Join Availability
├── frontend/                      # Pure client-side dashboard (Zero framework bloat)
│   ├── index.html                 # Clean interactive dashboard UI
│   ├── style.css                  # Modern dark-theme stylesheet
│   └── app.js                     # Vanilla JavaScript with async/fetch calls
├── dbms/                          # Core DBMS Assignment Submissions
│   ├── 01_normalization.md        # Formal 1NF -> BCNF normalization proofs
│   ├── 02_er_diagram.png          # 4K high-resolution ER Diagram (23 tables)
│   ├── 03_schema.sql              # PostgreSQL DDL with GiST exclusion constraints
│   ├── 04_queries.sql             # Seed data, application queries & analytics
│   ├── 05_query_timings.md        # EXPLAIN ANALYZE execution benchmarks
│   └── plans/                     # Raw execution plans (Q1 to Q8)
├── .env.example                   # Environment variables template
├── .gitignore                     # Ignored files (node_modules, .env)
├── package.json                   # Project manifest & start script
└── README.md                      # Documentation & Viva preparation guide
```

---

## 3. Team Member Module Allocation (Viva Reference)

| Member | Assigned Backend File | Key Responsibilities | Core Viva Talking Point |
| :--- | :--- | :--- | :--- |
| **Member 1** | `backend/routes/artists.js` | Artist Profiles, Skills, Genres & Band Lineups | Multi-attribute search indexing (Query 1) & composite active lineup traversal (Query 7). |
| **Member 2** | `backend/routes/bookings.js` | Scheduling & Booking Concurrency | **Algorithm B**: Range overlap detection and PostgreSQL GiST exclusion constraint (`no_artist_booking_overlap`). |
| **Member 3** | `backend/routes/setlists.js` | Live Setlist Engine & Track Sequencing | **Algorithm C**: Runtime duration summation vs target slot calculation and buffer management. |
| **Member 4** | `backend/routes/events.js` & `equipment.js` | Events, Venues, Hardware Inventory & Financials | **Algorithm E**: Hardware availability via anti-join (Query 4) and event financial auditing (Query 4.2 & 5). |

---

## 3. Core Algorithms & SQL Queries

### Algorithm B: Concurrency-Safe Booking Overlap Check
- **Endpoint:** `POST /api/bookings`
- **Logic:** Before inserting a new booking, the system evaluates time-range overlap:
  ```sql
  SELECT id FROM bookings
  WHERE artist_id = $1
    AND status NOT IN ('CANCELLED', 'REJECTED')
    AND start_time < $3 AND end_time > $2;
  ```
- **Storage-Engine Safety:** Even if two requests arrive at the exact same millisecond, PostgreSQL's `btree_gist` exclusion constraint (`no_artist_booking_overlap`) prevents double-booking at the storage level.

### Algorithm C: Setlist Duration & Target Gap
- **Endpoint:** `GET /api/setlists`
- **Logic:** Calculates total duration of queued songs and verifies whether the performance fits within the target slot:
  ```sql
  SELECT sl.name, sl.target_duration_seconds,
         COALESCE(SUM(s.duration_seconds), 0) AS total_song_seconds,
         sl.target_duration_seconds - COALESCE(SUM(s.duration_seconds), 0) AS remaining_seconds
  FROM setlists sl
  LEFT JOIN setlist_songs ss ON sl.id = ss.setlist_id
  LEFT JOIN songs s ON ss.song_id = s.id
  GROUP BY sl.id, sl.name, sl.target_duration_seconds;
  ```

### Algorithm E: Stage Equipment Conflict Resolution
- **Endpoint:** `GET /api/equipment`
- **Logic:** Identifies available audio and lighting hardware by executing a `NOT EXISTS` anti-join against overlapping reservations:
  ```sql
  SELECT e.name, e.category, e.daily_rate
  FROM equipment e
  WHERE e.operational_status = 'AVAILABLE'
    AND NOT EXISTS (
        SELECT 1 FROM equipment_reservations er
        WHERE er.equipment_id = e.id
          AND er.status IN ('CONFIRMED', 'IN_USE')
          AND er.start_time < $2 AND end_time > $1
    );
  ```

---

## 4. Key Viva Questions & Explanations

1. **Why is the database normalized to 3NF / BCNF?**
   - Eliminates update, insert, and deletion anomalies.
   - Separates distinct real-world entities (Artists, Bands, Venues, Events, Songs, Equipment) into independent tables linked by foreign keys.

2. **Why use GiST exclusion constraints instead of checking in code?**
   - Application-level `SELECT ... WHERE` checks are prone to race conditions under concurrent requests.
   - GiST exclusion constraints lock and check index pages directly in PostgreSQL, guaranteeing zero double-bookings with zero race windows.

3. **How fast are the database queries?**
   - All critical lookups run in **under 1 millisecond** (e.g. Band Lineup: 0.130 ms, Equipment Check: 0.162 ms, Artist Search: 0.217 ms) because high-cardinality foreign keys and composite filter attributes are indexed.
