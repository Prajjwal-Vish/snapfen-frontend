// signup.js
document.addEventListener("DOMContentLoaded", () => {

    if (isLoggedIn()) {
        window.location.href = "index.html"
        return
    }

    const form = document.getElementById("signup-form")

    form.addEventListener("submit", async (e) => {
        e.preventDefault()

        const username = document.querySelector("input[name='username']").value
        const email = document.querySelector("input[name='email']").value
        const password = document.querySelector("input[name='password']").value

        const btn = form.querySelector("button[type='submit']")
        btn.textContent = "Creating account..."
        btn.disabled = true

        try {
            const res = await fetch(`${window.API_BASE}/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            })

            const data = await res.json()

            if (res.ok) {
                // SIGNUP SUCCESSFUL
                // redirect to login — user needs to log in to get a token
                alert("Account created! Please log in.")
                window.location.href = "login.html"

            } else {
                alert(data.error || "Signup failed")
                btn.textContent = "Sign Up"
                btn.disabled = false
            }

        } catch (err) {
            alert("Could not reach server.")
            btn.textContent = "Sign Up"
            btn.disabled = false
        }
    })
})