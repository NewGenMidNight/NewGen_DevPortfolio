import pytest
from server import app, analytics

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


# --- TEST: Games API ---
def test_get_games(client):
    res = client.get("/api/roblox/games")
    assert res.status_code == 200

    data = res.get_json()
    assert isinstance(data, list)

    if len(data) > 0:
        game = data[0]
        assert "name" in game
        assert "ccu" in game
        assert "visits" in game
        assert "likes" in game
        assert "likeRatio" in game


# --- TEST: Metrics initially empty ---
def test_metrics_empty(client):
    res = client.get("/admin/metrics")
    data = res.get_json()

    assert data["game_clicks"] == {}
    assert data["category_clicks"] == {}
    assert data["searches"] == {}


# --- TEST: Game click tracking ---
def test_game_click_tracking(client):
    game_id = "test123"

    res = client.post(f"/api/roblox/game-click/{game_id}",
                      json={"category": ["qa", "programming"]})
    assert res.status_code == 200

    metrics = client.get("/admin/metrics").get_json()

    assert metrics["game_clicks"][game_id] == 1
    assert metrics["category_clicks"]["qa"] == 1
    assert metrics["category_clicks"]["programming"] == 1


# --- TEST: Multiple clicks ---
def test_multiple_clicks(client):
    game_id = "multi"

    for _ in range(3):
        client.post(f"/api/roblox/game-click/{game_id}",
                    json={"category": ["qa"]})

    metrics = client.get("/admin/metrics").get_json()
    assert metrics["game_clicks"][game_id] == 3


# --- TEST: Search tracking ---
def test_search_tracking(client):
    client.post("/api/roblox/search", json={"term": "bladeball"})
    client.post("/api/roblox/search", json={"term": "bladeball"})

    metrics = client.get("/admin/metrics").get_json()
    assert metrics["searches"]["bladeball"] == 2


# --- TEST: Invalid search ---
def test_empty_search(client):
    client.post("/api/roblox/search", json={"term": ""})

    metrics = client.get("/admin/metrics").get_json()
    assert "" not in metrics["searches"]