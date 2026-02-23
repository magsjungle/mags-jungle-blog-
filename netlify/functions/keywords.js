// Netlify Function: keywords.js
// Proxies Google, YouTube, TikTok, and Instagram autocomplete

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

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

  const [googleRes, youtubeRes, tiktokRes, instagramRes] = await Promise.allSettled([
    fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encoded}`),
    fetch(`https://suggestqueries.google.com/complete/search?client=youtube&q=${encoded}`),
    fetch(`https://www.tiktok.com/api/suggest/complete/?keyword=${encoded}&count=10&from_page=search`, {
      headers: {
        'User-Agent': MOBILE_UA,
        'Referer': 'https://www.tiktok.com/',
        'Accept': 'application/json',
      },
    }),
    fetch(`https://www.instagram.com/web/search/topsearch/?query=${encoded}&context=hashtag`, {
      headers: {
        'User-Agent': MOBILE_UA,
        'Accept': 'application/json, text/plain, */*',
        'X-IG-App-ID': '936619743392459',
      },
    }),
  ]);

  return {
    statusCode: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: q,
      google:    await parseGoogle(googleRes),
      youtube:   await parseYoutube(youtubeRes),
      tiktok:    await parseTikTok(tiktokRes),
      instagram: await parseInstagram(instagramRes),
    }),
  };
}

async function parseGoogle(settled) {
  try {
    if (settled.status !== 'fulfilled') return [];
    const data = await settled.value.json();
    // ["keyword", ["sug1", "sug2", ...]]
    return Array.isArray(data[1]) ? data[1] : [];
  } catch { return []; }
}

async function parseYoutube(settled) {
  try {
    if (settled.status !== 'fulfilled') return [];
    const text = await settled.value.text();
    // JSONP: window.google.ac.h(["keyword",[["sug",0,[]],...],...])
    const match = text.match(/\((\[.*\])\)/s);
    if (!match) return [];
    const data = JSON.parse(match[1]);
    const suggestions = data[1];
    if (!Array.isArray(suggestions)) return [];
    return suggestions.map(item => (Array.isArray(item) ? item[0] : item)).filter(Boolean);
  } catch { return []; }
}

async function parseTikTok(settled) {
  try {
    if (settled.status !== 'fulfilled') return [];
    const data = await settled.value.json();
    // { sug_list: [{ word: "..." }, ...], status_code: 0 }
    if (!Array.isArray(data?.sug_list)) return [];
    return data.sug_list.map(item => item.word).filter(Boolean);
  } catch { return []; }
}

async function parseInstagram(settled) {
  try {
    if (settled.status !== 'fulfilled') return [];
    const data = await settled.value.json();
    // { hashtags: [{ hashtag: { name, media_count } }, ...] }
    if (!Array.isArray(data?.hashtags)) return [];
    return data.hashtags
      .slice(0, 10)
      .map(h => ({ name: h.hashtag?.name, count: h.hashtag?.media_count ?? null }))
      .filter(h => h.name);
  } catch { return []; }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
