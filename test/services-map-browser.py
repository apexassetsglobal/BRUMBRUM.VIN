"""Exercise the services map in Chromium. All business records and street-tile responses are local fixtures."""
import base64
import html
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TILE = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1sAAAAASUVORK5CYII=")
CHROME = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
POINTS = [
    {"lat": 52.23, "lon": 21.01, "name": "Serwis testowy", "url": "/uslugi/firma/serwis-testowy"},
    {"lat": 52.26, "lon": 21.04, "name": "Firma A", "url": "/uslugi/firma/firma-a"},
    {"lat": 52.26, "lon": 21.04, "name": "Firma <B>", "url": "/uslugi/firma/firma-b"},
    {"lat": 52.24, "lon": 21, "name": "Zewnętrzny adres", "url": "//outside.example"},
    {"lat": None, "lon": 21, "name": "Brak współrzędnych", "url": "/uslugi/firma/brak"},
]
FORM = """
  <form method="get" action="/szukaj" id="search">
    <input name="city" value="Katowice">
    <input name="lat" type="hidden"><input name="lon" type="hidden">
    <select name="radius"><option value="">—</option><option value="25">25 km</option></select>
    <button type="button" data-service-locate="search">Moja lokalizacja</button>
  </form>
  <form id="editor">
    <label>Lat <input name="latitude" type="number" step="any"></label>
    <label>Lon <input name="longitude" type="number" step="any"></label>
    <button type="button" data-service-locate="picker">Wskaż GPS</button>
    <div data-services-map="picker"></div>
  </form>
"""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "public"), **kwargs)

    def log_message(self, *args):
        pass

    def do_GET(self):
        target = urlsplit(self.path)
        if target.path.startswith("/assets/"):
            super().do_GET()
            return
        if target.path == "/":
            params = parse_qs(target.query)
            points = POINTS
            if "dateline" in params:
                points = [dict(lat=-17, lon=179, name="West", url="/west"), dict(lat=-17, lon=-179, name="East", url="/east")]
            payload = html.escape(json.dumps(points), quote=True)
            body = ('<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
                    '<link rel="stylesheet" href="/assets/services-map.css">'
                    '<script type="module" src="/assets/services-map.js"></script>'
                    '<main><div data-services-map="results" data-service-markers="' + payload + '"></div>' + FORM + '</main></html>')
        else:
            body = "<!doctype html><title>Wybrany wynik</title><main>Wybrany wynik</main>"
        content = body.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Permissions-Policy", "geolocation=(self)")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'")
        self.end_headers()
        self.wfile.write(content)


def run(browser, base):
    context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce",
                                  geolocation={"latitude": -33.8688, "longitude": 151.2093})
    page = context.new_page()
    errors, tile_headers = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    offline_tiles = [True]

    def substitute(route):
        tile_headers.append(route.request.all_headers())
        if offline_tiles[0]:
            route.fulfill(status=503, body="Unavailable", headers={"Cache-Control": "no-store"})
        else:
            route.fulfill(status=200, content_type="image/png", body=TILE, headers={"Cache-Control": "no-store"})

    # No automation fetches provider tiles. This also tests local real geometry while every online tile fails.
    context.route("https://tile.openstreetmap.org/**", substitute)
    context.add_init_script("""
        window.gpsRequests = 0;
        const getPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        navigator.geolocation.getCurrentPosition = (...args) => { window.gpsRequests++; getPosition(...args); };
    """)
    page.goto(base + "/")
    results = page.locator('[data-services-map="results"]')
    expect(results).to_have_attribute("data-service-atlas", "loaded")
    expect(results).to_have_attribute("data-service-tiles", "fallback")
    expect(results.locator(".leaflet-serviceAtlas-pane canvas")).to_have_count(1)
    expect(results.get_by_text("Podkład uliczny jest niedostępny.", exact=False)).to_be_visible()
    assert page.evaluate("window.gpsRequests") == 0
    assert tile_headers and all(h.get("referer") == base + "/" for h in tile_headers), tile_headers[:1]
    expect(results.locator(".service-map-pin")).to_have_count(2)
    expect(results.get_by_role("link", name="Serwis testowy")).to_be_visible()
    expect(results.get_by_role("link", name="Zewnętrzny adres")).to_have_count(0)
    print("PASS local world geography, real-coordinate pins, no automatic location request and origin-only tile referrer")

    offline_tiles[0] = False
    results.get_by_role("button", name="Ponów").click()
    expect(results).to_have_attribute("data-service-tiles", "loaded")
    expect(results.get_by_role("link", name="OpenStreetMap")).to_be_visible()
    expect(results.get_by_role("link", name="Natural Earth")).to_be_visible()
    zoom = results.get_by_role("button", name="Powiększ")
    before = results.locator(".service-map-marker").first.get_attribute("style")
    zoom.click()
    page.wait_for_function("(previous) => document.querySelector('.service-map-marker').style.cssText !== previous", arg=before)
    canvas = results.locator(".service-map-canvas")
    bounds = canvas.bounding_box()
    dragx, dragy = bounds["x"] + bounds["width"] * 0.7, bounds["y"] + bounds["height"] * 0.7
    transform = results.locator(".leaflet-map-pane").evaluate("node => node.style.transform")
    page.mouse.move(dragx, dragy)
    page.mouse.down()
    page.mouse.move(dragx - 25, dragy - 15, steps=8)
    page.mouse.up()
    page.wait_for_function("(previous) => document.querySelector('.leaflet-map-pane').style.transform !== previous", arg=transform)
    print("PASS tile recovery, attribution, zoom and drag")

    page.goto(base + "/")
    group = results.get_by_role("button", name="Firmy pod tym adresem (2)")
    group.click()
    expect(results.get_by_role("link", name="Firma <B>")).to_be_visible()
    assert page.evaluate("document.activeElement.textContent") == "Firma A"
    results.get_by_role("link", name="Firma <B>").click()
    expect(page).to_have_url(base + "/uslugi/firma/firma-b")
    page.goto(base + "/")
    profile = results.get_by_role("link", name="Serwis testowy")
    profile.focus()
    page.keyboard.press("Enter")
    expect(page).to_have_url(base + "/uslugi/firma/serwis-testowy")
    print("PASS individual profile navigation and shared-location keyboard-accessible profile chooser")

    page.goto(base + "/?dateline=1")
    for name in ["West", "East"]:
        pin = results.get_by_role("link", name=name)
        expect(pin).to_be_in_viewport()
    print("PASS international markers on both sides of the date line")

    page.goto(base + "/")
    editor = page.locator("#editor")
    picker = editor.locator('[data-services-map="picker"]')
    picker.scroll_into_view_if_needed()
    expect(picker).to_have_attribute("data-service-atlas", "loaded")
    expect(picker.locator(".service-map-picked")).to_have_count(0)
    picker.get_by_role("button", name="Ustaw punkt na środku mapy").click()
    expect(picker.locator(".service-map-picked")).to_have_count(1)
    lat = editor.locator('[name="latitude"]')
    lon = editor.locator('[name="longitude"]')
    first = float(lon.input_value())
    area = picker.locator(".service-map-canvas")
    rect = area.bounding_box()
    area.click(position={"x":int(rect["width"] * .65), "y":int(rect["height"] * .55)})
    assert abs(float(lon.input_value()) - first) > 1
    lon.fill("0")
    lon.press("Tab")
    lat.fill("0")
    lat.press("Tab")
    expect(picker.locator(".service-map-picked")).to_have_count(1)
    assert page.url == base + "/" and page.evaluate("window.gpsRequests") == 0
    context.grant_permissions(["geolocation"], origin=base)
    editor.get_by_role("button", name="Wskaż GPS").click()
    expect(lat).to_have_value("-33.868800")
    expect(lon).to_have_value("151.209300")
    assert page.url == base + "/" and page.evaluate("window.gpsRequests") == 1
    page.locator('#search button').click()
    page.wait_for_url("**/szukaj?**")
    params = parse_qs(urlsplit(page.url).query)
    assert params == {"lat": ["-33.868800"], "lon": ["151.209300"], "city": ["Katowice"], "radius": ["25"]}, params
    print("PASS initial empty location, map tap, keyboard selection, zero coordinates, granted geolocation and radius search")

    page.goto(base + "/")
    # Set actual browser permission to denied for this origin in this context.
    cdp = context.new_cdp_session(page)
    target = cdp.send("Target.getTargetInfo")["targetInfo"]
    cdp.send("Browser.setPermission", {"permission": {"name": "geolocation"}, "setting":"denied",
             "origin": base, "browserContextId": target["browserContextId"]})
    for form, label in [(page.locator("#search"), "Moja lokalizacja"), (page.locator("#editor"), "Wskaż GPS")]:
        btn = form.get_by_role("button", name=label)
        btn.click()
        expect(form.get_by_text("Zezwól na lokalizację w przeglądarce lub wpisz ją ręcznie.")).to_be_visible()
        expect(btn).to_be_enabled()
        assert form.locator('input[name="lat"], input[name="latitude"]').input_value() == ""
        assert page.url == base + "/"
    print("PASS denied geolocation in both forms; manual location stays available")

    for width in [360, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width": width, "height": 900})
        for surface in [results, page.locator('[data-services-map="picker"]')]:
            surface.scroll_into_view_if_needed()
            expect(surface).to_have_attribute("data-service-map-ready", "true")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            box = surface.locator(".service-map-canvas").bounding_box()
            assert box["height"] >= 290 and box["width"] <= width
    assert not errors, errors
    print("PASS responsive 360/390/768/1024/1440 px, both map modes, no uncaught JavaScript errors")
    context.close()


if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server, sync_playwright() as playwright:
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            browser = playwright.chromium.launch(executable_path=CHROME, headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--single-process", "--no-zygote", "--disable-gpu", "--disable-software-rasterizer"])
            try:
                run(browser, "http://127.0.0.1:" + str(server.server_port))
            finally:
                browser.close()
        finally:
            server.shutdown()
            worker.join(timeout=5)
