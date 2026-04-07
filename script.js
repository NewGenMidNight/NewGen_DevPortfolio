let allGames = [];
let currentCategory = "all";

// Reference modal
const dashboardModal = document.getElementById("dashboard-modal");
const analyticsBtn = document.getElementById("analytics-btn");
const closeDashboardBtn = document.getElementById("close-dashboard");

// --- Fetch games ---
function loadGames() {
  fetch("/api/roblox/games")
    .then(res => res.json())
    .then(data => {
      allGames = data.map(g => ({
        ...g,
        category: Array.isArray(g.category) ? g.category : g.category.split(",").map(c => c.trim())
      }));
      renderGames();

      const now = new Date();
      const el = document.getElementById("last-update");
      if (el) el.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    })
    .catch(err => console.error("Fetch error:", err));
}

// --- Render games ---
function renderGames() {
  const container = document.getElementById("games");
  container.innerHTML = "";

  const search = document.getElementById("search")?.value.toLowerCase() || "";
  const sort = document.getElementById("sort")?.value || "default";

  let filtered = currentCategory === "all"
    ? allGames
    : allGames.filter(g =>
        Array.isArray(g.category)
          ? g.category.includes(currentCategory)
          : g.category === currentCategory
      );

  filtered = filtered.filter(g => g.name.toLowerCase().includes(search));

  // Sorting
  if (sort === "ccu") filtered.sort((a,b) => b.ccu - a.ccu);
  else if (sort === "visits") filtered.sort((a,b) => b.visits - a.visits);
  else if (sort === "likes") filtered.sort((a,b) => b.likes - a.likes);
  else if (sort === "az") filtered.sort((a,b) => a.name.localeCompare(b.name));

  filtered.forEach(game => {
    const div = document.createElement("div");
    div.className = "game";
    div.innerHTML = `
      <img src="${game.thumbnail}" />
      <h3>${game.name}</h3>
      <p>👥 CCU: ${game.ccu.toLocaleString()}</p>
      <p>👁 Visits: ${game.visits.toLocaleString()}</p>
      <p>👍 Likes: ${game.likes.toLocaleString()}</p>
      <p>💖 Like Ratio: ${game.likeRatio}%</p>
      <p>📂 Category: ${game.category.join(", ")}</p>
      <a href="${game.link}" target="_blank">Play</a>
    `;
    container.appendChild(div);

    // Track click
    div.querySelector("a").addEventListener("click", () => trackClick(game));
  });

  if (filtered.length === 0) container.innerHTML = "<p>No games found 😢</p>";

  // Track search term
  if (search) {
    fetch("/api/roblox/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: search })
    }).catch(console.error);
  }
}

// --- Category filter ---
function setCategory(cat) {
  currentCategory = cat;
  renderGames();
}

// --- Carousel controls ---
function scrollLeft() {
  const carousel = document.getElementById("games");
  if (!carousel) return;
  carousel.scrollBy({ left: -300, behavior: "smooth" });
}

function scrollRight() {
  const carousel = document.getElementById("games");
  if (!carousel) return;
  carousel.scrollBy({ left: 300, behavior: "smooth" });
}

// --- Track game clicks ---
function trackClick(game) {
  fetch(`/api/roblox/game-click/${game.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: game.category })
  }).catch(console.error);
}

// --- Analytics Dashboard ---
async function loadDashboard() {
  try {
    const res = await fetch("/admin/metrics");
    const data = await res.json();

    // --- Top Games Clicks ---
    const topGames = Object.entries(data.game_clicks)
      .sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([id,count])=>{
        const game = allGames.find(g=>g.id===id);
        return { name: game ? game.name : id, count };
      });
    const gamesLabels = topGames.map(g=>g.name);
    const gamesValues = topGames.map(g=>g.count);
    const ctxGames = document.getElementById("chart-games").getContext("2d");
    new Chart(ctxGames, {
      type:"bar",
      data:{ labels:gamesLabels, datasets:[{ label:"Clicks", data:gamesValues, backgroundColor:"#00f0ff" }] },
      options:{ responsive:true, plugins:{ legend:{ display:false }, title:{ display:true, text:"Top Games Clicks" } } }
    });

    // --- Top Categories Clicks ---
    const topCategories = Object.entries(data.category_clicks)
      .sort((a,b)=>b[1]-a[1]).slice(0,5);
    const catLabels = topCategories.map(c=>c[0]);
    const catValues = topCategories.map(c=>c[1]);
    const colors = ["#ff6384","#36a2eb","#ffce56","#4bc0c0","#9966ff"];
    const ctxCat = document.getElementById("chart-categories").getContext("2d");
    new Chart(ctxCat, {
      type:"pie",
      data:{ labels:catLabels, datasets:[{ data:catValues, backgroundColor:colors }] },
      options:{ responsive:true, plugins:{ title:{ display:true, text:"Top Categories Clicks" } } }
    });

    // --- Top Games Searched ---
    const topSearches = Object.entries(data.searches)
      .sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([term,count])=>{
        const game = allGames.find(g=>g.name.toLowerCase()===term);
        return { name: game ? game.name : term, count };
      });
    const searchLabels = topSearches.map(s=>s.name);
    const searchValues = topSearches.map(s=>s.count);
    const ctxSearch = document.getElementById("chart-searches").getContext("2d");
    new Chart(ctxSearch, {
      type:"bar",
      data:{ labels:searchLabels, datasets:[{ label:"Searches", data:searchValues, backgroundColor:"#ff9f40" }] },
      options:{ responsive:true, plugins:{ legend:{ display:false }, title:{ display:true, text:"Top Games Searched" } } }
    });

  } catch(e) {
    console.error(e);
    alert("Failed to load analytics metrics.");
  }
}

// --- Modal events ---
analyticsBtn.addEventListener("click", () => {
  dashboardModal.style.display = "block";
  loadDashboard();
});

closeDashboardBtn.addEventListener("click", () => {
  dashboardModal.style.display = "none";
});

// --- Load on start ---
window.onload = loadGames;

// --- Auto-refresh ---
setInterval(loadGames, 60000);
setInterval(()=>{
  if(dashboardModal.style.display==="block") loadDashboard();
}, 30000);