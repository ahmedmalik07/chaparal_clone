/* ─────────────────────────────────────────────
   Stingray Boats — AI Chat Panel (Right Sidebar)
   Talks to FastAPI backend on port 8090
   ───────────────────────────────────────────── */
(function () {
    "use strict";

    const API = "http://localhost:8090";

    // DOM refs
    const fab       = document.getElementById("chat-fab");
    const panel     = document.getElementById("chat-panel");
    const closeBtn  = document.getElementById("chat-close");
    const msgBox    = document.getElementById("chat-messages");
    const form      = document.getElementById("chat-form");
    const input     = document.getElementById("chat-input");
    const sendBtn   = document.getElementById("chat-send");
    const confirmBar= document.getElementById("chat-confirm-bar");
    const confirmYes= document.getElementById("confirm-yes");
    const confirmNo = document.getElementById("confirm-no");
    const modeBtns  = document.querySelectorAll(".mode-btn");

    let mode = "ask";           // "ask" | "build"
    let sessionId = null;       // active build session
    let busy = false;

    // ── Create mobile backdrop ────────────────
    const backdrop = document.createElement("div");
    backdrop.className = "chat-backdrop";
    document.body.appendChild(backdrop);

    // ── Mobile open / close (< 1024px) ────────
    if (fab) {
        fab.addEventListener("click", () => {
            panel.classList.add("open");
            backdrop.classList.add("visible");
            fab.classList.add("hidden");
            input.focus();
        });
    }
    function closeMobileChat() {
        panel.classList.remove("open");
        backdrop.classList.remove("visible");
        if (fab) fab.classList.remove("hidden");
    }
    if (closeBtn) closeBtn.addEventListener("click", closeMobileChat);
    backdrop.addEventListener("click", closeMobileChat);

    // ── Mode toggle ───────────────────────────
    modeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            mode = btn.dataset.mode;
            input.placeholder = mode === "ask"
                ? "Ask about boats, options, pricing…"
                : "Describe your ideal boat setup…";
            sessionId = null;
            confirmBar.classList.add("hidden");
        });
    });

    // ── Helpers ───────────────────────────────
    function addMsg(role, html) {
        const wrap = document.createElement("div");
        wrap.className = `chat-msg ${role}`;
        wrap.innerHTML = `<div class="msg-content">${html}</div>`;
        msgBox.appendChild(wrap);
        msgBox.scrollTop = msgBox.scrollHeight;
        return wrap;
    }

    function addTyping() {
        const el = document.createElement("div");
        el.className = "chat-msg bot typing";
        el.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
        msgBox.appendChild(el);
        msgBox.scrollTop = msgBox.scrollHeight;
        return el;
    }

    function removeTyping() {
        const el = msgBox.querySelector(".typing");
        if (el) el.remove();
    }

    /** Convert markdown-light text into HTML */
    function md(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
            .replace(/_(.+?)_/g, "<em>$1</em>")
            .replace(/✓/g, '<span style="color:#7fb800">✓</span>')
            .replace(/\n/g, "<br>");
    }

    /** Build a proposed-changes card HTML */
    function changesCard(changes) {
        if (!changes || !changes.length) return "";
        let html = `<div class="msg-changes"><div class="msg-changes-title">Proposed Changes</div>`;
        for (const c of changes) {
            const lbl = c.label || c.option_id;
            const price = c.price != null ? `$${Number(c.price).toLocaleString()}` : "";
            html += `<div class="msg-change-item"><span class="label">${c.action}: ${lbl}</span><span class="price">${price}</span></div>`;
        }
        html += `</div>`;
        return html;
    }

    /** Gather current configurator selections to send to build mode */
    function getCurrentSelections() {
        // Try to read from the configurator's global state
        if (window.selectedOptions) {
            return JSON.parse(JSON.stringify(window.selectedOptions));
        }
        return {};
    }

    /** Apply final_selections from build mode to the configurator UI */
    function applySelectionsToUI(sel) {
        if (!sel || typeof sel !== "object") return;

        // Color swatches — click the swatch with matching data-id
        const swatchMap = {
            whiteHull: "white-hull",
            hullSide: "hull-side",
            vxSport: "vx-sport",
            interior: "interior-color",
            canvasColor: "canvas-color",
        };
        for (const [key, group] of Object.entries(swatchMap)) {
            if (sel[key]) {
                const swatch = document.querySelector(`.option-swatches[data-group="${group}"] .swatch[data-id="${sel[key]}"]`);
                if (swatch) swatch.click();
            }
        }

        // Engine
        if (sel.engine) {
            const engBtn = document.querySelector(`.engine-option[data-id="${sel.engine}"]`);
            if (engBtn) engBtn.click();
        }

        // Trailer
        if (sel.trailer) {
            const tBtn = document.querySelector(`.trailer-option[data-id="${sel.trailer}"]`);
            if (tBtn) tBtn.click();
        }

        // Checkboxes
        if (sel.checkboxes) {
            for (const [id, checked] of Object.entries(sel.checkboxes)) {
                const cb = document.querySelector(`.checkbox-option input[data-id="${id}"]`);
                if (cb && cb.checked !== checked) {
                    cb.closest(".checkbox-option").click();
                }
            }
        }
    }

    function setDisabled(d) {
        busy = d;
        sendBtn.disabled = d;
        input.disabled = d;
    }

    // ── Ask Mode ──────────────────────────────
    async function doAsk(text) {
        setDisabled(true);
        const typing = addTyping();
        try {
            const res = await fetch(`${API}/ask`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
            });
            removeTyping();
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json();
            addMsg("bot", md(data.text || "Sorry, I couldn't get a response."));
        } catch (e) {
            removeTyping();
            addMsg("bot", `<span style="color:#ff4444">Error: ${e.message}</span><br>Make sure the backend server is running on port 8090.`);
        }
        setDisabled(false);
        input.focus();
    }

    // ── Build Mode ────────────────────────────
    async function doBuild(text) {
        setDisabled(true);
        const typing = addTyping();
        try {
            const endpoint = sessionId ? `${API}/build` : `${API}/build`;
            const body = sessionId
                ? { session_id: sessionId, answer: text }
                : { message: text, current_selections: getCurrentSelections() };

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            removeTyping();
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json();

            sessionId = data.session_id || null;

            // Show response text + changes card
            let html = md(data.text || "");
            if (data.proposed_changes && data.proposed_changes.length && !data.applied) {
                html += changesCard(data.proposed_changes);
            }
            addMsg("bot", html);

            // If applied, update the UI
            if (data.applied && data.final_selections) {
                applySelectionsToUI(data.final_selections);
                sessionId = null;
                confirmBar.classList.add("hidden");
            }

            // If needs confirmation, show bar
            if (data.needs_confirmation) {
                confirmBar.classList.remove("hidden");
            }

            // If needs clarification, keep session open (user types answer)
            if (data.needs_clarification) {
                // session stays active, user replies normally
            }

        } catch (e) {
            removeTyping();
            addMsg("bot", `<span style="color:#ff4444">Error: ${e.message}</span><br>Make sure the backend server is running on port 8090.`);
            sessionId = null;
        }
        setDisabled(false);
        input.focus();
    }

    // ── Form submit ───────────────────────────
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || busy) return;
        addMsg("user", text.replace(/</g, "&lt;"));
        input.value = "";

        if (mode === "ask") {
            doAsk(text);
        } else {
            doBuild(text);
        }
    });

    // ── Confirm buttons (build mode) ──────────
    confirmYes.addEventListener("click", () => {
        confirmBar.classList.add("hidden");
        addMsg("user", "Yes, apply these changes");
        doBuild("yes");
    });
    confirmNo.addEventListener("click", () => {
        confirmBar.classList.add("hidden");
        addMsg("user", "No, don't apply");
        doBuild("no");
        sessionId = null;
    });

})();
