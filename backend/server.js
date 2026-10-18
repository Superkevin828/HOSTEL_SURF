require('dotenv').config({ quiet: true });

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { admin } = require('./src/supabase');

const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `\n[BUhostels] These are missing from backend/.env: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill them in (Supabase dashboard → Project Settings → API).\n'
  );
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const origins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
// CORS_ORIGIN is a comma-separated list. "*.pages.dev" style wildcards work too (Cloudflare preview URLs).
const allowed = (origin) =>
  origins.some((o) => {
    if (o === origin) return true;
    if (o.startsWith('*.') || o.startsWith('https://*.')) {
      const suffix = o.replace('https://', '').slice(1); // ".pages.dev"
      try {
        return new URL(origin).hostname.endsWith(suffix);
      } catch (e) {
        return false;
      }
    }
    return false;
  });
app.use(
  cors({
    origin: origins.length ? (origin, cb) => cb(null, !origin || allowed(origin)) : true,
    maxAge: 86400,
  })
);
app.use(compression());
app.use(express.json({ limit: '100kb' }));

const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message } });

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
// Public reads can be cached briefly by browsers and Cloudflare, so most visits never wake the server.
app.use(['/api/hostels', '/api/meta'], (req, res, next) => {
  if (req.method === 'GET' && !req.headers.authorization) res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  next();
});

const xmlEscape = (value) =>
  String(value == null ? '' : value).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const siteUrl = (process.env.SITE_URL || 'https://buhostels.example').replace(/\/+$/, '');

app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const hostels = [];
    let offset = 0;
    while (true) {
      const { data, error } = await admin
        .from('hostels')
        .select('id,name,area,updated_at,owner:profiles(status),hostel_images(url,is_cover)')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .range(offset, offset + 999);
      if (error) throw error;
      const page = data || [];
      hostels.push(...page.filter((h) => h.owner && h.owner.status === 'approved'));
      if (page.length < 1000) break;
      offset += 1000;
    }

    const staticPages = [
      { path: '/', priority: '1.0', frequency: 'daily' },
      { path: '/documentation.html', priority: '0.7', frequency: 'monthly' },
      { path: '/terms.html', priority: '0.3', frequency: 'yearly' },
      { path: '/privacy.html', priority: '0.3', frequency: 'yearly' },
    ];
    const urls = staticPages
      .map(
        (page) =>
          `<url><loc>${xmlEscape(siteUrl + page.path)}</loc><changefreq>${page.frequency}</changefreq><priority>${page.priority}</priority></url>`
      );

    for (const hostel of hostels) {
      const image = (hostel.hostel_images || []).find((item) => item.is_cover) || (hostel.hostel_images || [])[0];
      const location = `${siteUrl}/hostel.html?id=${encodeURIComponent(hostel.id)}`;
      const lastmod = hostel.updated_at ? `<lastmod>${xmlEscape(new Date(hostel.updated_at).toISOString())}</lastmod>` : '';
      const imageTag = image
        ? `<image:image><image:loc>${xmlEscape(image.url)}</image:loc><image:title>${xmlEscape(hostel.name + ' hostel near Busitema University')}</image:title><image:caption>${xmlEscape(hostel.name + ' in ' + hostel.area + ', student accommodation near Busitema University')}</image:caption></image:image>`
        : '';
      urls.push(`<url><loc>${xmlEscape(location)}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.8</priority>${imageTag}</url>`);
    }

    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.join('')}</urlset>`
    );
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth/login', limiter(15 * 60 * 1000, 30, 'Too many sign-in attempts. Try again in a few minutes.'));
app.use('/api/auth/register', limiter(60 * 60 * 1000, 15, 'Too many sign-ups from this connection. Try again later.'));
app.use('/api/track', limiter(60 * 1000, 150, 'Slow down.'));
app.use('/api', limiter(15 * 60 * 1000, 1500, 'Too many requests. Please slow down.'));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/owner', require('./src/routes/owner'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api', require('./src/routes/public'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// The backend also serves the frontend folder, so one command runs the whole site locally.
const frontendDir = path.join(__dirname, '..', 'frontend');
if (process.env.SERVE_FRONTEND !== 'false' && fs.existsSync(frontendDir)) {
  app.use(
    express.static(frontendDir, {
      extensions: ['html'],
      maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    })
  );
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Each photo must be under 6 MB.'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'You can upload up to 8 photos at a time.'
          : 'That upload was not accepted.';
    return res.status(400).json({ error: msg });
  }
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'That request was not valid.' });
  if (err && err.expose) return res.status(err.status || 400).json({ error: err.message, code: err.errCode });
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`\n  BUhostels is running → http://localhost:${port}\n`);
});
