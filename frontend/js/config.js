// Where the API lives.
// On localhost the backend serves this folder (same origin). Everywhere else the browser calls Render directly.
window.BU_CONFIG = {
  API_BASE: ['localhost', '127.0.0.1'].includes(location.hostname) ? '' : 'https://buhostels-api.onrender.com'
};
