const API_BASE = "https://snapfen-backend.onrender.com";

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("login-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.querySelector("input[name='email']").value;
        const password = document.querySelector("input[name='password']").value;

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                window.location.href = "index.html";
            } else {
                alert(data.error || "Login failed");
            }

        } catch {
            alert("Server error");
        }
    });

});