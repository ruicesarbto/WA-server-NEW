// Runtime configuration - injected by server
window.APP_CONFIG = {
  API_BASE_URL: window.location.origin,
  FRONTEND_URI: window.location.origin,
  BACK_URI: window.location.origin
};

// Intercept fetch and replace domain
const originalFetch = window.fetch;
window.fetch = function(...args) {
  let url = args[0];
  if (typeof url === 'string' && url.includes('https://chat.scoremark1.com')) {
    url = url.replace('https://chat.scoremark1.com', window.location.origin);
    args[0] = url;
  }
  return originalFetch.apply(this, args);
};

// Intercept XMLHttpRequest
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  if (typeof url === 'string' && url.includes('https://chat.scoremark1.com')) {
    url = url.replace('https://chat.scoremark1.com', window.location.origin);
  }
  return originalOpen.apply(this, [method, url, ...rest]);
};
