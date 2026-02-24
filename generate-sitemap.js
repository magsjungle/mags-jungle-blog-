const fs = require("fs");
const path = require("path");

const BASE_URL = "https://magsjungle.com";
const EXCLUDE = ["google833bd3acc0ce5407.html", "research.html"];

function findHtmlFiles(dir, base = dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(findHtmlFiles(full, base));
    } else if (entry.endsWith(".html")) {
      const rel = path.relative(base, full).replace(/\\/g, "/");
      if (!EXCLUDE.includes(rel)) results.push(rel);
    }
  }
  return results;
}

const pages = findHtmlFiles(__dirname);

const urls = pages.map((p) => {
  const url = p === "index.html" ? BASE_URL + "/" : BASE_URL + "/" + p;
  return `  <url><loc>${url}</loc></url>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

fs.writeFileSync(path.join(__dirname, "sitemap.xml"), xml);
console.log(`Sitemap generated with ${pages.length} pages.`);
