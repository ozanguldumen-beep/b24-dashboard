const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// ─── KULLANICILAR ────────────────────────────────────────
// Şifreleri Railway'de Environment Variables olarak tanımlayın:
// PASS_OZAN, PASS_MUDIR, PASS_SATIS, PASS_TEKNIK
// Örnek: PASS_OZAN = gizlisifre123
const USERS = {
  'ozan':   hash(process.env.PASS_OZAN   || 'ozan123'),
  'mudir':  hash(process.env.PASS_MUDIR  || 'mudir123'),
  'satis':  hash(process.env.PASS_SATIS  || 'satis123'),
  'teknik': hash(process.env.PASS_TEKNIK || 'teknik123'),
};

function hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ─── SESSION ─────────────────────────────────────────────
const sessions = {};
const TTL = 8 * 60 * 60 * 1000; // 8 saat

function newSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { user, exp: Date.now() + TTL };
  return token;
}
function getSession(token) {
  if (!token || !sessions[token]) return null;
  if (sessions[token].exp < Date.now()) { delete sessions[token]; return null; }
  return sessions[token];
}
function parseCookies(h) {
  const c = {}; if (!h) return c;
  h.split(';').forEach(p => { const [k,v] = p.split('='); if(k) c[k.trim()] = (v||'').trim(); });
  return c;
}
function parseBody(req) {
  return new Promise(resolve => {
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      const p = {}; b.split('&').forEach(s => { const [k,v] = s.split('='); if(k) p[decodeURIComponent(k)] = decodeURIComponent(v||''); }); resolve(p);
    });
  });
}

// ─── LOGIN HTML ──────────────────────────────────────────
function loginPage(error) {
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>B24 Rapor — Giriş</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#060d1a;color:#f1f5f9;font-family:'DM Sans',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
  background-image:radial-gradient(ellipse at 20% 50%,rgba(29,78,216,.15) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(79,70,229,.1) 0%,transparent 50%)}
.box{background:#0d1b2e;border:1px solid #1e293b;border-radius:20px;padding:40px;max-width:400px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,.5)}
.logo{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#1d4ed8,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 20px}
h1{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#f1f5f9;text-align:center;margin-bottom:4px}
.sub{color:#475569;font-size:12px;text-align:center;margin-bottom:28px;line-height:1.5}
label{font-size:10px;color:#475569;font-weight:700;letter-spacing:1px;display:block;margin-bottom:5px;text-transform:uppercase}
input{width:100%;padding:12px 14px;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;margin-bottom:14px;font-family:'DM Sans',sans-serif;transition:border-color .2s}
input:focus{border-color:#3b82f6}
button{width:100%;padding:13px;background:linear-gradient(135deg,#1d4ed8,#4f46e5);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;margin-top:4px;letter-spacing:.3px}
button:hover{opacity:.9;transform:translateY(-1px)}
.err{background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:10px 14px;color:#fca5a5;font-size:12px;margin-bottom:14px;text-align:center}
.foot{text-align:center;margin-top:24px;font-size:11px;color:#1e293b}
</style></head><body>
<div class="box">
  <div class="logo">📊</div>
  <h1>B24 Rapor</h1>
  <div class="sub">Modüler Otomasyon<br>Yönetim Paneli</div>
  ${error ? '<div class="err">⚠ Kullanıcı adı veya şifre hatalı.</div>' : ''}
  <form method="POST" action="/login">
    <label>Kullanıcı Adı</label>
    <input type="text" name="username" placeholder="kullanıcı adınız" required autocomplete="username"/>
    <label>Şifre</label>
    <input type="password" name="password" placeholder="••••••••" required autocomplete="current-password"/>
    <button type="submit">Giriş Yap →</button>
  </form>
  <div class="foot">Modüler Otomasyon © 2026</div>
</div>
</body></html>`;
}

// ─── SUNUCU ──────────────────────────────────────────────
http.createServer(async (req, res) => {
  const cookies = parseCookies(req.headers['cookie']);
  const session = getSession(cookies['b24s']);
  const url = req.url.split('?')[0];

  // POST /login
  if (req.method === 'POST' && url === '/login') {
    const body = await parseBody(req);
    const username = (body.username || '').toLowerCase().trim();
    const pw = hash(body.password || '');
    if (USERS[username] && USERS[username] === pw) {
      const token = newSession(username);
      res.writeHead(302, { 'Set-Cookie': `b24s=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`, 'Location': '/' });
      res.end();
    } else {
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(true));
    }
    return;
  }

  // GET /logout
  if (url === '/logout') {
    if (cookies['b24s']) delete sessions[cookies['b24s']];
    res.writeHead(302, { 'Set-Cookie': 'b24s=; Path=/; HttpOnly; Max-Age=0', 'Location': '/login' });
    res.end(); return;
  }

  // GET /login
  if (url === '/login') {
    if (session) { res.writeHead(302, { 'Location': '/' }); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(loginPage(false)); return;
  }

  // Korumalı — session yoksa login'e
  if (!session) {
    res.writeHead(302, { 'Location': '/login' });
    res.end(); return;
  }

  // Static files
  if(url === '/manifest.json') {
    fs.readFile(path.join(__dirname, 'manifest.json'), (err, data) => {
      if(err){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':'application/manifest+json'});res.end(data);
    });return;
  }
  if(url === '/sw.js') {
    fs.readFile(path.join(__dirname, 'sw.js'), (err, data) => {
      if(err){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':'application/javascript','Service-Worker-Allowed':'/'});res.end(data);
    });return;
  }
  if(url === '/icon-192.png' || url === '/icon-512.png') {
    fs.readFile(path.join(__dirname, url.slice(1)), (err, data) => {
      if(err){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public,max-age=86400'});res.end(data);
    });return;
  }

  // Ana dashboard
  fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
    if (err) { res.writeHead(500); res.end('Hata'); return; }
    const userBar = `<div style="position:fixed;bottom:16px;right:16px;z-index:200;background:#0d1b2e;border:1px solid #1e293b;border-radius:12px;padding:8px 16px;display:flex;align-items:center;gap:12px;font-size:12px;font-family:'DM Sans',sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.4)">
      <span style="color:#64748b">👤 <b style="color:#94a3b8">${session.user}</b></span>
      <a href="/logout" style="color:#f87171;font-weight:600;text-decoration:none;font-size:11px;padding:3px 8px;background:#450a0a;border-radius:8px">Çıkış</a>
    </div>`;
    // Webhook URL'yi environment variable'dan inject et
    const webhookUrl = process.env.BITRIX_WEBHOOK || '';
    const autoWebhook = webhookUrl ? `<script>
      (function(){
        var stored = localStorage.getItem('b24_wh_v3');
        if(!stored && '${webhookUrl}') {
          localStorage.setItem('b24_wh_v3', '${webhookUrl}');
        }
      })();
    </script>` : '';
    let html = data.toString()
      .replace('</body>', userBar + '</body>')
      .replace('<script>', autoWebhook + '<script>');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

}).listen(PORT, () => console.log('B24 Rapor: http://localhost:' + PORT));
