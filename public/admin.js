const el = (id) => document.getElementById(id);

async function loadMetrics() {
  const m = await fetch('/api/admin/metrics').then(r => r.json());
  const stats = [
    ['Visits', m.visits],
    ['Searches', m.searches],
    ['Saved routes', m.saves],
    ['Accurate feedback', m.feedback.accurate],
    ['Off feedback', m.feedback.inaccurate],
    ['Avg min saved', m.avg_minutes_saved ?? '—']
  ];
  el('statGrid').innerHTML = stats.map(([label, n]) => `
    <div class="stat"><div class="n">${n}</div><div class="l">${label}</div></div>
  `).join('');
}

async function loadSegments() {
  const corridors = await fetch('/api/corridors').then(r => r.json());
  if (!corridors.length) return;
  const corridorId = corridors[0].id;

  const segments = await fetch(`/api/admin/segments?corridor_id=${corridorId}`).then(r => r.json());
  const fixedSegments = segments.filter(s => !s.dynamic); // walk/auto are live, not editable here

  el('segBody').innerHTML = fixedSegments.map(seg => {
    const times = seg.scheduled_times ? JSON.parse(seg.scheduled_times).join(', ') : '';
    return `
      <tr data-id="${seg.id}">
        <td>${seg.mode}</td>
        <td>${seg.from_name} → ${seg.to_name}</td>
        <td><input type="number" class="f-duration" value="${seg.duration_min ?? ''}" style="width:70px"></td>
        <td><input type="text" class="f-times" value="${times}" style="width:160px"></td>
        <td><input type="text" class="f-note" value="${seg.reliability_note ?? ''}" style="width:220px"></td>
        <td><button class="save-row">Save</button><span class="saved-flash hidden">Saved</span></td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.save-row').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('tr');
      const id = row.dataset.id;
      const duration_min = Number(row.querySelector('.f-duration').value) || null;
      const timesRaw = row.querySelector('.f-times').value.trim();
      const scheduled_times = timesRaw ? timesRaw.split(',').map(t => t.trim()) : null;
      const reliability_note = row.querySelector('.f-note').value.trim() || null;

      await fetch(`/api/admin/segments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_min, scheduled_times, reliability_note, last_updated_by: 'admin-ui' })
      });

      const flash = row.querySelector('.saved-flash');
      flash.classList.remove('hidden');
      setTimeout(() => flash.classList.add('hidden'), 1500);
      loadMetrics();
    });
  });
}

loadMetrics();
loadSegments();
