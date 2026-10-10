// Live duration lookups for walk/auto legs.
//
// If GOOGLE_MAPS_API_KEY is set in .env, this calls the real Google Maps
// Directions API (free tier covers a pilot easily — a few thousand
// requests/month before any charge). If no key is set, it falls back to a
// straight-line distance estimate so the app still runs end-to-end while
// you're setting things up.

const HAVERSINE_SPEED_KMH = { walking: 4.5, driving: 18 }; // rough Indian city-traffic auto speed

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fallbackEstimate(origin, destination, travelMode) {
  const km = haversineKm(origin, destination);
  const speed = HAVERSINE_SPEED_KMH[travelMode] ?? 15;
  const minutes = Math.max(1, Math.round((km / speed) * 60));
  return { minutes, source: 'estimated (no Google Maps API key set)' };
}

async function getDuration(origin, destination, mode) {
  const travelMode = mode === 'auto' ? 'driving' : 'walking';
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return fallbackEstimate(origin, destination, travelMode);
  }

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  url.searchParams.set('mode', travelMode);
  url.searchParams.set('key', apiKey);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      console.warn('Google Directions API returned', data.status, '— using fallback estimate');
      return fallbackEstimate(origin, destination, travelMode);
    }

    const seconds = data.routes[0].legs[0].duration.value;
    return { minutes: Math.round(seconds / 60), source: 'google-maps' };
  } catch (err) {
    console.warn('Google Directions API request failed — using fallback estimate:', err.message);
    return fallbackEstimate(origin, destination, travelMode);
  }
}

module.exports = { getDuration, haversineKm };
