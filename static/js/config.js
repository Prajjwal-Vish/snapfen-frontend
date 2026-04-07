// Auto-detects local vs deployed environment

const isLocal = window.location.hostname === 'localhost' 
             || window.location.hostname === '127.0.0.1';

const API_BASE = isLocal 
    ? 'http://localhost:5000' 
    : 'https://snapfen-backend.onrender.com';

// Export for other scripts
window.API_BASE = API_BASE;

console.log(`[SnapFen] Environment: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
console.log(`[SnapFen] API: ${API_BASE}`);