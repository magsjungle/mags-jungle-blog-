// Netlify Function: keywords.js
// Proxies Google + YouTube autocomplete to avoid CORS restrictions

export async function handler(event) {
  const q = event.queryStringParameters?.q?.trim();

  if (!q) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Missing query parameter: q' }),
    };
  }

  const encoded = encodeURIComponent(q);
  const [googleRes, youtubeRes] = await Promise.allSettled([
    fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encoded}`),
    fetch(`https://suggestqueries.google.com/complete/search?client=youtube&q=${encoded}`),
  ]);

  const google = await parseGoogle(googleRes);
  const youtube = await parseYoutube(youtubeRes);

  return {
    statusCode: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: q, google, youtube }),
  };
}

async function parseGoogle(settled) {
  try {
    if (settled.status !== 'fulfilled') return [];
    const data = await settled.value.json();
    // Response: ["keyword", ["suggestion1", "suggestion2", ...]]
    return Array.isArray(data[1]) ? data[1] : [];
  } catch {
    return [];
  }
}

async function parseYoutube(settled) {
  try {
    if (settled.status !== 'fulfilled') return [];
    const text = await settled.value.text();
    // Response is JSONP: window.google.ac.h(["keyword",[["suggestion",0,[]],...],...])
    // Extract the inner array
    const match = text.match(/\((\[.*\])\)/s);
    if (!match) return [];
    const data = JSON.parse(match[1]);
    const suggestions = data[1];
    if (!Array.isArray(suggestions)) return [];
    return suggestions.map(item => (Array.isArray(item) ? item[0] : item)).filter(Boolean);
  } catch {
    return [];
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
