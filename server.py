from flask import Flask, jsonify, send_from_directory, request
import requests
import json

app = Flask(__name__, static_folder=".")
PORT = 3001

# --- In-memory analytics ---
analytics = {
    "game_clicks": {},      # game id → clicks
    "category_clicks": {},  # category name → clicks
    "searches": {}          # search term → count
}

# --- Serve frontend ---
@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)

# --- Extract placeId from Roblox link ---
def extract_place_id(link):
    try:
        return link.split("/games/")[1].split("/")[0]
    except:
        return None

# --- Map placeIds to universeIds ---
def get_place_to_universe(place_ids):
    mapping = {}
    for pid in place_ids:
        try:
            res = requests.get(
                f"https://apis.roblox.com/universes/v1/places/{pid}/universe",
                timeout=5
            )
            data = res.json()
            if "universeId" in data:
                mapping[pid] = str(data["universeId"])
        except Exception as e:
            print(f"Failed to fetch universeId for {pid}: {e}")
    return mapping

# --- Games API ---
@app.route("/api/roblox/games", methods=["GET"])
def get_games():
    try:
        with open("games.json", "r", encoding="utf-8") as f:
            games_list = json.load(f)

        # Extract placeIds
        place_ids = list({extract_place_id(g["link"]) for g in games_list if extract_place_id(g["link"])})
        if not place_ids:
            return jsonify([])

        # Map to universeIds
        place_to_universe = get_place_to_universe(place_ids)
        universe_ids = list(place_to_universe.values())
        if not universe_ids:
            return jsonify([])

        # Fetch game stats (CCU, visits)
        stats_res = requests.get(
            f"https://games.roblox.com/v1/games?universeIds={','.join(universe_ids)}",
            timeout=5
        )
        stats_data = stats_res.json().get("data", [])
        stats_map = {str(g["id"]): g for g in stats_data}

        # Fetch thumbnails
        thumbs_res = requests.get(
            f"https://thumbnails.roblox.com/v1/games/icons?universeIds={','.join(universe_ids)}&size=256x256&format=Png",
            timeout=5
        )
        thumbs_data = thumbs_res.json().get("data", [])
        thumbs_map = {str(t["targetId"]): t["imageUrl"] for t in thumbs_data}

        # Fetch votes
        votes_res = requests.get(
            f"https://games.roblox.com/v1/games/votes?universeIds={','.join(universe_ids)}",
            timeout=5
        )
        votes_data = votes_res.json().get("data", [])
        votes_map = {str(v["id"]): v for v in votes_data}

        # Build final result
        result = []
        for game in games_list:
            place_id = extract_place_id(game["link"])
            universe_id = place_to_universe.get(place_id)

            g = stats_map.get(universe_id)
            vote = votes_map.get(universe_id, {})

            # Ensure category is a list
            cat = game["category"]
            cat_list = [c.strip() for c in cat.split(",")] if isinstance(cat, str) else cat

            up = vote.get("upVotes", 0)
            down = vote.get("downVotes", 0)
            total = up + down
            ratio = round((up / total) * 100, 1) if total > 0 else 0

            result.append({
                "id": place_id,
                "name": game["name"],
                "category": cat_list,
                "ccu": g.get("playing", 0) if g else 0,
                "likes": up,
                "likeRatio": ratio,
                "visits": g.get("visits", 0) if g else 0,
                "thumbnail": thumbs_map.get(universe_id, "https://via.placeholder.com/256"),
                "link": game["link"]
            })

        return jsonify(result)

    except Exception as e:
        print("SERVER ERROR:", e)
        return jsonify({"error": "Server error"}), 500

# --- Track game click ---
@app.route("/api/roblox/game-click/<game_id>", methods=["POST"])
def game_click(game_id):
    data = request.json
    categories = data.get("category", [])
    if isinstance(categories, str):
        categories = [categories]

    analytics["game_clicks"][game_id] = analytics["game_clicks"].get(game_id, 0) + 1
    for cat in categories:
        analytics["category_clicks"][cat] = analytics["category_clicks"].get(cat, 0) + 1

    return jsonify({"status": "ok"})

# --- Track search ---
@app.route("/api/roblox/search", methods=["POST"])
def search_term():
    data = request.json
    term = data.get("term", "").lower()
    if term:
        analytics["searches"][term] = analytics["searches"].get(term, 0) + 1
    return jsonify({"status": "ok"})

# --- Admin metrics ---
@app.route("/admin/metrics", methods=["GET"])
def metrics():
    return jsonify({
        "game_clicks": analytics["game_clicks"],
        "category_clicks": analytics["category_clicks"],
        "searches": analytics["searches"]
    })


if __name__ == "__main__":
    app.run(port=PORT, debug=True)