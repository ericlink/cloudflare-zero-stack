const form = document.getElementById("feedback-form");
const feedList = document.getElementById("feed-list");
const statusEl = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");
const btnLabel = submitBtn.querySelector(".btn-label");
const btnSpinner = submitBtn.querySelector(".btn-spinner");
const charCount = document.getElementById("char-count");
const messageInput = form.querySelector('textarea[name="message"]');
const refreshBtn = document.getElementById("refresh-btn");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ""}`;
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnSpinner.classList.toggle("hidden", !loading);
  btnLabel.textContent = loading ? "Posting…" : "Post feedback";
}

function formatTime(isoLike) {
  // D1 stores "YYYY-MM-DD HH:MM:SS" (UTC-ish); Date can parse with T.
  const d = new Date(isoLike.includes("T") ? isoLike : isoLike.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return isoLike;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderItems(items) {
  if (!items.length) {
    feedList.innerHTML = `<p class="empty">No feedback yet — be the first.</p>`;
    return;
  }

  feedList.innerHTML = items
    .map(
      (item, i) => `
      <article class="feedback-card" style="animation-delay: ${Math.min(i, 8) * 40}ms">
        <div class="feedback-meta">
          <span class="name">${escapeHtml(item.name)}</span>
          <time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(formatTime(item.createdAt))}</time>
        </div>
        <p class="message">${escapeHtml(item.message)}</p>
      </article>`
    )
    .join("");
}

async function loadFeed() {
  try {
    const res = await fetch("/api/feedback");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderItems(data.items ?? []);
  } catch (err) {
    console.error(err);
    feedList.innerHTML = `<p class="empty">Couldn't load feedback. Is the Worker running?</p>`;
  }
}

messageInput.addEventListener("input", () => {
  charCount.textContent = String(messageInput.value.length);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("");
  setLoading(true);

  try {
    const fd = new FormData(form);

    const res = await fetch("/api/feedback", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    form.reset();
    charCount.textContent = "0";
    setStatus("Posted — thanks!", "ok");
    await loadFeed();
  } catch (err) {
    setStatus(err.message || "Something went wrong", "error");
  } finally {
    setLoading(false);
  }
});

refreshBtn.addEventListener("click", () => loadFeed());
loadFeed();
