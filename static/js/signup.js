const API_BASE = "https://snapfen-backend.onrender.com";

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("signup-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = document.querySelector("input[name='username']").value;
        const email = document.querySelector("input[name='email']").value;
        const password = document.querySelector("input[name='password']").value;

        try {
            const res = await fetch(`${API_BASE}/signup`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    username,
                    email,
                    password
                })
            });

            const data = await res.json();

            if (res.ok) {
                alert("Account created successfully!");
                window.location.href = "login.html";
            } else {
                alert(data.error || "Signup failed");
            }

        } catch (err) {
            alert("Server error");
        }

    });

});