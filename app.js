/* =====================================================================
   GLOBAL DASHBOARD STATE
   ===================================================================== */
let funnelChartInstance = null;
let categoryChartInstance = null;
let benchmarkChartInstance = null;
let selectedShopper = null;
let activeScale = 50000;

const API_BASE = "/api";

// Document Boot
document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
  setupEventListeners();
});

// Setup click listeners for scale selection, sliders, etc.
function setupEventListeners() {
  // Scale Buttons
  const scaleBtns = document.querySelectorAll(".bench-btn");
  scaleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      scaleBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeScale = parseInt(btn.getAttribute("data-scale"));
    });
  });
}

// Navigation between sidebar sections
function showSection(sectionName) {
  document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
  
  document.getElementById(`section-${sectionName}`).classList.add("active");
  document.getElementById(`nav-${sectionName}`).classList.add("active");
  
  const titles = {
    dashboard: ["Analytics Dashboard", "Real-time clickstream ingestion and abandonment analysis"],
    accelerator: ["GPU Pipeline Benchmark", "Comparing single-threaded Pandas execution vs. parallelized NVIDIA cuDF"],
    optimizer: ["Target Campaign Optimizer", "Identify active cart abandoners and estimate recovery potential"],
    agent: ["AI Promo Agent Console", "Generate customized exit-intent hooks and coupon offers via Gemini LLM"]
  };
  
  document.getElementById("pageTitle").textContent = titles[sectionName][0];
  document.getElementById("pageSubtitle").textContent = titles[sectionName][1];
  
  if (sectionName === "dashboard") {
    loadDashboardStats();
  } else if (sectionName === "optimizer") {
    loadActiveSessions();
  } else if (sectionName === "agent") {
    if (!selectedShopper) {
      autoLoadHighestRiskShopper();
    }
  }
}

// =====================================================================
// SECTION 1: DASHBOARD CONTROLLER
// =====================================================================
async function initDashboard() {
  await loadDashboardStats();
}

async function loadDashboardStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error("Stats fetch failed");
    const data = await res.json();
    
    // Update numerical cards
    animateValue("stat-total-events", data.total_events);
    animateValue("stat-total-sessions", data.total_sessions);
    document.getElementById("stat-abandonment-rate").textContent = `${data.cart_abandonment_rate}%`;
    animateValue("stat-risk-sessions", data.active_sessions_at_risk);
    
    // Render static charts (simulating ingestion profiles)
    renderFunnelChart(data.total_events);
    renderCategoryChart();
  } catch (err) {
    console.error("Error loading stats:", err);
    showToast("⚠️ Could not connect to ShopPulse server. Make sure server.py is running!");
  }
}

function animateValue(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  
  const start = 0;
  const duration = 1000;
  const startTime = performance.now();
  
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const val = Math.floor(start + (target - start) * ease);
    el.textContent = val.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// Funnel chart render
function renderFunnelChart(totalEvents) {
  const ctx = document.getElementById("funnelChart");
  if (!ctx) return;
  
  if (funnelChartInstance) funnelChartInstance.destroy();
  
  // Create funnel distributions: Ingested -> Viewed -> Searched -> Cart -> Purchase
  const baseVal = totalEvents;
  const views = Math.round(baseVal * 0.58);
  const searches = Math.round(baseVal * 0.22);
  const carts = Math.round(baseVal * 0.16);
  const purchases = Math.round(baseVal * 0.04);
  
  funnelChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Raw Log Ingestion", "Product Detail Views", "Search Queries", "Cart Additions", "Completed Checkout"],
      datasets: [{
        label: "Logs Count",
        data: [baseVal, views, searches, carts, purchases],
        backgroundColor: [
          "rgba(139, 92, 246, 0.4)", // Purple
          "rgba(139, 92, 246, 0.5)",
          "rgba(139, 92, 246, 0.6)",
          "rgba(245, 158, 11, 0.6)",  // Amber (Cart)
          "rgba(16, 185, 129, 0.6)"  // Emerald (Purchase)
        ],
        borderColor: [
          "#8B5CF6", "#8B5CF6", "#8B5CF6", "#F59E0B", "#10B981"
        ],
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111622",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1
        }
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.03)" }, ticks: { color: "#94A3B8" } },
        y: { grid: { display: false }, ticks: { color: "#F1F5F9" } }
      }
    }
  });
}

// Category Chart render
function renderCategoryChart() {
  const ctx = document.getElementById("categoryChart");
  if (!ctx) return;
  
  if (categoryChartInstance) categoryChartInstance.destroy();
  
  categoryChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Electronics", "Apparel", "Home & Kitchen", "Beauty & Care", "Sports", "Books"],
      datasets: [{
        data: [35, 25, 15, 12, 8, 5],
        backgroundColor: [
          "#8B5CF6", "#a78bfa", "#3b82f6", "#10B981", "#F59E0B", "#EF4444"
        ],
        borderWidth: 2,
        borderColor: "#111622",
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#94A3B8", boxWidth: 10, padding: 12 }
        },
        tooltip: {
          backgroundColor: "#111622",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1
        }
      }
    }
  });
}

// =====================================================================
// SECTION 2: ACCELERATOR BENCHMARK CONTROLLER
// =====================================================================
async function executeBenchmark() {
  const loadingPanel = document.getElementById("benchLoadingPanel");
  const statusText = document.getElementById("benchStatusText");
  const progBar = document.getElementById("benchProgressBar");
  
  // Show loading panels
  loadingPanel.style.display = "flex";
  progBar.style.width = "0%";
  statusText.textContent = `Spinning up multithreaded environment for ${activeScale.toLocaleString()} events...`;
  
  // Simulated steps
  const steps = [
    { pct: 15, text: "Allocation CPU memory arrays (Pandas DataFrame)..." },
    { pct: 40, text: "Running single-threaded Pandas Sessionization (GroupBy & Aggs)..." },
    { pct: 65, text: "Uploading Arrow columns to GPU VRAM registers..." },
    { pct: 85, text: "Launching parallel CUDA kernels (NVIDIA cuDF parallel hash aggregates)..." },
    { pct: 100, text: "Performing fast parallel Logistic Regression ML scoring..." }
  ];
  
  for (const step of steps) {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 200));
    progBar.style.width = `${step.pct}%`;
    statusText.textContent = step.text;
  }
  
  try {
    const res = await fetch(`${API_BASE}/benchmark?scale=${activeScale}`);
    if (!res.ok) throw new Error("Benchmark query failed");
    const data = await res.json();
    
    // Hide loading
    loadingPanel.style.display = "none";
    
    // Render numeric details
    document.getElementById("bench-speedup-badge").textContent = `${data.speedup}x Faster`;
    document.getElementById("bench-cpu-time").textContent = `${data.cpu_time_ms.toLocaleString()} ms`;
    document.getElementById("bench-gpu-time").textContent = `${data.gpu_time_ms.toLocaleString()} ms`;
    document.getElementById("bench-cpu-throughput").textContent = `${data.cpu_throughput.toLocaleString()} events/sec`;
    document.getElementById("bench-gpu-throughput").textContent = `${data.gpu_throughput.toLocaleString()} events/sec`;
    
    // Render comparison chart
    renderBenchmarkChart(data.cpu_throughput, data.gpu_throughput);
    showToast(`⚡ Ingested ${data.scale.toLocaleString()} rows. Speedup: ${data.speedup}x!`);
  } catch (err) {
    loadingPanel.style.display = "none";
    console.error("Benchmark failed:", err);
    showToast("❌ Pipeline benchmarking crashed. Ensure Python server is running.");
  }
}

function renderBenchmarkChart(cpuEps, gpuEps) {
  const ctx = document.getElementById("benchmarkChart");
  if (!ctx) return;
  
  if (benchmarkChartInstance) benchmarkChartInstance.destroy();
  
  benchmarkChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["CPU (Pandas)", "GPU/Cloud (cuDF / BigQuery)"],
      datasets: [{
        label: "Throughput (Events/Sec)",
        data: [cpuEps, gpuEps],
        backgroundColor: ["rgba(71, 85, 105, 0.6)", "rgba(16, 185, 129, 0.7)"],
        borderColor: ["#475569", "#10B981"],
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { ticks: { color: "#F1F5F9" }, grid: { display: false } },
        y: { 
          type: "logarithmic", 
          ticks: { color: "#94A3B8" }, 
          grid: { color: "rgba(255,255,255,0.03)" } 
        }
      }
    }
  });
}

// =====================================================================
// SECTION 3: TARGET OPTIMIZER CONTROLLER
// =====================================================================
function updateFilterLabel(type, val) {
  if (type === "risk") {
    document.getElementById("filter-risk-val").textContent = `${val}%`;
    loadActiveSessions();
  }
}

async function loadActiveSessions() {
  const riskVal = document.getElementById("filter-risk").value / 100.0;
  const device = document.getElementById("filter-device").value;
  
  try {
    const res = await fetch(`${API_BASE}/sessions?min_risk=${riskVal}&device=${device}`);
    if (!res.ok) throw new Error("Sessions fetch failed");
    const data = await res.json();
    
    const tbody = document.getElementById("sessionTableBody");
    tbody.innerHTML = "";
    
    document.getElementById("opt-filtered-count").textContent = data.length;
    
    // Estimate Recoverable Revenue: aggregate risk_score * average cart items ($85 each item)
    let totalRevenue = 0;
    
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-table-state">No shoppers matched filters. Try lowering parameters.</td></tr>`;
      document.getElementById("opt-revenue-impact").textContent = `Est. Recoverable Revenue: $0.00`;
      return;
    }
    
    data.forEach(sess => {
      const devClass = sess.device.toLowerCase();
      const riskClass = sess.risk_score >= 80 ? "high" : sess.risk_score >= 50 ? "medium" : "low";
      const cartValue = sess.cart_adds * 85; // Mock average value
      totalRevenue += (sess.risk_score / 100.0) * cartValue;
      
      tbody.innerHTML += `
        <tr>
          <td><strong>${sess.customer_name}</strong></td>
          <td><span class="device-badge ${devClass}">${sess.device}</span></td>
          <td>${sess.category}</td>
          <td>${sess.duration}s</td>
          <td><strong style="color:#F59E0B">${sess.cart_adds}</strong> items</td>
          <td>
            <div class="risk-circle-wrap">
              <div class="risk-dot ${riskClass}"></div>
              <span><strong>${sess.risk_score}%</strong></span>
            </div>
          </td>
          <td>
            <button class="table-action-btn" onclick="triggerRescueAgent(${JSON.stringify(sess).replace(/"/g, '&quot;')})">
              Launch Rescue
            </button>
          </td>
        </tr>`;
    });
    
    document.getElementById("opt-revenue-impact").textContent = `Est. Recoverable Revenue: $${totalRevenue.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  } catch (err) {
    console.error("Error loading active sessions:", err);
    showToast("⚠️ Could not refresh active churn lists.");
  }
}

// =====================================================================
// SECTION 4: AI PROMO AGENT CONTROLLER
// =====================================================================
function triggerRescueAgent(sessData) {
  selectedShopper = sessData;
  showSection("agent");
  
  // Load customer DNA card details
  const profileContainer = document.getElementById("agent-active-profile");
  profileContainer.innerHTML = `
    <div class="profile-avatar-row">
      <div class="profile-avatar">${sessData.customer_name.split(" ").map(w => w[0]).join("")}</div>
      <div>
        <div class="profile-name">${sessData.customer_name}</div>
        <div class="profile-meta">User ID: ${sessData.user_id} · Active Session</div>
      </div>
    </div>
    
    <div class="profile-dna-grid">
      <div class="dna-card"><div class="dna-lbl">Device</div><div class="dna-val" style="color:#60a5fa">${sessData.device}</div></div>
      <div class="dna-card"><div class="dna-lbl">Cart Count</div><div class="dna-val" style="color:#F59E0B">${sessData.cart_adds} items</div></div>
      <div class="dna-card"><div class="dna-lbl">Browsed Duration</div><div class="dna-val">${sessData.duration}s</div></div>
      <div class="dna-card"><div class="dna-lbl">Primary Category</div><div class="dna-val">${sessData.category}</div></div>
      <div class="dna-card" style="grid-column: 1 / span 2; border-color: rgba(239, 68, 68, 0.3)">
        <div class="dna-lbl" style="color:#EF4444">ML Abandonment Risk</div>
        <div class="dna-val" style="color:#EF4444; font-size:1.3rem">${sessData.risk_score}%</div>
      </div>
    </div>`;
    
  // Populate Chat messages and trigger API
  const chatMessages = document.getElementById("agent-chat-messages");
  chatMessages.innerHTML = `
    <div class="chat-bubble ai">
      🤖 ShopPulse AI Agent initiating rescue sequence...
      Analyzing ${sessData.customer_name}'s session duration (${sessData.duration}s) and category interest (${sessData.category}).
      Calling Gemini LLM to draft personalized exiting promo offer...
    </div>`;
    
  document.getElementById("agent-chat-action-bar").style.display = "none";
  
  // Query backend for promotion voucher
  callPromoGenerator(sessData);
}

async function callPromoGenerator(sess) {
  const chatMessages = document.getElementById("agent-chat-messages");
  try {
    const res = await fetch(`${API_BASE}/generate_promo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: sess.customer_name.split(" ")[0],
        category: sess.category,
        risk: sess.risk_score,
        cart_adds: sess.cart_adds,
        duration: sess.duration
      })
    });
    
    if (!res.ok) throw new Error("Promo API failed");
    const data = await res.json();
    
    // Add AI message bubble
    chatMessages.innerHTML += `
      <div class="chat-bubble ai" style="border-color: rgba(16, 185, 129, 0.2)">
        ${data.message}
      </div>`;
    
    document.getElementById("agent-chat-action-bar").style.display = "flex";
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    console.error("AI Promo Agent failed:", err);
    chatMessages.innerHTML += `<div class="chat-bubble ai" style="border-color:#EF4444; color:#EF4444">⚠️ Failed to compile AI promotional voucher. Check backend connection.</div>`;
  }
}

function sendVoucherToUser() {
  if (!selectedShopper) return;
  showToast(`✅ Promotion sent to ${selectedShopper.customer_name} via WhatsApp API!`);
  showSection("optimizer");
}

async function autoLoadHighestRiskShopper() {
  const profileContainer = document.getElementById("agent-active-profile");
  const chatMessages = document.getElementById("agent-chat-messages");
  
  profileContainer.innerHTML = `<div class="empty-state-text">Locating highest-risk shopper...</div>`;
  chatMessages.innerHTML = `
    <div class="chat-welcome-box">
      <div class="chat-welcome-emoji">🤖</div>
      <p>Locating active shoppers with high cart abandonment risk from clickstream logs...</p>
    </div>`;
  
  try {
    const res = await fetch(`${API_BASE}/sessions?min_risk=0.5`);
    if (!res.ok) throw new Error("Failed to load targets");
    const data = await res.json();
    if (data.length > 0) {
      triggerRescueAgent(data[0]);
    } else {
      profileContainer.innerHTML = `<div class="empty-state-text">No active shoppers at risk currently found in dataset.</div>`;
    }
  } catch (err) {
    console.error(err);
    profileContainer.innerHTML = `<div class="empty-state-text">⚠️ Error loading shopper data from backend server.</div>`;
  }
}

// =====================================================================
// GLOBAL TOASTS & SCAN ANIMATIONS
// =====================================================================
function showToast(msg) {
  let toast = document.getElementById("toastEl");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastEl";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.display = "block";
  
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.display = "none";
  }, 4000);
}

function triggerScanAnimation() {
  showToast("🔄 Ingestion worker triggered: Resyncing clickstream log databases...");
  loadDashboardStats();
}
