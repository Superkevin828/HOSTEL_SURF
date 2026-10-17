const { admin } = require('./supabase');

// Fire-and-forget activity log. Never blocks or breaks a request.
function logEvent(type, { hostel_id = null, actor_id = null, meta = {} } = {}) {
  try {
    Promise.resolve(admin.from('events').insert({ type, hostel_id, actor_id, meta }))
      .then((r) => {
        if (r && r.error) console.error('[event]', type, r.error.message);
      })
      .catch((e) => console.error('[event]', type, e.message));
  } catch (e) {
    console.error('[event]', type, e.message);
  }
}

module.exports = { logEvent };
