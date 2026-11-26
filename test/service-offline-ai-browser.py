"""Exercise real on-device inference against a running installation with Playwright/Chromium.

python test/service-offline-ai-browser.py http://localhost:3000 --all
--models replays original compressed Mozilla files named by their SHA-256 hashes.
Without this option Chromium downloads the pinned files directly from Mozilla.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit

from playwright.sync_api import sync_playwright

samples = {
    "pl": "Wymieniamy opony i naprawiamy samochody.",
    "en": "We change tires and repair cars.",
    "de": "Wir wechseln Reifen und reparieren Autos.",
    "cs": "Měníme pneumatiky a opravujeme auta.",
    "sk": "Meníme pneumatiky a opravujeme autá.",
    "uk": "Ми міняємо шини та ремонтуємо автомобілі.",
}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("origin")
    parser.add_argument("--models", type=Path)
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()
    origin = args.origin.rstrip("/")
    assert urlsplit(origin).scheme in ("http", "https")
    manifest_path = Path(__file__).resolve().parents[1] / "public/assets/service-offline-ai-vendor/models.json"
    catalog = json.loads(manifest_path.read_text(encoding="utf-8"))
    files = {file["file"]: file for group in catalog.values() for file in group}
    cdn = "https://storage.googleapis.com/download/storage/v1/b/moz-fx-translations-data--303e-prod-translations-data/o/"
    calls = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
            headless=True, args=["--no-sandbox","--disable-dev-shm-usage"]
        )
        context = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        def model_request(route):
            request = route.request
            assert request.method == "GET" and request.post_data is None
            name = unquote(urlsplit(request.url).path.split("/o/", 1)[1])
            file = files[name]
            calls.append(name)
            if args.models:
                data = (args.models / file["hash"]).read_bytes()
                assert hashlib.sha256(data).hexdigest() == file["hash"]
                route.fulfill(status=200,body=data,headers={"Content-Type":"application/gzip","Access-Control-Allow-Origin":"*"})
            else:
                route.continue_()
        context.route("**/*", lambda route: route.continue_()
                      if route.request.url.startswith(origin+"/") else route.abort())
        context.route(cdn+"**", model_request)
        page = context.new_page()
        page.goto(origin+"/offline.html", wait_until="domcontentloaded")
        plan = page.evaluate("""async () => {
          window.deviceTranslation = await import('/assets/service-offline-ai.js');
          return deviceTranslation.offlineTranslationPlan('pl','de');
        }""")
        assert plan["downloadBytes"] > 0 and not calls
        denied = page.evaluate("""async () => {
          try { await deviceTranslation.translateServiceOnDevice({text:'Przykład',from:'pl',to:'de'}); }
          catch (error) { return error.code; }
        }""")
        assert denied == "download_required" and not calls
        pairs = [(a,b) for a in samples for b in samples if a != b] if args.all else [("pl","en"),("en","de"),("pl","de")]
        for source,target in pairs:
            result = page.evaluate("""async ([from,to,text]) =>
              deviceTranslation.translateServiceOnDevice({from,to,text,allowDownload:true})""",
              [source,target,samples[source]])
            assert result["text"] and result["text"] != samples[source]
            assert result["via"] == (None if "en" in (source,target) else "en")
            print(f"{source} → {target}    {result['text']}", flush=True)
        count = len(calls)
        def disconnect_models(route):
            calls.append("unexpected download after disconnect")
            route.abort()
        context.route(cdn+"**", disconnect_models)
        result = page.evaluate("""async () => deviceTranslation.translateServiceOnDevice({
          from:'pl',to:'en',text:'Zapraszamy do naszego warsztatu.'
        })""")
        assert result["text"] and len(calls) == count
        browser.close()

if __name__ == "__main__":
    main()
