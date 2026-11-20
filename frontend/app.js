// ==========================================================================
// StageSync — Live Band & Musician Hiring Platform
// Client-Side Architecture (Vanilla JavaScript & PostgreSQL Persistence)
// ==========================================================================

let artistsCache = [];
let eventsCache = [];
let gigsCache = [];
let bookingsCache = [];
let currentPlayingDemo = null;
let audioContext = null;
let currentSynthOscillators = [];

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupModals();
  setupSpecTabs();
  setupFilters();
  setupForms();
  initializeDateTimePresets();
  fetchAllData();
});

// ==========================================
// 1. Data Fetcher & Aggregator
// ==========================================
async function fetchAllData() {
  await Promise.all([
    loadArtists(),
    loadGigs(),
    loadEvents(),
    loadBookings(),
  ]);
}

// ==========================================
// 2. Navigation & Routing (4 Focused Pages)
// ==========================================
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  const tabs = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  const titles = {
    artists: {
      title: 'Bands & Musicians Directory',
      sub: 'Verified performers, per-gig pricing, locations, audio demos and technical specs',
    },
    gigs: {
      title: 'Live Opportunities Board',
      sub: 'Organizer requirements with compensation budget, performance hours, and area',
    },
    'post-gig': {
      title: 'Post a Live Gig Opportunity',
      sub: 'Publish performance requirements for bands and solo musicians to review and apply',
    },
    myprofile: {
      title: 'Profile & Booking History',
      sub: 'Organiser past deals history and Chrysalis band performance record',
    },
  };

  function switchTab(targetTab) {
    navButtons.forEach((b) => b.classList.remove('active'));
    tabs.forEach((t) => t.classList.remove('active'));

    const activeBtn = document.querySelector(`.nav-item[data-tab="${targetTab}"]`);
    const activeSection = document.getElementById(`tab-${targetTab}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activeSection) activeSection.classList.add('active');

    if (titles[targetTab]) {
      if (pageTitle) pageTitle.textContent = titles[targetTab].title;
      if (pageSubtitle) pageSubtitle.textContent = titles[targetTab].sub;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  // Delegated clicks for elements with data-goto
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-goto]');
    if (target) {
      switchTab(target.getAttribute('data-goto'));
    }
  });

  window.switchTab = switchTab;
}

// ==========================================
// 3. Page 1: Bands & Musicians Directory
// ==========================================
async function loadArtists(city = '') {
  const grid = document.getElementById('artists-cards-grid');
  if (!grid) return;

  try {
    const url = city ? `/api/artists?city=${encodeURIComponent(city)}` : '/api/artists';
    const res = await fetch(url);
    const json = await res.json();

    if (json.success) {
      artistsCache = json.data || [];
      const navCount = document.getElementById('nav-count-artists');
      if (navCount) navCount.textContent = artistsCache.length;

      renderFilteredArtists(artistsCache);
      populateArtistSelectDropdown(artistsCache);
    } else {
      grid.innerHTML = `<div class="error-state">Failed to load artists: ${json.error}</div>`;
    }
  } catch (err) {
    console.error('Error loading artists:', err);
    grid.innerHTML = '<div class="error-state">Error connecting to server to fetch artists.</div>';
  }
}

function renderArtistCardHtml(a) {
  const isBand = a.is_band || a.professional_type === 'BAND';
  const priceDisplay = a.starting_price
    ? `₹${Number(a.starting_price).toLocaleString('en-IN')}`
    : `₹${(Number(a.hourly_rate) * 3).toLocaleString('en-IN')}`;

  const ratingDisplay = a.rating || '4.9';
  const eventsCount = a.events_performed || 16;
  const memberText = a.member_count || (isBand ? '4 Members' : 'Solo Performer');
  const demoTitle = a.audio_demo ? a.audio_demo.title : `${a.stage_name} Live Demo`;

  return `
    <div class="artist-card ${isBand ? 'band-featured-card' : ''}" data-id="${a.id}">
      <div class="artist-card-header">
        <div class="artist-avatar-wrapper">
          <div class="artist-avatar ${isBand ? 'band-avatar' : ''}">
            ${isBand ? '🎸' : (a.professional_type === 'DJ' ? '🎧' : '🎤')}
          </div>
          <span class="online-indicator" title="Available for Booking"></span>
        </div>
        <div class="artist-header-info">
          <div class="artist-name-row">
            <h4>${escapeHtml(a.stage_name)}</h4>
            <span class="badge ${isBand ? 'badge-primary' : 'badge-neutral'}">
              ${isBand ? 'BAND' : escapeHtml(a.professional_type || 'SOLO')}
            </span>
          </div>
          <p class="artist-genre-city">${escapeHtml(a.genre || 'Rock')} &bull; ${escapeHtml(a.city || 'Mumbai')}</p>
        </div>
      </div>

      <p class="artist-bio-snippet">${escapeHtml(a.bio || 'Professional live act with studio sound and versatile repertoire.')}</p>

      <div class="artist-specs-mini">
        <div class="mini-spec-item">
          <span class="spec-label">Starting Deal</span>
          <span class="spec-value price-highlight">${priceDisplay}</span>
        </div>
        <div class="mini-spec-item">
          <span class="spec-label">Experience</span>
          <span class="spec-value">⭐ ${ratingDisplay} (${eventsCount} gigs)</span>
        </div>
        <div class="mini-spec-item">
          <span class="spec-label">Roster</span>
          <span class="spec-value">${memberText}</span>
        </div>
      </div>

      <!-- Playable Audio Demo Bar -->
      <div class="audio-demo-bar">
        <button class="btn-demo-play" onclick="toggleAudioDemo(this, '${escapeHtml(a.stage_name)}')">
          <span class="play-icon">▶</span>
          <span class="demo-title">${escapeHtml(demoTitle)}</span>
          <span class="demo-duration">0:30 preview</span>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="artist-card-actions">
        <button class="btn btn-primary btn-sm" onclick="openDirectBooking('${a.id}')">
          ⚡ Direct Book
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openArtistSpecification('${a.id}')">
          View Studio Spec
        </button>
      </div>
    </div>
  `;
}

function renderFilteredArtists(list) {
  const grid = document.getElementById('artists-cards-grid');
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state">No artists or bands match your search criteria.</div>';
    return;
  }

  grid.innerHTML = list.map(renderArtistCardHtml).join('');
}

function setupFilters() {
  const searchInput = document.getElementById('artist-search-input');
  const cityPills = document.querySelectorAll('#artist-city-pills .pill');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = artistsCache.filter((a) => {
        return (
          a.stage_name.toLowerCase().includes(q) ||
          (a.genre && a.genre.toLowerCase().includes(q)) ||
          (a.city && a.city.toLowerCase().includes(q)) ||
          (a.professional_type && a.professional_type.toLowerCase().includes(q))
        );
      });
      renderFilteredArtists(filtered);
    });
  }

  cityPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      cityPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const city = pill.getAttribute('data-city');
      loadArtists(city);
    });
  });
}

function populateArtistSelectDropdown(artists) {
  const select = document.getElementById('direct-book-artist-select');
  if (!select) return;

  select.innerHTML = artists
    .map((a) => {
      const isBand = a.is_band || a.professional_type === 'BAND';
      const rate = a.starting_price || (Number(a.hourly_rate) * 3) || 45000;
      return `<option value="${a.id}" data-rate="${a.hourly_rate || 3500}" data-is-band="${isBand}">${escapeHtml(a.stage_name)} (${a.professional_type || 'Performer'}) — Starts ₹${Number(rate).toLocaleString('en-IN')}</option>`;
    })
    .join('');
}

// ==========================================
// 4. Page 2: Live Opportunities Board
// ==========================================
async function loadGigs() {
  const container = document.getElementById('gigs-cards-container');
  if (!container) return;

  try {
    const res = await fetch('/api/requirements');
    const json = await res.json();

    if (json.success) {
      gigsCache = json.data || [];
      const navCount = document.getElementById('nav-count-gigs');
      if (navCount) navCount.textContent = gigsCache.length;

      const profileGigsStat = document.getElementById('profile-stat-gigs');
      if (profileGigsStat) profileGigsStat.textContent = `${gigsCache.length} Gigs`;

      renderGigs(gigsCache);
    } else {
      container.innerHTML = `<div class="error-state">Failed to load opportunities: ${json.error}</div>`;
    }
  } catch (err) {
    console.error('Error loading gigs:', err);
    container.innerHTML = '<div class="error-state">Error connecting to server to fetch gig opportunities.</div>';
  }
}

function renderGigs(gigs) {
  const container = document.getElementById('gigs-cards-container');
  if (!container) return;

  if (gigs.length === 0) {
    container.innerHTML = '<div class="empty-state">No active opportunities posted right now. Be the first to post one!</div>';
    return;
  }

  container.innerHTML = gigs
    .map((g) => {
      const budgetDisplay = `₹${Number(g.budget).toLocaleString('en-IN')}`;
      const bestMatch = g.best_match || { artist_name: 'Chrysalis (Band)', match_score: 95 };

      return `
        <div class="gig-card" data-gig-id="${g.id}">
          <div class="gig-card-header">
            <div>
              <div class="gig-category-row">
                <span class="badge badge-primary">${escapeHtml(g.category || 'BAND')}</span>
                <span class="badge badge-success">${escapeHtml(g.status || 'OPEN')}</span>
              </div>
              <h4 class="gig-title">${escapeHtml(g.title)}</h4>
              <p class="gig-meta">
                Posted by <strong>${escapeHtml(g.organizer || 'Event Producer')}</strong> &bull; 📍 ${escapeHtml(g.location)}
              </p>
            </div>
            <div class="gig-budget-badge">
              <span class="budget-label">Compensation</span>
              <strong class="budget-val">${budgetDisplay}</strong>
              <small class="budget-sub">${g.duration_hours || 3} Hours Slot</small>
            </div>
          </div>

          <p class="gig-desc">${escapeHtml(g.description || 'Full live performance slot with sound support.')}</p>

          ${
            g.technical_spec
              ? `<div class="gig-tech-note">⚙️ <strong>Stage Spec:</strong> ${escapeHtml(g.technical_spec)}</div>`
              : ''
          }

          <!-- Compatibility Matching Pill -->
          <div class="compatibility-pill">
            <span class="match-icon">🎯</span>
            <span><strong>${bestMatch.match_score}% Compatibility Match</strong> with ${escapeHtml(bestMatch.artist_name)} (${escapeHtml(g.required_genre || 'Rock')})</span>
          </div>

          <div class="gig-card-actions">
            <button class="btn btn-primary" onclick="applyForGig('${g.id}', '${escapeHtml(g.title).replace(/'/g, "\\'")}')">
              ⚡ Apply with Chrysalis Band
            </button>
            <button class="btn btn-secondary" onclick="switchTab('artists')">
              🔍 Browse Performers
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

async function applyForGig(gigId, gigTitle) {
  try {
    const res = await fetch(`/api/requirements/${gigId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artist_id: '22222222-2222-2222-2222-222222222201',
        proposal_notes: 'Chrysalis 4-piece rock band available for this date with full technical rider and original setlist.',
      }),
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Application submitted for "${gigTitle}" with Chrysalis band profile!`, 'success');
      loadGigs();
    } else {
      showToast(json.error || 'Failed to submit application', 'error');
    }
  } catch (err) {
    showToast('Network error while applying for gig', 'error');
  }
}

// ==========================================
// 5. Page 3: Post Opportunity Form Handlers
// ==========================================
function setupForms() {
  // Page 3: Post Gig Form
  const postGigForm = document.getElementById('form-post-opportunity-page');
  if (postGigForm) {
    postGigForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('gig-post-title').value.trim();
      const category = document.getElementById('gig-post-category').value;
      const required_genre = document.getElementById('gig-post-genre').value.trim();
      const budget = parseFloat(document.getElementById('gig-post-budget').value);
      const duration_hours = parseFloat(document.getElementById('gig-post-duration').value);
      const location = document.getElementById('gig-post-location').value.trim();
      const event_date = document.getElementById('gig-post-start').value;
      const description = document.getElementById('gig-post-desc').value.trim();

      try {
        const res = await fetch('/api/requirements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            organizer: 'SoundWave Productions (Maya Sengupta)',
            category,
            required_genre,
            budget,
            duration_hours,
            location,
            event_date,
            description,
          }),
        });

        const json = await res.json();
        if (json.success) {
          showToast('Live Opportunity published successfully!', 'success');
          postGigForm.reset();
          initializeDateTimePresets();
          await loadGigs();
          switchTab('gigs');
        } else {
          showToast(json.error || 'Failed to publish opportunity', 'error');
        }
      } catch (err) {
        showToast('Network error publishing opportunity', 'error');
      }
    });
  }

  // Direct Booking Modal Form
  const directBookForm = document.getElementById('form-direct-booking');
  if (directBookForm) {
    directBookForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const alertBox = document.getElementById('direct-booking-alert');
      if (alertBox) alertBox.style.display = 'none';

      const artist_id = document.getElementById('direct-book-artist-select').value;
      const event_id = document.getElementById('direct-book-event-select').value;
      const start_time = document.getElementById('direct-book-start').value;
      const end_time = document.getElementById('direct-book-end').value;
      const fee = parseFloat(document.getElementById('direct-book-fee').value);

      if (!start_time || !end_time) {
        showToast('Please select valid start and end times', 'error');
        return;
      }

      if (new Date(end_time) <= new Date(start_time)) {
        showToast('End time must be after start time!', 'error');
        if (alertBox) {
          alertBox.className = 'alert-box alert-error';
          alertBox.style.display = 'block';
          alertBox.textContent = 'Invalid slot: End time must be later than start time.';
        }
        return;
      }

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id,
            artist_id,
            start_time: new Date(start_time).toISOString(),
            end_time: new Date(end_time).toISOString(),
            fee,
          }),
        });

        const json = await res.json();
        if (json.success) {
          closeModal('modal-direct-book');
          showToast('Deal confirmed & locked into schedule successfully!', 'success');
          await loadBookings();
          switchTab('myprofile');
        } else {
          // Conflict or Validation Error
          if (alertBox) {
            alertBox.className = 'alert-box alert-error';
            alertBox.style.display = 'block';
            alertBox.innerHTML = `⚠️ <strong>Scheduling Conflict:</strong> ${escapeHtml(json.error || 'The selected slot overlaps with an existing confirmed booking.')}`;
          }
          showToast('Booking conflict detected. See alert message.', 'error');
        }
      } catch (err) {
        if (alertBox) {
          alertBox.className = 'alert-box alert-error';
          alertBox.style.display = 'block';
          alertBox.textContent = 'Server error during booking submission.';
        }
      }
    });

    // Smart fee calculation on performer or slot window change
    const artistSelect = document.getElementById('direct-book-artist-select');
    const startInput = document.getElementById('direct-book-start');
    const endInput = document.getElementById('direct-book-end');

    if (artistSelect) artistSelect.addEventListener('change', recalculateDirectBookingFee);
    if (startInput) startInput.addEventListener('change', recalculateDirectBookingFee);
    if (endInput) endInput.addEventListener('change', recalculateDirectBookingFee);
  }
}

function recalculateDirectBookingFee() {
  const artistSelect = document.getElementById('direct-book-artist-select');
  const startInput = document.getElementById('direct-book-start');
  const endInput = document.getElementById('direct-book-end');
  const feeInput = document.getElementById('direct-book-fee');
  const badgeEl = document.getElementById('direct-book-duration-badge');
  const calcEl = document.getElementById('direct-book-fee-calc');

  if (!artistSelect || !startInput || !endInput || !feeInput) return;

  const artistId = artistSelect.value;
  const artist = artistsCache.find((a) => a.id === artistId);
  if (!artist) return;

  const startVal = startInput.value;
  const endVal = endInput.value;
  if (!startVal || !endVal) return;

  const startDate = new Date(startVal);
  const endDate = new Date(endVal);
  const diffHours = (endDate - startDate) / (1000 * 60 * 60);

  if (diffHours <= 0) {
    if (badgeEl) badgeEl.textContent = 'Invalid Slot';
    if (calcEl) calcEl.innerHTML = '<span style="color: var(--danger);">⚠️ End time must be after start time</span>';
    return;
  }

  const hours = Math.round(diffHours * 10) / 10;
  if (badgeEl) badgeEl.textContent = `Duration: ${hours} hrs`;

  const isBand = artist.is_band || artist.professional_type === 'BAND';
  const hourlyRate = parseFloat(artist.hourly_rate) || 3500;
  let calculatedFee = 0;

  if (isBand) {
    const baseRate = parseFloat(artist.starting_price) || 45000;
    if (hours <= 3) {
      calculatedFee = baseRate;
    } else {
      calculatedFee = baseRate + Math.round((hours - 3) * 12000);
    }
    if (calcEl) {
      calcEl.innerHTML = `💡 <strong>Band Package:</strong> ₹${calculatedFee.toLocaleString('en-IN')} (${hours} hrs slot) &bull; You can customize agreed amount`;
    }
  } else {
    calculatedFee = Math.round(hourlyRate * hours);
    if (calcEl) {
      calcEl.innerHTML = `💡 <strong>Standard Rate:</strong> ₹${hourlyRate.toLocaleString('en-IN')}/hr &times; ${hours} hrs = ₹${calculatedFee.toLocaleString('en-IN')} &bull; Negotiable`;
    }
  }

  feeInput.value = calculatedFee;
}

// ==========================================
// 6. Page 4: Profile & History (Two Sections)
// ==========================================
async function loadBookings() {
  const tbody = document.getElementById('myprofile-bookings-body');
  if (!tbody) return;

  try {
    const res = await fetch('/api/bookings');
    const json = await res.json();

    if (json.success) {
      bookingsCache = json.data || [];
      renderBookingsHistory(bookingsCache);
    } else {
      tbody.innerHTML = `<tr><td colspan="6" class="error-state">Failed to load deals: ${json.error}</td></tr>`;
    }
  } catch (err) {
    console.error('Error loading bookings:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="error-state">Error connecting to server for bookings.</td></tr>';
  }
}

function renderBookingsHistory(bookings) {
  const tbody = document.getElementById('myprofile-bookings-body');
  if (!tbody) return;

  if (bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No confirmed deals or bookings yet. Direct book a band from the directory!</td></tr>';
    updateProfileStats(0, 0);
    return;
  }

  let totalDeals = 0;
  let totalPaid = 0;

  tbody.innerHTML = bookings
    .map((b) => {
      const isConfirmed = b.status === 'CONFIRMED';
      if (isConfirmed) {
        totalDeals++;
        totalPaid += parseFloat(b.fee) || 0;
      }

      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      const timeStr = `${start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}, ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      return `
        <tr>
          <td><strong>${escapeHtml(b.artist_name || 'Artist')}</strong></td>
          <td>${escapeHtml(b.event_title || 'Concert / Fest')}</td>
          <td><strong style="color: var(--success);">₹${Number(b.fee).toLocaleString('en-IN')}</strong></td>
          <td>${timeStr}</td>
          <td>
            <span class="badge ${isConfirmed ? 'badge-success' : 'badge-danger'}">
              ${escapeHtml(b.status)}
            </span>
          </td>
          <td>
            ${
              isConfirmed
                ? `<button class="btn btn-danger btn-xs" onclick="cancelBooking('${b.id}')">Cancel</button>`
                : `<span style="color: var(--text-dim); font-size: 0.8rem;">Cancelled</span>`
            }
          </td>
        </tr>
      `;
    })
    .join('');

  updateProfileStats(totalDeals, totalPaid);
}

function updateProfileStats(dealsCount, paidAmount) {
  const elDeals = document.getElementById('profile-stat-deals');
  const elPaid = document.getElementById('profile-stat-paid');

  if (elDeals) elDeals.textContent = `${dealsCount} Deals`;
  if (elPaid) elPaid.textContent = `₹${paidAmount.toLocaleString('en-IN')}`;
}

async function cancelBooking(bookingId) {
  if (!confirm('Are you sure you want to cancel this booking and free the slot?')) {
    return;
  }

  try {
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
    });
    const json = await res.json();

    if (json.success) {
      showToast('Booking cancelled & slot released', 'info');
      await loadBookings();
    } else {
      showToast(json.error || 'Failed to cancel booking', 'error');
    }
  } catch (err) {
    showToast('Network error cancelling booking', 'error');
  }
}

// ==========================================
// 7. Events Loader (for Direct Booking Dropdown)
// ==========================================
async function loadEvents() {
  try {
    const res = await fetch('/api/events');
    const json = await res.json();

    if (json.success) {
      eventsCache = json.data || [];
      populateEventSelectDropdown(eventsCache);
    }
  } catch (err) {
    console.error('Error loading events:', err);
  }
}

function populateEventSelectDropdown(events) {
  const select = document.getElementById('direct-book-event-select');
  if (!select) return;

  if (events.length === 0) {
    select.innerHTML = '<option value="">No events available</option>';
    return;
  }

  select.innerHTML = events
    .map(
      (e) => `
        <option value="${e.id}">
          ${escapeHtml(e.title)} (${escapeHtml(e.venue_city || 'Mumbai')}) — Budget: ₹${Number(e.budget || 0).toLocaleString('en-IN')}
        </option>
      `
    )
    .join('');
}

// ==========================================
// 8. Direct Booking Modal Controller
// ==========================================
function openDirectBooking(artistId) {
  const alertBox = document.getElementById('direct-booking-alert');
  if (alertBox) alertBox.style.display = 'none';

  const artistSelect = document.getElementById('direct-book-artist-select');
  if (artistSelect && artistId) {
    artistSelect.value = artistId;
  }

  setDirectBookingPreset('tonight');
  recalculateDirectBookingFee();
  openModal('modal-direct-book');
}

// ==========================================
// 9. 6-Tab Studio Specification Modal
// ==========================================
async function openArtistSpecification(artistId) {
  try {
    const res = await fetch(`/api/artists/${artistId}/full-profile`);
    const json = await res.json();

    if (!json.success || !json.data) {
      showToast('Could not load full profile specification', 'error');
      return;
    }

    const p = json.data;

    // Header info
    const nameEl = document.getElementById('spec-name');
    const taglineEl = document.getElementById('spec-tagline');
    const ratingEl = document.getElementById('spec-rating');
    const gigsEl = document.getElementById('spec-gigs-count');
    const priceEl = document.getElementById('spec-price');
    const avatarEl = document.getElementById('spec-avatar');

    if (nameEl) nameEl.textContent = p.stage_name;
    if (taglineEl) taglineEl.textContent = `${p.genre || 'Rock'} • ${p.city || 'Mumbai, India'}`;
    if (ratingEl) ratingEl.textContent = p.rating || '4.9';
    if (gigsEl) gigsEl.textContent = p.events_performed || '24';
    if (priceEl) priceEl.textContent = `₹${Number(p.starting_price || 45000).toLocaleString('en-IN')}`;
    if (avatarEl) avatarEl.textContent = p.stage_name.charAt(0);

    // Book Now button inside Spec
    const bookNowBtn = document.getElementById('btn-spec-book-now');
    if (bookNowBtn) {
      bookNowBtn.onclick = () => {
        closeModal('modal-artist-spec');
        openDirectBooking(p.id || artistId);
      };
    }

    // 1. Overview Tab
    if (p.about) {
      const bioEl = document.getElementById('spec-bio');
      const yearEl = document.getElementById('spec-formation-year');
      const genEl = document.getElementById('spec-genres');
      const langEl = document.getElementById('spec-languages');
      const infEl = document.getElementById('spec-influences');

      if (bioEl) bioEl.textContent = p.about.bio;
      if (yearEl) yearEl.textContent = p.about.formation_year || '2022';
      if (genEl) genEl.textContent = Array.isArray(p.about.genres) ? p.about.genres.join(', ') : (p.about.genres || 'Rock');
      if (langEl) langEl.textContent = Array.isArray(p.about.languages) ? p.about.languages.join(', ') : (p.about.languages || 'English, Hindi');
      if (infEl) infEl.textContent = p.about.influences || 'Porcupine Tree, Pink Floyd, Indian Ocean';
    }

    // 2. Members Tab
    const membersGrid = document.getElementById('spec-members-grid');
    if (membersGrid) {
      const members = p.members || [
        { name: 'Aarav Strings', role: 'Lead Guitar', instrument: 'Fender Stratocaster', experience_years: 6 },
        { name: 'Meera K', role: 'Lead Vocals', instrument: 'Shure Super 55 Vintage Mic', experience_years: 5 },
        { name: 'Kabir Beats', role: 'Drums', instrument: 'Yamaha Stage Custom Kit', experience_years: 7 },
        { name: 'Ana Bass', role: 'Bass', instrument: 'Fender Jazz Bass & Darkglass Rig', experience_years: 4 },
      ];

      membersGrid.innerHTML = members
        .map(
          (m) => `
          <div class="member-card">
            <div class="member-avatar">${m.name.charAt(0)}</div>
            <div class="member-info">
              <h5>${escapeHtml(m.name)}</h5>
              <p class="member-role">${escapeHtml(m.role)}</p>
              <p class="member-inst">🎸 ${escapeHtml(m.instrument)}</p>
              <div class="member-exp">Experience: <strong>${m.experience_years} years</strong></div>
            </div>
          </div>
        `
        )
        .join('');
    }

    // 3. Portfolio & Demos Tab
    const portfolioList = document.getElementById('spec-portfolio-list');
    if (portfolioList) {
      const tracks = p.portfolio || [
        { title: 'Horizon Echoes', type: 'Original Studio Track', duration: '5:00', release_year: 2024 },
        { title: 'Midnight Drift', type: 'Alternative Rock Single', duration: '4:15', release_year: 2023 },
        { title: 'Cobalt Sky (Live at NH7)', type: 'Festival Live Recording', duration: '4:45', release_year: 2024 },
      ];

      portfolioList.innerHTML = tracks
        .map(
          (t) => `
          <div class="portfolio-item">
            <div class="portfolio-info">
              <span class="track-title">🎵 ${escapeHtml(t.title)}</span>
              <span class="track-sub">${escapeHtml(t.type)} &bull; Released ${t.release_year}</span>
            </div>
            <div class="portfolio-actions">
              <span class="track-duration">${t.duration}</span>
              <button class="btn btn-secondary btn-xs" onclick="toggleAudioDemo(this, '${escapeHtml(t.title)}')">
                ▶ Play Demo
              </button>
            </div>
          </div>
        `
        )
        .join('');
    }

    // 4. Pricing & Terms Tab
    const pricingGrid = document.getElementById('spec-pricing-grid');
    if (pricingGrid && p.pricing) {
      pricingGrid.innerHTML = `
        <div class="spec-box">
          <span class="spec-box-label">Base Performance Rate</span>
          <strong>₹${Number(p.pricing.base_rate || 45000).toLocaleString('en-IN')}</strong>
        </div>
        <div class="spec-box">
          <span class="spec-box-label">Minimum Slot Duration</span>
          <strong>${p.pricing.min_duration_hours || 2} Hours</strong>
        </div>
        <div class="spec-box">
          <span class="spec-box-label">Overtime Rate</span>
          <strong>₹${Number(p.pricing.overtime_per_hour || 12000).toLocaleString('en-IN')} / hr</strong>
        </div>
        <div class="spec-box">
          <span class="spec-box-label">Advance Booking Deposit</span>
          <strong>${p.pricing.advance_payment_percentage || 50}% to Confirm</strong>
        </div>
      `;

      const travelEl = document.getElementById('spec-travel-policy');
      const cancelEl = document.getElementById('spec-cancel-policy');
      if (travelEl) travelEl.textContent = p.pricing.travel_policy || 'Local city travel included. Flights & 4-star lodging required for outstation gigs (>150 km).';
      if (cancelEl) cancelEl.textContent = p.pricing.cancellation_policy || 'Full refund if cancelled 14+ days prior to event. 50% advance retained if cancelled within 7 days.';
    }

    // 5. Technical Rider Tab
    const techContent = document.getElementById('spec-technical-content');
    if (techContent && p.technical_rider) {
      const mics = Array.isArray(p.technical_rider.microphones)
        ? p.technical_rider.microphones.map((m) => `<li>🎤 ${escapeHtml(m)}</li>`).join('')
        : '<li>🎤 3x Shure SM58 Vocal Mics</li>';

      const amps = Array.isArray(p.technical_rider.amplifiers)
        ? p.technical_rider.amplifiers.map((a) => `<li>🎸 ${escapeHtml(a)}</li>`).join('')
        : '<li>🎸 Fender Twin Reverb Guitar Amp & Ampeg Bass Rig</li>';

      techContent.innerHTML = `
        <div class="rider-grid">
          <div class="rider-box">
            <h5>Microphones & Vocal Inputs</h5>
            <ul class="rider-list">${mics}</ul>
          </div>
          <div class="rider-box">
            <h5>Backline Amplifiers & Drums</h5>
            <ul class="rider-list">${amps}</ul>
          </div>
          <div class="rider-box">
            <h5>Monitor Systems</h5>
            <p>${escapeHtml(p.technical_rider.monitors || '4 discrete stereo IEM wireless channels or 4 stage wedges.')}</p>
          </div>
          <div class="rider-box">
            <h5>Stage Dimensions</h5>
            <p>${escapeHtml(p.technical_rider.stage_dimensions || 'Minimum 20ft width x 14ft depth with 2ft drum riser.')}</p>
          </div>
        </div>
      `;
    }

    // 6. Reviews Tab
    const reviewsList = document.getElementById('spec-reviews-list');
    if (reviewsList) {
      const reviews = p.reviews || [
        { organiser_name: 'Maya Sengupta (SoundWave)', event_title: 'Monsoon Rock Fest', rating: 5, comment: 'Incredible stage presence, crisp guitar tones and zero technical issues. Rocked a crowd of 2,000+!' },
        { organiser_name: 'Rohan Verma (Campus Pulse)', event_title: 'IIT Techfest Headliner', rating: 5, comment: 'Punctual, professional and great crowd interaction. Chrysalis made our annual night unforgettable.' },
      ];

      reviewsList.innerHTML = reviews
        .map(
          (r) => `
          <div class="review-card">
            <div class="review-header">
              <div>
                <strong>${escapeHtml(r.organiser_name)}</strong>
                <span class="review-event">&bull; ${escapeHtml(r.event_title)}</span>
              </div>
              <div class="review-stars">${'⭐'.repeat(r.rating || 5)}</div>
            </div>
            <p class="review-text">"${escapeHtml(r.comment)}"</p>
          </div>
        `
        )
        .join('');
    }

    // Switch to Overview tab by default
    switchSpecTab('about');
    openModal('modal-artist-spec');
  } catch (err) {
    console.error('Error loading full artist spec:', err);
    showToast('Failed to load artist specification', 'error');
  }
}

function setupSpecTabs() {
  const specTabButtons = document.querySelectorAll('#spec-tabs-bar .spec-tab-btn');
  specTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-spectab');
      switchSpecTab(target);
    });
  });
}

function switchSpecTab(targetTab) {
  const buttons = document.querySelectorAll('#spec-tabs-bar .spec-tab-btn');
  const panes = document.querySelectorAll('.spec-pane');

  buttons.forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-spectab') === targetTab);
  });

  panes.forEach((p) => {
    p.classList.toggle('active', p.id === `pane-${targetTab}`);
  });
}

// ==========================================
// 10. Date & Time Presets Helpers
// ==========================================
function formatIsoLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function setPostGigPreset(type) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (type === 'tonight') {
    start.setHours(19, 0, 0, 0);
    end.setHours(22, 0, 0, 0);
  } else if (type === 'tomorrow') {
    start.setDate(start.getDate() + 1);
    start.setHours(20, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    end.setHours(23, 0, 0, 0);
  } else if (type === 'weekend') {
    const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
    start.setDate(start.getDate() + daysUntilSat);
    start.setHours(18, 0, 0, 0);
    end.setDate(end.getDate() + daysUntilSat);
    end.setHours(21, 30, 0, 0);
  }

  const startInput = document.getElementById('gig-post-start');
  const endInput = document.getElementById('gig-post-end');
  if (startInput) startInput.value = formatIsoLocal(start);
  if (endInput) endInput.value = formatIsoLocal(end);

  showToast(`Date preset applied: ${type.toUpperCase()}`, 'info');
}

function setDirectBookingPreset(type) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (type === 'tonight') {
    start.setHours(19, 0, 0, 0);
    end.setHours(22, 0, 0, 0);
  } else if (type === 'tomorrow') {
    start.setDate(start.getDate() + 1);
    start.setHours(20, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    end.setHours(23, 0, 0, 0);
  } else if (type === 'weekend') {
    const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
    start.setDate(start.getDate() + daysUntilSat);
    start.setHours(18, 0, 0, 0);
    end.setDate(end.getDate() + daysUntilSat);
    end.setHours(21, 30, 0, 0);
  }

  const startInput = document.getElementById('direct-book-start');
  const endInput = document.getElementById('direct-book-end');
  if (startInput) startInput.value = formatIsoLocal(start);
  if (endInput) endInput.value = formatIsoLocal(end);

  recalculateDirectBookingFee();
}

function initializeDateTimePresets() {
  setPostGigPreset('tonight');
  setDirectBookingPreset('tonight');
}

// ==========================================
// 11. Interactive Audio Demo Synthesizer
// ==========================================
function stopCurrentSynthAudio() {
  if (currentSynthOscillators && currentSynthOscillators.length > 0) {
    currentSynthOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    currentSynthOscillators = [];
  }
}

function playHarmonicSynthDemo(style = 'rock') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    stopCurrentSynthAudio();

    // Pleasant rock chord progression frequencies (A minor / D / G / C)
    const chords = [
      [220.0, 261.63, 329.63], // Am
      [146.83, 220.0, 293.66], // D
      [196.0, 246.94, 293.66], // G
      [261.63, 329.63, 392.0], // C
    ];

    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.12, audioContext.currentTime);
    masterGain.connect(audioContext.destination);

    let startTime = audioContext.currentTime;

    chords.forEach((chord) => {
      chord.forEach((freq) => {
        const osc = audioContext.createOscillator();
        const noteGain = audioContext.createGain();

        osc.type = 'triangle'; // Warm guitar-like harmonic
        osc.frequency.setValueAtTime(freq, startTime);

        // Envelope: pluck and decay
        noteGain.gain.setValueAtTime(0.01, startTime);
        noteGain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + 1.25);
        currentSynthOscillators.push(osc);
      });
      startTime += 0.8;
    });
  } catch (e) {
    console.warn('Audio demo synth warning:', e);
  }
}

function toggleAudioDemo(btn, title) {
  const isPlaying = btn.classList.contains('playing');

  // Stop currently playing
  if (currentPlayingDemo && currentPlayingDemo !== btn) {
    currentPlayingDemo.classList.remove('playing');
    const oldIcon = currentPlayingDemo.querySelector('.play-icon');
    if (oldIcon) oldIcon.textContent = '▶';
  }

  if (isPlaying) {
    btn.classList.remove('playing');
    const playIcon = btn.querySelector('.play-icon');
    if (playIcon) playIcon.textContent = '▶';
    currentPlayingDemo = null;
    stopCurrentSynthAudio();
    showToast(`Paused demo for "${title}"`, 'info');
  } else {
    btn.classList.add('playing');
    const playIcon = btn.querySelector('.play-icon');
    if (playIcon) playIcon.textContent = '⏸';
    currentPlayingDemo = btn;

    playHarmonicSynthDemo();
    showToast(`▶ Playing Live Demo Preview: "${title}"`, 'success');

    // Auto reset after 8 seconds
    setTimeout(() => {
      if (btn.classList.contains('playing')) {
        btn.classList.remove('playing');
        if (playIcon) playIcon.textContent = '▶';
        if (currentPlayingDemo === btn) currentPlayingDemo = null;
      }
    }, 8000);
  }
}

// ==========================================
// 12. Modal & Notification System
// ==========================================
function setupModals() {
  // Close triggers
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal(btn.getAttribute('data-close'));
    });
  });

  // Close modal when clicking on overlay background
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
      }
    });
  });
}

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('open');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('open');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '🚫' : 'ℹ️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Global exports for inline HTML onclick handlers
window.switchTab = switchTab;
window.openDirectBooking = openDirectBooking;
window.openArtistSpecification = openArtistSpecification;
window.applyForGig = applyForGig;
window.cancelBooking = cancelBooking;
window.toggleAudioDemo = toggleAudioDemo;
window.setPostGigPreset = setPostGigPreset;
window.setDirectBookingPreset = setDirectBookingPreset;
window.recalculateDirectBookingFee = recalculateDirectBookingFee;
window.closeModal = closeModal;
