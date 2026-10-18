// Where the API lives.
//  - Local (npm start): same origin, so leave it empty.
//  - Cloudflare Pages: set PRODUCTION_API to your Render URL (no trailing slash).
(function () {
  var PRODUCTION_API = 'https://buhostels-api.onrender.com';
  var h = location.hostname;
  var local = h === 'localhost' || h === '127.0.0.1' || h === '';
  window.BU_CONFIG = { API_BASE: local ? '' : PRODUCTION_API };
})();
