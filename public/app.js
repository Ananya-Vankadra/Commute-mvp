const state = {
  corridor: null,
  stops: [],
  lastRequestId: null,
  metrics: { searches: 0, saved: false, feedback: 'none' }
};

const el = (id) => document.getElementById(id);

function renderMetrics() {
  el('mReq').textContent = state.metrics.searches;
  el('mSave').textContent = state.metrics.saved ? 'yes' : 'no';
  el('mFb').textContent = state.metrics.feedback;
}

async function logEvent(type, meta) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, meta })
    });
  } catch (_) { /* best-effort, never block the UI on this */ }
}

async function loadCorridor() {
  const corridors = await fetch('/api/corridors').then(r => r.json());
  if (!corridors.length) {
    el('corridorName').textContent = 'No corridor seeded yet';
    el('corridorLabel').textContent = 'Run npm run seed first';
    return;
  }
  state.corridor = corridors[0]; // single-corridor pilot — first one wins
  el('corridorLabel').textContent = `Corridor · ${state.corridor.city}`;
  el('corridorName').textContent = state.corridor.name;

  state.stops = await fetch(`/api/corridors/${state.corridor.id}/stops`).then(r => r.json());
  const fromSel = el('from');
  const toSel = el('to');
  fromSel.innerHTML = '';
  toSel.innerHTML = '';
  state.stops.forEach(s => {
    fromSel.appendChild(new Option(s.name, s.id));
    toSel.appendChild(new Option(s.name, s.id));
  });
  if (state.stops.length > 1) toSel.selectedIndex = 1;
}

function dotClass(mode) {
  if (mode === 'Train') return 'rail';
  if (mode === 'City bus' || mode === 'Shuttle') return 'wheel';
  return '';
}

function legHTML(leg) {
  const waitText = leg.wait_min ? ` (+${leg.wait_min} min wait)` : '';
  const departText = leg.departs_at ? ` · departs ${leg.departs_at}` : '';
  return `
    <li class="leg">
      <span class="dot ${dotClass(leg.mode)}"></span>
      <div class="leg-mode">${leg.mode}</div>
      <div class="leg-route">${leg.from} → ${leg.to}</div>
      <div class="leg-meta">${leg.duration_min} min${waitText}${departText}</div>
      ${leg.live ? '<div class="leg-live">live traffic estimate</div>' : ''}
      ${leg.note ? `<div class="leg-note">${leg.note}</div>` : ''}
    </li>
  `;
}

function routeCardHTML(route, isBest, usualMin, requestId) {
  const diff = usualMin - route.total_min;
  const savedLine = isBest && diff > 0
    ? `<div class="saved-line">${diff} min back today · ${(diff * 5 / 60).toFixed(1)} hrs over a work week</div>`
    : '';

  return `
    <div class="route-card ${isBest ? 'best' : ''}" data-route-id="${route.route_id}">
      ${isBest ? '<span class="best-tag">FASTEST NOW</span>' : ''}
      <div class="route-head">
        <div>
          <div class="route-name">${route.name}</div>
          ${route.note ? `<p class="route-note">${route.note}</p>` : ''}
        </div>
        <div class="route-time">${route.total_min}<span> min</span></div>
      </div>
      ${savedLine}
      <ul class="legs">${route.legs.map(legHTML).join('')}</ul>
      ${isBest ? `
        <div class="feedback" data-request-id="${requestId}">
          <button data-v="true">This was accurate</button>
          <button data-v="false">Timing was off</button>
        </div>
        <p class="thanks hidden">Logged. That's how the timings get better.</p>
        <button class="ghost save-btn">Save as my daily route</button>
      ` : ''}
    </div>
  `;
}

function attachResultHandlers() {
  const fb = document.querySelector('.feedback');
  if (fb) {
    fb.addEventListener('click', async (e) => {
      if (e.target.tagName !== 'BUTTON') return;
      const accurate = e.target.dataset.v === 'true';
      const requestId = Number(fb.dataset.requestId);
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, accurate })
      });
      fb.classList.add('hidden');
      fb.nextElementSibling.classList.remove('hidden');
      state.metrics.feedback = accurate ? 'accurate' : 'off';
      renderMetrics();
    });
  }

  const saveBtn = document.querySelector('.save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      state.metrics.saved = true;
      saveBtn.textContent = "Saved. We'll open here tomorrow.";
      saveBtn.disabled = true;
      await logEvent('save', { route_id: state.corridor.id });
      renderMetrics();
    });
  }
}

async function runSearch() {
  const fromId = Number(el('from').value);
  const toId = Number(el('to').value);
  const departAt = el('leave').value;
  const usualMin = Number(el('usual').value) || null;

  el('formError').classList.add('hidden');
  if (fromId === toId) {
    el('formError').textContent = 'Pick two different stops.';
    el('formError').classList.remove('hidden');
    return;
  }

  el('result').classList.add('hidden');
  el('loading').classList.remove('hidden');
  el('go').disabled = true;

  try {
    const res = await fetch('/api/routes/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin_stop_id: fromId,
        dest_stop_id: toId,
        depart_at: departAt,
        baseline_min: usualMin
      })
    });
    const data = await res.json();

    if (!res.ok) {
      el('formError').textContent = data.error || 'Something went wrong.';
      el('formError').classList.remove('hidden');
      return;
    }

    const cards = data.routes
      .map((r, i) => routeCardHTML(r, i === 0, usualMin ?? r.total_min, data.requestId))
      .join('');
    el('result').innerHTML = cards;
    el('result').classList.remove('hidden');
    attachResultHandlers();

    state.metrics.searches += 1;
    renderMetrics();
    el('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    el('formError').textContent = 'Could not reach the server. Is it running?';
    el('formError').classList.remove('hidden');
  } finally {
    el('loading').classList.add('hidden');
    el('go').disabled = false;
  }
}

el('go').addEventListener('click', runSearch);

loadCorridor();
logEvent('visit');
renderMetrics();
