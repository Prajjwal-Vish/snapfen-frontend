// login.js
document.addEventListener("DOMContentLoaded", () => {

    // if already logged in, redirect to home — no point showing login page
    if (isLoggedIn()) {
        window.location.href = "index.html"
        return
    }

    const form = document.getElementById("login-form")

    form.addEventListener("submit", async (e) => {
        e.preventDefault()

        const email = document.querySelector("input[name='email']").value
        const password = document.querySelector("input[name='password']").value

        // show loading state on button
        const btn = form.querySelector("button[type='submit']")
        const originalText = btn.textContent
        btn.textContent = "Logging in..."
        btn.disabled = true

        try {
            const res = await fetch(`${window.API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // NO credentials: "include" — we don't use cookies
                body: JSON.stringify({ email, password })
            })

            const data = await res.json()

            if (res.ok) {
                // LOGIN SUCCESSFUL
                // save token and username to localStorage using our helper
                saveAuth(data.token, data.username)
                // saveAuth is defined in auth.js
                // it does:
                //   localStorage.setItem('snapfen_token', data.token)
                //   localStorage.setItem('snapfen_username', data.username)

                // redirect to home page
                window.location.href = "index.html"

            } else {
                // LOGIN FAILED — show error
                alert(data.error || "Login failed")
                btn.textContent = originalText
                btn.disabled = false
            }

        } catch (err) {
            // NETWORK ERROR
            alert("Could not reach server. Check your connection.")
            btn.textContent = originalText
            btn.disabled = false
        }
    })
})