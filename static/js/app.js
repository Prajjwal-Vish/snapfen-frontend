console.log("SnapFen App Initialized");

// ─────────────────────────────────────────────────────────────
// AUTH HELPERS
// These functions handle everything JWT related.
// API_BASE comes from config.js which must be loaded before this file.
// ─────────────────────────────────────────────────────────────

// Read the token from localStorage
// Returns the token string, or null if not logged in
function getToken() {
    return localStorage.getItem('snapfen_token');
}

// Check if user is logged in — just checks if a token exists
function isLoggedIn() {
    return getToken() !== null;
}

// Delete token — used on logout
function clearAuth() {
    localStorage.removeItem('snapfen_token');
    localStorage.removeItem('snapfen_username');
}

// authFetch — use this instead of fetch() for any API call that needs auth
// Automatically attaches Authorization: Bearer <token> header
// Works for both logged-in users (attaches token) and anonymous users (no token)
function authFetch(url, options = {}) {
    const token = getToken();

    // Start building headers from whatever was passed in
    const headers = { ...options.headers };

    // Add the token header only if user is logged in
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        // Flask-JWT reads this header on the backend
        // Format is always: "Bearer <token>"
    }

    // Add Content-Type for JSON requests
    // But NOT for FormData (file uploads) — browser sets that automatically
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    // Return fetch with our updated headers merged in
    // ...options spreads method, body, etc. from original call
    return fetch(url, {
        ...options,
        headers
        // NO credentials: "include" — we don't use cookies anymore
    });
}

// ─────────────────────────────────────────────────────────────
// checkAuth — runs on every page load
// Reads localStorage to decide what UI to show
// No network call needed — instant
// ─────────────────────────────────────────────────────────────
function checkAuth() {
    const username = localStorage.getItem('snapfen_username');

    if (!isLoggedIn()) {
        // Not logged in — show login/signup, hide logout and username
        document.getElementById("login-link")?.classList.remove("hidden");
        document.getElementById("signup-link")?.classList.remove("hidden");
        document.getElementById("logout-btn")?.classList.add("hidden");
        document.getElementById("username-display")?.classList.add("hidden");
        return;
    }

    // Logged in — show logout button, hide login/signup
    document.getElementById("logout-btn")?.classList.remove("hidden");
    document.getElementById("login-link")?.classList.add("hidden");
    document.getElementById("signup-link")?.classList.add("hidden");

    // Show username in navbar
    const usernameEl = document.getElementById("username-display");
    if (usernameEl) {
        usernameEl.textContent = username || "User";
        usernameEl.classList.remove("hidden");
    }
}

// Run immediately on every page load — updates navbar before anything else
checkAuth();

// ─────────────────────────────────────────────────────────────
// MAIN APP LOGIC
// Everything below runs after the DOM is fully loaded
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // --- VARIABLES ---
    let cropper = null;
    let currentActiveBlob = null;
    let rawFenBase = "";
    let isManualCrop = false;

    // --- DOM ELEMENTS ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const mainPreview = document.getElementById('main-preview');

    const btnNewImage = document.getElementById('btn-new-image');
    const btnQuickScan = document.getElementById('btn-quick-scan');
    const btnCopy = document.getElementById('btn-copy');

    const btnCropToggle = document.getElementById('btn-crop-toggle');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const btnConfirmCrop = document.getElementById('btn-confirm-crop');

    const actionButtons = document.getElementById('action-buttons');
    const cropButtons = document.getElementById('crop-buttons');

    const povToggle = document.getElementById('pov-toggle');
    const turnToggle = document.getElementById('turn-toggle');
    const turnLabel = document.getElementById('turn-label');
    const resultContent = document.getElementById('result-content');
    const emptyState = document.getElementById('empty-result-state');
    const fenText = document.getElementById('fen-text');
    const analyzedPreview = document.getElementById('analyzed-preview');

    const btnHistory = document.getElementById('btn-history');
    const historyDrawer = document.getElementById('history-drawer');
    const historyList = document.getElementById('history-list');
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const btnCloseHistory = document.getElementById('btn-close-history');

    // --- FILE UPLOAD ---
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', (e) => {
            if (e.target !== fileInput) fileInput.click();
        });
    }

    // --- SMART PASTE (Ctrl+V) ---
    document.addEventListener('paste', (event) => {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();

                currentActiveBlob = blob;
                const url = URL.createObjectURL(currentActiveBlob);
                mainPreview.src = url;

                const originalText = dropZone.querySelector('p').innerText;
                dropZone.querySelector('p').innerText = "Image Pasted! Loading...";

                setTimeout(() => {
                    dropZone.classList.add('hidden');
                    previewContainer.classList.remove('hidden');
                    resetResults();
                    isManualCrop = false;
                    dropZone.querySelector('p').innerText = originalText;
                }, 500);
            }
        }
    });

    // --- TOGGLES ---
    if (povToggle) povToggle.addEventListener('change', updateGlobalFen);
    if (turnToggle) {
        turnToggle.addEventListener('change', () => {
            updateTurnLabel();
            updateGlobalFen();
        });
    }

    // --- MAIN BUTTONS ---
    if (btnNewImage) btnNewImage.addEventListener('click', () => fileInput.click());

    if (btnQuickScan) {
        btnQuickScan.addEventListener('click', () => {
            if (currentActiveBlob) sendToBackend(currentActiveBlob, "scan.png");
        });
    }

    if (btnCopy) btnCopy.addEventListener('click', copyToClipboard);

    // --- CROPPER ---
    if (btnCropToggle) btnCropToggle.addEventListener('click', startCropping);
    if (btnCancelCrop) btnCancelCrop.addEventListener('click', cancelCropping);
    if (btnConfirmCrop) btnConfirmCrop.addEventListener('click', applyCrop);

    // --- LOGOUT ---
    // Must be inside DOMContentLoaded so the button element exists
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                // Tell backend (optional — backend doesn't store session so it
                // doesn't need to do anything, but good practice to notify it)
                await authFetch(`${window.API_BASE}/logout`, {
                    method: "POST"
                });
            } catch(e) {
                // Even if this request fails, we still log out locally
                // because the real logout is just clearing localStorage
            }

            // THE ACTUAL LOGOUT — delete token from browser storage
            clearAuth();

            // Reload page — checkAuth() will run again,
            // find no token, and show login/signup UI
            location.reload();
        });
    }

    // --- HISTORY DRAWER ---
    if (btnHistory) {
        btnHistory.addEventListener('click', () => {
            historyDrawer.classList.remove('closed');
            historyDrawer.classList.add('open');
            drawerBackdrop.classList.remove('hidden');
            fetchHistory();
        });
    }

    function closeHistory() {
        historyDrawer.classList.remove('open');
        historyDrawer.classList.add('closed');
        drawerBackdrop.classList.add('hidden');
    }

    if (btnCloseHistory) btnCloseHistory.addEventListener('click', closeHistory);
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeHistory);

    // ─────────────────────────────────────────────────────────────
    // FUNCTIONS
    // ─────────────────────────────────────────────────────────────

    function handleFileSelect(e) {
        if (e.target.files && e.target.files[0]) {
            currentActiveBlob = e.target.files[0];
            const url = URL.createObjectURL(currentActiveBlob);
            mainPreview.src = url;

            isManualCrop = false;

            dropZone.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            resetResults();
            fileInput.value = '';
        }
    }

    // --- CROPPER LOGIC ---
    function startCropping() {
        actionButtons.classList.add('hidden');
        cropButtons.classList.remove('hidden');

        if (cropper) cropper.destroy();

        cropper = new Cropper(mainPreview, {
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.8,
            background: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    }

    function cancelCropping() {
        if (cropper) cropper.destroy();
        cropper = null;
        cropButtons.classList.add('hidden');
        actionButtons.classList.remove('hidden');
    }

    function applyCrop() {
        if (!cropper) return;
        cropper.getCroppedCanvas({ width: 1024, height: 1024 }).toBlob((blob) => {
            currentActiveBlob = blob;
            isManualCrop = true;

            const newUrl = URL.createObjectURL(blob);
            mainPreview.src = newUrl;
            cancelCropping();
        }, 'image/png');
    }

    // --- BACKEND SEND ---
    // Uses authFetch so logged-in users get their scan saved automatically
    // Anonymous users still get the FEN result — backend handles both cases
    // function sendToBackend(fileBlob, fileName) {
    //     setLoading(true);

    //     const formData = new FormData();
    //     formData.append('file', fileBlob, fileName);
    //     formData.append('pov', 'w');
    //     formData.append('is_manual', isManualCrop);

    //     // authFetch attaches Authorization header if user is logged in
    //     // backend uses verify_jwt_in_request(optional=True) so it works
    //     // for both logged-in and anonymous users
    //     authFetch(`${window.API_BASE}/predict`, {
    //         method: 'POST',
    //         body: formData
    //         // DO NOT set Content-Type here — FormData sets it automatically
    //         // with the correct boundary value for file uploads
    //     })
    //     .then(res => res.json())
    //     .then(data => {
    //         setLoading(false);

    //         if (data.error) {
    //             if (data.error.includes("No chessboard")) {
    //                 alert("No chessboard found!\n\nPlease use the 'Crop' button to manually select the board.");
    //             } else {
    //                 alert("Error: " + data.error);
    //             }
    //         } else {
    //             rawFenBase = data.fen;
    //             showResult(data.cropped_image);
    //         }
    //     })
    //     .catch(err => {
    //         setLoading(false);
    //         console.error(err);
    //         alert("Server Error. Check console.");
    //     });
    // }

    function sendToBackend(fileBlob, fileName) {
        setLoading(true);
    
        const formData = new FormData();
        formData.append("file", fileBlob, fileName);
        formData.append("pov", "w");
        formData.append("is_manual", isManualCrop);
    
        // Step 1: POST the image → get back a task_id immediately
        authFetch(`${window.API_BASE}/predict`, {
            method: "POST",
            body: formData,
        })
        .then(res => {
            if (!res.ok) return res.json().then(d => Promise.reject(d));
            return res.json();
        })
        .then(data => {
            // data = { task_id: "abc-123-..." }
            // Start polling for the result
            pollForResult(data.task_id);
        })
        .catch(err => {
            setLoading(false);
            showError(err.error || "Could not reach server. Check your connection.");
        });
    }

    function pollForResult(taskId) {
        // How many times we've checked — used to give up after ~60s
        let attempts = 0;
        const MAX_ATTEMPTS = 120; // 120 × 500ms = 60 seconds timeout
    
        // setInterval: call this function every 500ms
        // It's like a timer that ticks twice per second
        const intervalId = setInterval(() => {
            attempts++;
    
            // Give up after 60 seconds — something went very wrong
            if (attempts > MAX_ATTEMPTS) {
                clearInterval(intervalId);
                setLoading(false);
                showError("Analysis timed out. Please try again.");
                return;
            }
    
            // Check the result endpoint with our task ticket
            authFetch(`${window.API_BASE}/result/${taskId}`)
            .then(res => res.json())
            .then(data => {
    
                if (data.status === "pending" || data.status === "started") {
                    // Not ready yet — do nothing, interval will fire again in 500ms
                    // Optionally update a loading message here
                    return;
                }
    
                // Either done or error — stop polling in both cases
                clearInterval(intervalId);
                setLoading(false);
    
                if (data.status === "error") {
                    showError(data.error || "Analysis failed. Please try again.");
                    return;
                }
    
                if (data.status === "done") {
                    rawFenBase = data.fen;
                    showResult(data.cropped_image);
                }
            })
            .catch(() => {
                // Network hiccup — don't stop polling, just skip this tick
                // The next tick (500ms later) will try again
            });
    
        }, 500); // 500ms = half a second between each check
    }
    function showError(message) {
        const toast = document.getElementById("error-toast");
        const messageEl = document.getElementById("error-message");
        if (toast && messageEl) {
            messageEl.textContent = message;
            toast.classList.remove("hidden", "translate-x-full");
            // Auto-hide after 5 seconds
            setTimeout(() => closeError(), 5000);
        } else {
            // Fallback if toast elements don't exist
            alert(message);
        }
    }
    
    function closeError() {
        const toast = document.getElementById("error-toast");
        if (toast) {
            toast.classList.add("translate-x-full");
            setTimeout(() => toast.classList.add("hidden"), 300);
        }
    }

    // --- FETCH HISTORY ---
    function fetchHistory() {
        historyList.innerHTML = `
            <div class="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
                <div class="loader w-6 h-6 border-2"></div>
                <span class="text-xs">Loading...</span>
            </div>`;

        // If not logged in, show message instead of making a request
        if (!isLoggedIn()) {
            historyList.innerHTML = `
                <div class="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
                    <p class="text-sm">Please log in to see your history.</p>
                    <a href="login.html" class="text-blue-400 text-xs hover:underline">Go to Login</a>
                </div>`;
            return;
        }

        // authFetch adds Authorization: Bearer <token> header automatically
        authFetch(`${window.API_BASE}/api/history`)
            .then(res => {
                if (res.status === 401) {
                    // Token expired or invalid — clear it and show message
                    // Don't redirect — just show message in the drawer
                    clearAuth();
                    checkAuth(); // update navbar to show login button
                    historyList.innerHTML = `<p class="text-gray-500 text-center mt-10 text-sm">Session expired. Please log in again.</p>`;
                    return null; // stop the chain
                }
                return res.json();
            })
            .then(data => {
                if (!data) return; // stopped above due to 401

                historyList.innerHTML = '';

                if (data.length === 0) {
                    historyList.innerHTML = `<p class="text-gray-500 text-center mt-10 text-sm">No scans yet.</p>`;
                    return;
                }

                data.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 cursor-pointer transition group flex gap-3 items-center';
                    div.innerHTML = `
                        <img src="${item.image}" class="w-12 h-12 rounded-lg object-cover border border-white/20">
                        <div class="overflow-hidden flex-1">
                            <p class="text-[10px] text-gray-400 mb-1">${item.date}</p>
                            <p class="text-xs font-mono text-blue-300 truncate w-full bg-black/30 p-1 rounded">${item.fen}</p>
                        </div>`;
                    div.addEventListener('click', () => {
                        rawFenBase = item.fen;
                        showResult(item.image);
                        closeHistory();
                    });
                    historyList.appendChild(div);
                });
            })
            .catch(err => {
                console.error(err);
                historyList.innerHTML = `<p class="text-red-400 text-center mt-4 text-xs">Failed to load history.</p>`;
            });
    }

    // --- HELPERS ---
    function updateGlobalFen() {
        if (!rawFenBase) return;
        let currentFen = rawFenBase;
        if (povToggle.checked) currentFen = flipFenBoard(currentFen);

        let parts = currentFen.split(' ');
        if (parts.length >= 2) {
            parts[1] = turnToggle.checked ? 'b' : 'w';
            currentFen = parts.join(' ');
        }

        fenText.value = currentFen;
        document.getElementById('link-lichess').href = `https://lichess.org/analysis/${currentFen}`;
        document.getElementById('link-chesscom').href = `https://www.chess.com/analysis?fen=${encodeURIComponent(currentFen)}`;
    }

    function flipFenBoard(fen) {
        let parts = fen.split(' ');
        let board = parts[0];
        let ranks = board.split('/').reverse();
        let flippedRanks = ranks.map(rank => rank.split('').reverse().join(''));
        parts[0] = flippedRanks.join('/');
        return parts.join(' ');
    }

    function updateTurnLabel() {
        if (turnToggle.checked) {
            turnLabel.innerText = "Black";
            turnLabel.classList.remove('text-white');
            turnLabel.classList.add('text-gray-400');
        } else {
            turnLabel.innerText = "White";
            turnLabel.classList.add('text-white');
            turnLabel.classList.remove('text-gray-400');
        }
    }

    function showResult(base64Image) {
        emptyState.classList.add('hidden');
        resultContent.classList.remove('hidden');
        resultContent.classList.add('animate-fade-in');
        if (base64Image) analyzedPreview.src = base64Image;
        updateGlobalFen();
        btnQuickScan.classList.add('btn-disabled', 'opacity-50');
    }

    function resetResults() {
        emptyState.classList.remove('hidden');
        resultContent.classList.add('hidden');
        btnQuickScan.classList.remove('btn-disabled', 'opacity-50');
        btnQuickScan.innerHTML = '<i class="fa-solid fa-bolt"></i> <span>Scan</span>';
    }

    function setLoading(isLoading) {
        if (isLoading) {
            btnQuickScan.innerHTML = '<div class="loader w-5 h-5 border-2"></div>';
            if (btnConfirmCrop) btnConfirmCrop.innerHTML = '<div class="loader w-5 h-5 border-2"></div>';
            btnQuickScan.disabled = true;
            if (btnConfirmCrop) btnConfirmCrop.disabled = true;
            resultContent.classList.add('opacity-50');
        } else {
            btnQuickScan.innerHTML = '<i class="fa-solid fa-bolt"></i> <span>Scan</span>';
            if (btnConfirmCrop) btnConfirmCrop.innerHTML = '<i class="fa-solid fa-check"></i><span>Apply Crop</span>';
            btnQuickScan.disabled = false;
            if (btnConfirmCrop) btnConfirmCrop.disabled = false;
            resultContent.classList.remove('opacity-50');
        }
    }

    function copyToClipboard() {
        fenText.select();
        document.execCommand('copy');
        const icon = btnCopy.querySelector('i');
        icon.className = 'fa-solid fa-check text-green-400';
        setTimeout(() => icon.className = 'fa-regular fa-copy', 2000);
    }

    // ─────────────────────────────────────────────────────────────
    // MODAL LOGIC
    // ─────────────────────────────────────────────────────────────

    // 1. AI Feedback Modal (floating button)
    const feedbackModal = document.getElementById('feedback-modal');
    const btnOpenFeedback = document.getElementById('btn-open-feedback');
    const btnCloseFeedback = document.getElementById('btn-close-feedback');
    const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
    const feedbackTags = document.querySelectorAll('.feedback-tag');
    let selectedTag = "General Issue";

    if (btnOpenFeedback) btnOpenFeedback.addEventListener('click', () => feedbackModal.classList.remove('hidden'));
    if (btnCloseFeedback) btnCloseFeedback.addEventListener('click', () => feedbackModal.classList.add('hidden'));

    feedbackTags.forEach(tag => {
        tag.addEventListener('click', () => {
            feedbackTags.forEach(t => {
                t.classList.remove('bg-blue-600', 'text-white');
                t.classList.add('bg-white/5', 'text-gray-300');
            });
            tag.classList.remove('bg-white/5', 'text-gray-300');
            tag.classList.add('bg-blue-600', 'text-white');
            selectedTag = tag.innerText;
        });
    });

    if (btnSubmitFeedback) {
        btnSubmitFeedback.addEventListener('click', () => {
            const text = document.getElementById('feedback-text').value;
            const originalHTML = btnSubmitFeedback.innerHTML;
            btnSubmitFeedback.innerText = "Sending...";
            btnSubmitFeedback.disabled = true;

            const formData = new FormData();
            formData.append('feedback', text);
            formData.append('tags', selectedTag);
            formData.append('fen', fenText.value);
            if (currentActiveBlob) formData.append('original_image', currentActiveBlob, 'original.png');

            // authFetch — attaches token if logged in
            authFetch(`${window.API_BASE}/report_issue`, {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(() => {
                btnSubmitFeedback.innerText = "Sent!";
                setTimeout(() => {
                    feedbackModal.classList.add('hidden');
                    btnSubmitFeedback.innerHTML = originalHTML;
                    btnSubmitFeedback.disabled = false;
                    document.getElementById('feedback-text').value = '';
                }, 1500);
            })
            .catch(() => {
                btnSubmitFeedback.innerText = "Error sending";
                setTimeout(() => {
                    btnSubmitFeedback.innerHTML = originalHTML;
                    btnSubmitFeedback.disabled = false;
                }, 2000);
            });
        });
    }

    // 2. Bug Report Modal (footer link)
    const bugModal = document.getElementById('bug-modal');
    const footerReportBug = document.getElementById('footer-report-bug');
    const btnCloseBug = document.getElementById('btn-close-bug');
    const btnSubmitBug = document.getElementById('btn-submit-bug');

    if (footerReportBug) {
        footerReportBug.addEventListener('click', (e) => {
            e.preventDefault();
            bugModal.classList.remove('hidden');
        });
    }
    if (btnCloseBug) btnCloseBug.addEventListener('click', () => bugModal.classList.add('hidden'));

    if (btnSubmitBug) {
        btnSubmitBug.addEventListener('click', () => {
            const text = document.getElementById('bug-text').value;
            const file = document.getElementById('bug-file').files[0];
            const originalHTML = btnSubmitBug.innerHTML;
            btnSubmitBug.innerText = "Sending...";
            btnSubmitBug.disabled = true;

            const formData = new FormData();
            formData.append('feedback', text);
            formData.append('tags', "General Bug");
            if (file) formData.append('attachment', file);

            authFetch(`${window.API_BASE}/report_issue`, {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(() => {
                btnSubmitBug.innerText = "Report Sent!";
                setTimeout(() => {
                    bugModal.classList.add('hidden');
                    btnSubmitBug.innerHTML = originalHTML;
                    btnSubmitBug.disabled = false;
                    document.getElementById('bug-text').value = '';
                }, 1500);
            })
            .catch(err => {
                console.error(err);
                btnSubmitBug.innerText = "Error";
                setTimeout(() => {
                    btnSubmitBug.disabled = false;
                    btnSubmitBug.innerHTML = originalHTML;
                }, 2000);
            });
        });
    }

    // --- FOOTER LINKS ---
    const footerUploadLink = document.getElementById('footer-upload-link');
    if (footerUploadLink && fileInput) {
        footerUploadLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => fileInput.click(), 500);
        });
    }

});