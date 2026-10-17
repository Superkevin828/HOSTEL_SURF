// Tiny in-memory cache for the public hostel list. Any owner/admin write clears it.
const store = new Map();
const TTL_MS = 15000;

module.exports = {
  get(key) {
    const hit = store.get(key);
    return hit && Date.now() - hit.at < TTL_MS ? hit.value : null;
  },
  set(key, value) {
    store.set(key, { at: Date.now(), value });
    return value;
  },
  bust() {
    store.clear();
  },
};
