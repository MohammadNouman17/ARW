from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import mimetypes
import os
import sqlite3
import sys
import time
import urllib.parse


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data")).resolve()
DB_PATH = DATA_DIR / "water_can_inventory.db"


def db():
    DATA_DIR.mkdir(exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS people (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT NOT NULL DEFAULT '',
            location TEXT NOT NULL DEFAULT '',
            cans INTEGER NOT NULL DEFAULT 0 CHECK(cans >= 0),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """
    )
    columns = {row["name"] for row in con.execute("PRAGMA table_info(people)").fetchall()}
    if "mobile" not in columns:
        con.execute("ALTER TABLE people ADD COLUMN mobile TEXT NOT NULL DEFAULT ''")
    con.commit()
    return con


def row_to_person(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "mobile": row["mobile"],
        "loc": row["location"],
        "cans": row["cans"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def read_json(handler):
    length = int(handler.headers.get("Content-Length", "0") or 0)
    if length == 0:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    return json.loads(raw)


class AppHandler(SimpleHTTPRequestHandler):
    server_version = "WaterCanInventory/1.0"

    def translate_path(self, path):
        parsed = urllib.parse.urlparse(path)
        clean = urllib.parse.unquote(parsed.path).lstrip("/")
        if not clean:
            clean = "index.html"
        target = (PUBLIC_DIR / clean).resolve()
        if not str(target).startswith(str(PUBLIC_DIR.resolve())):
            return str(PUBLIC_DIR / "index.html")
        if target.is_dir():
            target = target / "index.html"
        return str(target)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        self.send_json(status, {"error": message})

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json(200, {"ok": True})
            return
        if parsed.path == "/api/people":
            with db() as con:
                rows = con.execute(
                    "SELECT * FROM people ORDER BY name COLLATE NOCASE ASC, id ASC"
                ).fetchall()
            self.send_json(200, {"people": [row_to_person(row) for row in rows]})
            return
        if parsed.path.startswith("/api/"):
            self.send_error_json(404, "API route not found")
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/api/people":
            self.send_error_json(404, "API route not found")
            return
        try:
            payload = read_json(self)
            name = str(payload.get("name", "")).strip()[:80]
            mobile = str(payload.get("mobile", "")).strip()[:24]
            location = str(payload.get("loc", payload.get("location", ""))).strip()[:80]
            cans = max(0, int(payload.get("cans", 0) or 0))
        except (ValueError, json.JSONDecodeError):
            self.send_error_json(400, "Invalid person payload")
            return
        if not name:
            self.send_error_json(400, "Name is required")
            return
        now = int(time.time())
        with db() as con:
            cur = con.execute(
                """
                INSERT INTO people (name, mobile, location, cans, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (name, mobile, location, cans, now, now),
            )
            row = con.execute("SELECT * FROM people WHERE id = ?", (cur.lastrowid,)).fetchone()
        self.send_json(201, {"person": row_to_person(row)})

    def do_PATCH(self):
        parsed = urllib.parse.urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        if len(parts) != 3 or parts[:2] != ["api", "people"]:
            self.send_error_json(404, "API route not found")
            return
        try:
            person_id = int(parts[2])
            payload = read_json(self)
        except (ValueError, json.JSONDecodeError):
            self.send_error_json(400, "Invalid update payload")
            return

        fields = []
        values = []
        if "name" in payload:
            name = str(payload.get("name", "")).strip()[:80]
            if not name:
                self.send_error_json(400, "Name is required")
                return
            fields.append("name = ?")
            values.append(name)
        if "mobile" in payload:
            fields.append("mobile = ?")
            values.append(str(payload.get("mobile", "")).strip()[:24])
        if "loc" in payload or "location" in payload:
            fields.append("location = ?")
            values.append(str(payload.get("loc", payload.get("location", ""))).strip()[:80])
        if "cans" in payload:
            try:
                cans = max(0, int(payload.get("cans", 0) or 0))
            except ValueError:
                self.send_error_json(400, "Cans must be a number")
                return
            fields.append("cans = ?")
            values.append(cans)
        if not fields:
            self.send_error_json(400, "No fields to update")
            return
        fields.append("updated_at = ?")
        values.append(int(time.time()))
        values.append(person_id)

        with db() as con:
            con.execute(f"UPDATE people SET {', '.join(fields)} WHERE id = ?", values)
            row = con.execute("SELECT * FROM people WHERE id = ?", (person_id,)).fetchone()
        if not row:
            self.send_error_json(404, "Person not found")
            return
        self.send_json(200, {"person": row_to_person(row)})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        if len(parts) != 3 or parts[:2] != ["api", "people"]:
            self.send_error_json(404, "API route not found")
            return
        try:
            person_id = int(parts[2])
        except ValueError:
            self.send_error_json(400, "Invalid person id")
            return
        with db() as con:
            cur = con.execute("DELETE FROM people WHERE id = ?", (person_id,))
        self.send_json(200, {"deleted": cur.rowcount > 0})

    def guess_type(self, path):
        if path.endswith(".webmanifest"):
            return "application/manifest+json"
        return mimetypes.guess_type(path)[0] or "application/octet-stream"


if __name__ == "__main__":
    db().close()
    host = "0.0.0.0"
    port = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PORT", "8787"))
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Water Can Tracker running on http://localhost:{port}")
    print("For mobile networks, deploy this app to a public cloud URL.")
    server.serve_forever()
