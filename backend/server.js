require('dotenv').config({ quiet: true });

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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
app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json({ limit: '100kb' }));

const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message } });

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

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
if (fs.existsSync(frontendDir)) {
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
