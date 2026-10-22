
(function () {
  var PRODUCTION_API = 'https://buhostelsapi.onrender.com';
  var h = location.hostname;
  var local = h === 'localhost' || h === '127.0.0.1' || h === '';
  window.BU_CONFIG = { API_BASE: local ? '' : PRODUCTION_API };
})();
