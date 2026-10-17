const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

// Service-role client: full access, backend only. Never send this key to the browser.
const admin = createClient(url || 'http://localhost:54321', process.env.SUPABASE_SERVICE_ROLE_KEY || 'missing', options);

// A fresh anon client per sign-in, so one person's session never leaks into another request.
function authClient() {
  return createClient(url || 'http://localhost:54321', process.env.SUPABASE_ANON_KEY || 'missing', options);
}

const BUCKET = process.env.SUPABASE_BUCKET || 'hostel-images';

module.exports = { admin, authClient, BUCKET };
