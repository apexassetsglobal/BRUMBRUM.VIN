"""Disposable local QA for free publication and the optional-support UI. No Stripe charges."""
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
from urllib.parse import parse_qs, urlsplit
import uuid

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
CHROME = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
OUTPUT = Path(os.environ.get("BROWSER_TEST_OUTPUT", ROOT / "var-support-browser"))
OUTPUT.mkdir(parents=True, exist_ok=True)
PASSWORD = "Local-support-QA-password"


def run(browser, base, directory):
    context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def api(path, data=None, method="POST", headers=None):
        response = context.request.fetch(base + "/api" + path, method=method, data=data,
            headers={"Origin": base, **(headers or {})})
        result = response.json()
        assert response.ok, (path, response.status, result)
        return result

    email = "support-qa@example.test"
    api("/auth/register", {"email": email, "password": PASSWORD, "name": "Test wsparcia", "terms": True, "profile_type": "private"})
    mail = json.loads((Path(directory) / "mailbox.jsonl").read_text().splitlines()[-1])
    token = parse_qs(urlsplit(mail["url"]).query)["token"][0]
    api("/auth/verify", {"token": token, "password": PASSWORD})
    api("/auth/login", {"email": email, "password": PASSWORD})

    def draft():
        key = api("/listings", {"key": str(uuid.uuid4())})["id"]
        state = api("/listings/" + key + "/photo", (ROOT / "public/assets/vehicle-1.webp").read_bytes(),
            headers={"Content-Type": "application/octet-stream", "X-Edit-Version": "0"})
        data = {"type": "car", "make": "Toyota", "model": "Corolla", "variant": "1.8 Hybrid QA", "year": 2021,
            "condition": "used", "mileage": 54000, "body": "wagon", "fuel": "hybrid", "gearbox": "auto", "drive": "fwd",
            "power": 122, "powerUnit": "KM", "damage": "no", "city": "Warszawa", "region": "Mazowieckie", "price": 68400,
            "description": "Pojazd testowy z dokumentacją i wyposażeniem.", "contact": "message", "equipment": ["abs"], "vin": ""}
        api("/listings/" + key + "/edit", {"version": state["version"], "data": data, "photos": state["photos"], "step": 5}, method="PUT")
        return key

    free = draft()
    page.goto(base + "/podglad/" + free)
    page.get_by_role("button", name="Opublikuj za darmo — 0 zł", exact=True).click()
    expect(page).to_have_url(base + "/moje-ogloszenia?wyslano=" + free)
    expect(page.get_by_text("Ogłoszenie jest już opublikowane.", exact=False)).to_be_visible()
    print("PASS free publication with Stripe unconfigured")

    optional = draft()
    page.goto(base + "/podglad/" + optional)
    expect(page.locator('button[name="support"]')).to_have_count(4)
    expect(page.locator('button[name="support"]').first).to_be_visible()
    page.locator('button[name="support"][value="v8-club"]').click()
    expect(page).to_have_url(base + "/wsparcie?ogloszenie=" + optional + "&pakiet=v8-club")
    expect(page.locator(".support-package")).to_have_count(4)
    expect(page.locator(".support-selected h2")).to_have_text("V8 CLUB BRUMBRUM")
    expect(page.locator(".support-package button[disabled]")).to_have_count(4)
    with sqlite3.connect(Path(directory) / "all4auto.sqlite") as db:
        assert db.execute("SELECT status FROM listings WHERE id=?", (optional,)).fetchone()[0] in ["published", "pending"]
        assert db.execute("SELECT count(*) FROM support_attempts").fetchone()[0] == 0
    print("PASS optional selection submits listing first and retains the selected package")

    pending = draft()
    for width in [360, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width": width, "height": 900})
        for route in ["/wsparcie", "/wsparcie/powrot?session_id=cs_live_unconfirmed", "/podglad/" + pending]:
            response = page.goto(base + route)
            assert response.status == 200, (width, route, response.status)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (width, route, "horizontal overflow")
            for button in page.locator(".support-grid button").all():
                box = button.bounding_box()
                assert box and box["width"] >= 44 and box["height"] >= 44
        print("PASS responsive support and preview at", width, "px")

    for width in [390, 1440]:
        page.set_viewport_size({"width": width, "height": 900})
        page.goto(base + "/wsparcie?ogloszenie=" + optional + "&pakiet=v8-club")
        page.screenshot(path=str(OUTPUT / ("support-" + str(width) + ".png")), full_page=True)
    page.goto(base + "/wsparcie?anulowano=1")
    expect(page.get_by_text("Przerwano płatność.", exact=False)).to_be_visible()
    page.get_by_role("link", name="Przejdź do moich ogłoszeń", exact=True).click()
    expect(page).to_have_url(base + "/moje-ogloszenia")
    page.goto(base + "/wsparcie/powrot?session_id=cs_live_forged&success=true")
    expect(page.get_by_role("heading", name="Sprawdzamy potwierdzenie płatności")).to_be_visible()
    assert not errors, errors
    print("PASS return without false confirmation, local abandonment view and no JavaScript errors")
    context.close()


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="var-test-", dir=ROOT) as directory:
        env = {**os.environ, "APP_MODE": "development", "APP_ORIGIN": "", "PORT": "0", "HOST": "127.0.0.1",
            "DATA_DIR": directory, "MAIL_API_KEY": "", "MAIL_FROM": "", "OWNER_SETUP_TOKEN": "", "STRIPE_SUPPORT_ENABLED": "0"}
        server = subprocess.Popen(["node", "server.mjs"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            line = server.stdout.readline()
            assert "http://" in line, line
            base = line.strip().split(" · ")[-1]
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=CHROME, headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage", "--single-process", "--no-zygote", "--disable-gpu", "--disable-software-rasterizer"])
                try:
                    run(browser, base, directory)
                finally:
                    browser.close()
        finally:
            server.terminate()
            _, stderr = server.communicate(timeout=10)
            if stderr:
                print(stderr)
