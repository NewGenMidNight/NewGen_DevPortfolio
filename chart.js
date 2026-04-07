// --- Analytics Dashboard ---
async function loadDashboard() {
  try {
    const res = await fetch("/admin/metrics");
    const data = await res.json();

    // --- Top Games Clicked ---
    const gamesLabels = allGames.map(g => g.name);
    const gamesValues = allGames.map(g => data.game_clicks[g.id] || 0);

    const ctxGames = document.getElementById("chart-games").getContext("2d");
    new Chart(ctxGames, {
      type: "bar",
      data: {
        labels: gamesLabels,
        datasets: [{
          label: "Clicks",
          data: gamesValues,
          backgroundColor: "#00f0ff"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Top Games Clicked" }
        },
        scales: { y: { beginAtZero: true } }
      }
    });

    // --- Top Categories Clicked ---
    const categories = Object.keys(data.category_clicks);
    const catValues = Object.values(data.category_clicks);
    const catColors = ["#ff6384","#36a2eb","#ffce56","#4bc0c0","#9966ff","#ff9f40","#8bc34a"];

    const ctxCat = document.getElementById("chart-categories").getContext("2d");
    new Chart(ctxCat, {
      type: "pie",
      data: {
        labels: categories,
        datasets: [{
          data: catValues,
          backgroundColor: catColors
        }]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: "Top Categories Clicked" } }
      }
    });

    // --- Top Games Searched ---
    const searchLabels = allGames.map(g => g.name);
    const searchValues = allGames.map(g => data.searches[g.id] || 0);

    const ctxSearch = document.getElementById("chart-searches").getContext("2d");
    new Chart(ctxSearch, {
      type: "bar",
      data: {
        labels: searchLabels,
        datasets: [{
          label: "Searches",
          data: searchValues,
          backgroundColor: "#ff9f40"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Top Games Searched" }
        },
        scales: { y: { beginAtZero: true } }
      }
    });

  } catch (e) {
    console.error("Failed to load metrics:", e);
    alert("Failed to load metrics. Check the server logs.");
  }
}

// Auto-refresh dashboard every 30s if open
setInterval(() => {
  const dashboardModal = document.getElementById("dashboard-modal");
  if (dashboardModal && dashboardModal.style.display === "block") {
    loadDashboard();
  }
}, 30000);