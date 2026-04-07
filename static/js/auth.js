function saveAuth(token, username) {
    localStorage.setItem('snapfen_token', token)
    localStorage.setItem('snapfen_username', username)
}

// Read token — called every time we make an API request
function getToken() {
    return localStorage.getItem('snapfen_token')
}

// Read username — called to display in navbar
function getUsername() {
    return localStorage.getItem('snapfen_username')
}

// Check if user is logged in — just checks if token exists
function isLoggedIn() {
    return getToken() !== null

}

// Delete token — called on logout
function clearAuth() {
    localStorage.removeItem('snapfen_token')
    localStorage.removeItem('snapfen_username')
}

function authFetch(url, options = {}) {
    // options = {} means — if nothing passed in, default to empty object
    
    const token = getToken()
    // read token from localStorage
    
    // build headers object
    const headers = {
        ...options.headers
    }
    
    // only add Authorization header if token exists
    // (anonymous requests like /predict don't need it)
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
        // "Bearer" is a standard HTTP auth scheme name
        // Flask-JWT reads this header and extracts "eyJ..." part
    }

    // for JSON requests, add Content-Type
    // but NOT for FormData (file uploads) — browser sets it automatically
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json'
    }
    
    // return fetch with our headers merged in
    return fetch(url, {
        ...options,      // spread all original options (method, body, etc.)
        headers          // override with our headers (includes Authorization)
    })
}

// ─────────────────────────────────────────────
// checkAuth — call on every page load
// updates the navbar UI based on login state
// ─────────────────────────────────────────────

function checkAuth() {
    if (!isLoggedIn()) {
        // not logged in — show login/signup, hide logout
        document.getElementById("login-link")?.classList.remove("hidden")
        document.getElementById("signup-link")?.classList.remove("hidden")
        document.getElementById("logout-btn")?.classList.add("hidden")
        document.getElementById("username-display")?.classList.add("hidden")
        return
        // return stops the function here — no point continuing
    }

    // logged in — show logout button, hide login/signup
    document.getElementById("logout-btn")?.classList.remove("hidden")
    document.getElementById("login-link")?.classList.add("hidden")
    document.getElementById("signup-link")?.classList.add("hidden")

    // show username in navbar
    const usernameEl = document.getElementById("username-display")
    if (usernameEl) {
        usernameEl.textContent = getUsername()
        usernameEl.classList.remove("hidden")
    }
}

// ─────────────────────────────────────────────
// setupLogout — attach logout button listener
// call this inside DOMContentLoaded
// ─────────────────────────────────────────────

function setupLogout() {
    const logoutBtn = document.getElementById("logout-btn")
    
    if (!logoutBtn) return
    // if button doesn't exist on this page, stop
    
    logoutBtn.addEventListener("click", async () => {
        try {
            // tell backend (optional — just for completeness)
            await authFetch(`${window.API_BASE}/logout`, {
                method: "POST"
            })
        } catch(e) {
            // even if this fails, we still log out locally
        }
        
        // THE ACTUAL LOGOUT — delete token from localStorage
        clearAuth()
        
        // reload page — checkAuth() will run again
        // find no token — show login/signup UI
        location.reload()
    })
}