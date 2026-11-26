"""Browser QA of the integrated service directory and file-import workflows on a disposable database."""
import base64
import io
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import subprocess
import tempfile
from urllib.parse import parse_qs, urlsplit

from PIL import Image
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROME = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
OWNER_EMAIL = "service-owner@example.test"
ADMIN_EMAIL = "service-admin@example.test"
PASSWORD = "Valid-test-only-password-207"
COMPANY = "QA Serwis Rzeczny"


def request(api, base, target, payload):
    r = api.post(base + "/api/" + target, data=payload, headers={"Origin": base})
    assert r.ok, (target, r.status, r.text()[:240])
    return r.json()


def fixture_account(api, base, directory, email, name):
    request(api, base, "auth/register", {"email": email, "password": PASSWORD, "name": name, "profile_type": "private", "terms": True})
    mail = next(m for m in reversed([json.loads(line) for line in (directory / "mailbox.jsonl").read_text().splitlines()])
                if m["to"] == email and m["purpose"] == "verify")
    token = parse_qs(urlsplit(mail["url"]).query)["token"][0]
    request(api, base, "auth/verify", {"token": token, "password": PASSWORD})
    request(api, base, "auth/login", {"email": email, "password": PASSWORD})


def query(db, sql, params=()):
    return db.execute(sql, params).fetchone()


def open_page(page, base, route, status=200):
    r = page.goto(base + route, wait_until="domcontentloaded")
    assert r.status == status, (route, r.status, page.locator("main").inner_text()[:200])


def check_width(page, route, width, theme):
    details = page.evaluate("""() => {
      const w = innerWidth;
      const rail = document.querySelector('.side-nav a[href="/uslugi"]');
      const primary = rail.getBoundingClientRect().width ? rail : document.querySelector('.bottom-nav a[href="/konto"]');
      const box = primary?.getBoundingClientRect();
      return {
        width: document.documentElement.scrollWidth,
        header: box && [box.x, box.y, box.right, box.width],
        offender: [...document.querySelectorAll('main *')].find(n => {
          const r=n.getBoundingClientRect(); return r.width && r.right > w+1 && !n.closest('.auto-table, .leaflet-container');
        })?.outerHTML.slice(0,140)
      };
    }""")
    assert details["width"] <= width + 1, (route, width, theme, details)
    assert details["header"] and details["header"][0] >= -1 and details["header"][2] <= width + 1 and details["header"][3] >= 32, (route, width, theme, details)


def make_photo():
    # A generated grayscale test pattern with no third-party photos or identities.
    data = io.BytesIO()
    Image.effect_noise((2800, 500), 35).convert("RGB").save(data, format="PNG")
    return data.getvalue()


def create_company(page, db, base):
    open_page(page, base, "/")
    expect(page.locator('.site-head a[href="/uslugi"]')).to_have_count(0)
    page.locator('.bottom-nav a[href="/konto"]').click()
    page.locator('#uslugi-konta a[href="/uslugi"]').click()
    expect(page).to_have_url(base + "/uslugi")
    expect(page.get_by_role("heading", name="Usługi motoryzacyjne", exact=True)).to_be_visible()
    assert page.locator('select[name=category] option').count() == 19
    tiles = page.locator('.svc-tile')
    expect(tiles).to_have_count(18)
    wash = tiles.filter(has_text="Myjnie samochodowe")
    expect(wash.locator('img')).to_have_attribute('src', '/assets/service-categories/myjnie.webp')
    maps = urlsplit(wash.get_by_role('link', name='Myjnie samochodowe · Google Maps').get_attribute('href'))
    assert maps.netloc == 'www.google.com' and parse_qs(maps.query)['query'] == ['Myjnie samochodowe']
    wash.get_by_role('link', name='Myjnie samochodowe', exact=True).click()
    expect(page.locator('select[name=category]')).to_have_value('myjnie')
    open_page(page, base, "/uslugi")
    page.get_by_role("link", name="Dodaj swoją firmę").click()
    expect(page).to_have_url(base + "/moje-uslugi")
    page.get_by_role("textbox", name="Nazwa firmy").fill(COMPANY)
    page.get_by_role("button", name="Utwórz wizytówkę").click()
    page.wait_for_url(re.compile(r".*/moje-uslugi/[a-f0-9-]+$"))
    editor_url = page.url
    form = page.locator('[data-svc-edit]')
    form.locator('[name="country"]').select_option("PL")
    for name, value in {"region":"Śląskie", "city":"Katowice", "address":"Testowa 10",
                        "lat":"50.265", "lon":"19.02", "description":"Testowa firma prowadzi serwis mechaniczny i auto detailing w swoim warsztacie.",
                        "brands":"Toyota, Honda", "phone":"+1 202 555 0141", "email":OWNER_EMAIL,
                        "prices":"Mycie: 120 PLN", "hours":"Pon–Pt 08:00–16:00"}.items():
        form.locator('[name="' + name + '"]').fill(value)
    form.locator('[data-svc-category][value="detailing"]').check()
    form.locator('[data-svc-category][value="warsztaty"]').check()
    form.locator('[name=contactConsent]').check()
    form.locator('[name=mobile]').check()
    with page.expect_response(lambda r: r.url.endswith("/save") and r.request.method == "POST") as saved:
        form.get_by_role("button", name="Zapisz szkic").click()
    assert saved.value.ok, saved.value.text()
    expect(form.locator("input[name=revision]")).to_have_value("1")
    expect(form.locator('[data-svc-category][value="warsztaty"]')).to_be_checked()
    expect(form.locator('[name=city]')).to_have_value("Katowice")
    image = make_photo()
    uploader = page.locator('[data-svc-upload]')
    uploader.locator('select[name=kind]').select_option("cover")
    uploader.locator('[type=file]').set_input_files({"name":"kontrolny.png", "mimeType":"image/png", "buffer":image})
    with page.expect_response(lambda r: "/media?kind=cover" in r.url and r.request.method == "POST") as uploaded:
        uploader.get_by_role("button", name="Dodaj materiały").click()
    assert uploaded.value.ok, uploaded.value.text()
    expect(page.locator('.svc-gallery img')).to_have_count(1)
    img = page.locator('.svc-gallery img')
    img.scroll_into_view_if_needed()
    expect(img).to_be_visible()
    page.wait_for_function("document.querySelector('.svc-gallery img')?.naturalWidth === 2600")
    firm_id = editor_url.rsplit("/",1)[1]
    mime, output_size = query(db, "SELECT mime,size FROM service_media WHERE firm_id=? AND kind='cover'", (firm_id,))
    assert mime == 'image/webp' and output_size < len(image), (mime, output_size, len(image))
    form.get_by_role("button", name="Opublikuj za darmo", exact=False).click()
    expect(page).to_have_url(base + "/moje-uslugi?submitted=1")
    expect(page.get_by_text("Wizytówka trafiła do moderacji")).to_be_visible()
    expect(page.get_by_text("W moderacji", exact=True)).to_be_visible()
    slug, status = query(db, "SELECT slug,status FROM service_firms WHERE id=?", (firm_id,))
    assert status == "pending"
    assert page.context.request.get(base + "/uslugi/firma/" + slug).status == 404
    print("PASS menu → 18 service categories → company draft → two persisted categories → 2800 px PNG compressed to 2600 px WebP → moderation")
    return firm_id, slug


def import_file(page, db, base):
    open_page(page, base, "/moje-ogloszenia")
    page.locator('main').get_by_role("link", name="Import i automatyzacja").click()
    expect(page).to_have_url(base + "/moje-ogloszenia/import")
    create = page.locator('[data-auto-create]')
    create.locator('[name=name]').fill("Testowy plik integracyjny")
    create.locator('[name=kind]').select_option("file")
    create.locator('[name=format]').select_option("csv")
    create.locator('[name=rights]').check()
    create.get_by_role("button", name="Podłącz źródło").click()
    page.wait_for_url("**/moje-ogloszenia/import?source=*")
    panel = page.locator('.auto-source[open]')
    csv = "ID oferty;Marka;Nazwa handlowa QA;Rok produkcji;Cena;Waluta;Miasto\nQA-CSV-01;Toyota;Corolla;2020;56200;PLN;Katowice\n"
    panel.locator('input[type=file]').set_input_files({"name":"pojazd.csv","mimeType":"text/csv","buffer":csv.encode()})
    panel.get_by_role("button", name="Sprawdź i mapuj pola").click()
    mapping = panel.locator('[data-auto-map]')
    expect(mapping.get_by_role("heading", name="Mapowanie pól", exact=False)).to_be_visible()
    expect(mapping.locator('[name=external_id]')).to_have_value("ID oferty")
    expect(mapping.locator('[name=make]')).to_have_value("Marka")
    mapping.locator('summary').filter(has_text="Pozostałe pola").click()
    mapping.locator('[name=model]').select_option("Nazwa handlowa QA")
    mapping.locator('summary').filter(has_text="Podgląd danych źródłowych").click()
    expect(mapping.locator('pre')).to_contain_text("QA-CSV-01")
    mapping.get_by_role("button", name="Importuj wszystkie oferty").click()
    page.wait_for_url(re.compile(r".*/import\?.*job="))
    history = page.locator('details[data-auto-job]')
    expect(history.locator("summary")).to_contain_text("Zakończono", timeout=15000)
    if not history.evaluate("el => el.open"):
        history.locator('summary').click()
    expect(history.get_by_role("link", name="Sprawdź")).to_be_visible()
    expect(history.locator('li')).to_contain_text("QA-CSV-01")
    job_row = query(db, "SELECT l.make,l.model,l.status,i.external_id FROM auto_items i JOIN listings l ON l.id=i.listing_id")
    assert job_row == ("Toyota", "Corolla", "draft", "QA-CSV-01"), job_row
    assert query(db, "SELECT count(*) FROM auto_items")[0] == 1
    history.get_by_role("link", name="Sprawdź").click()
    page.wait_for_url("**/podglad/*")
    expect(page.locator("main")).to_contain_text("Corolla")
    print("PASS listing panel → CSV source → preview → manual model mapping → import history → one draft with the mapped vehicle")


def review_company(page, base, firm_id, slug):
    open_page(page, base, "/moderacja-uslug")
    page.get_by_role('link', name='Otwórz całą wizytówkę').click()
    expect(page).to_have_url(base + '/moderacja-uslug/' + firm_id)
    expect(page.get_by_role('heading', name=COMPANY)).to_be_visible()
    open_page(page, base, "/moderacja-uslug")
    page.get_by_role('button', name='Zatwierdź').click()
    expect(page.get_by_text("Brak zgłoszeń", exact=True)).to_be_visible()
    open_page(page, base, "/uslugi")
    search = page.locator('.svc-filter')
    search.locator('[name=country]').select_option("PL")
    search.locator('[name=category]').select_option("warsztaty")
    search.locator('[name=brand]').fill("Toyota")
    search.locator('[name=city]').fill("Katowice")
    search.locator('[name=mobile]').check()
    search.get_by_role('button', name='Szukaj firm').click()
    card = page.locator('.svc-card')
    expect(card).to_have_count(1)
    expect(card.get_by_role('heading')).to_have_text(COMPANY)
    page.get_by_role('link', name='Mapa', exact=True).click()
    map_section = page.locator('[data-services-map="results"]')
    map_section.scroll_into_view_if_needed()
    pin = map_section.locator(".service-map-pin")
    expect(pin).to_have_attribute("aria-label", COMPANY)
    pin.click()
    expect(page).to_have_url(base + '/uslugi/firma/' + slug)
    for contact, target in [('Zadzwoń','tel:+12025550141'), ('Napisz','mailto:'+OWNER_EMAIL),
                            ('Wyznacz trasę','https://www.google.com/maps/dir/?api=1&destination=50.265,19.02'),
                            ('Zobacz ofertę','#oferta')]:
        expect(page.locator('main').get_by_role('link', name=contact, exact=True)).to_have_attribute("href", target)
    print("PASS moderator preview and approval → combined directory filters → map pin → public profile and four contact destinations")


def responsive(page, base, sections):
    for theme in ["light", "dark"]:
        page.evaluate("mode => localStorage.setItem('a4-theme', mode)", theme)
        for width in [360, 390, 768, 1024, 1440]:
            page.set_viewport_size({"width":width, "height":900})
            for route in sections:
                open_page(page, base, route)
                expect(page.locator("html")).to_have_attribute("data-theme", theme)
                check_width(page, route, width, theme)
    rail = page.locator('.side-nav a[href="/uslugi"]')
    rail.click()
    expect(page).to_have_url(base + "/uslugi")
    print("PASS account navigation, service tiles, desktop rail and document width at 360/390/768/1024/1440 in light and dark mode on " + ", ".join(sections))


def run(browser, base, directory, owner_token):
    context = browser.new_context(viewport={"width":390, "height":844}, reduced_motion="reduce", service_workers="block")
    # Only the local project receives browser traffic; external contact buttons remain unopened.
    context.route("**/*", lambda route:
        route.fulfill(status=503, body="QA offline") if not route.request.url.startswith(base + "/")
        or urlsplit(route.request.url).path == "/api/exchange-rates" else route.continue_())
    fixture_account(context.request, base, directory, OWNER_EMAIL, "Właściciel testowy")
    page = context.new_page()
    page.set_default_timeout(8000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    with sqlite3.connect(directory / "all4auto.sqlite") as db:
        firm_id, slug = create_company(page, db, base)
        import_file(page, db, base)
        assert context.request.get(base + "/administracja/import").status == 403
        responsive(page, base, ["/moje-uslugi", "/moje-ogloszenia/import", "/uslugi"])
        request(context.request, base, "auth/logout", {})
        fixture_account(context.request, base, directory, ADMIN_EMAIL, "Administrator testowy")
        request(context.request, base, "auth/owner", {"token":owner_token})
        review_company(page, base, firm_id, slug)
        open_page(page, base, "/administracja/import")
        expect(page.locator("main")).to_contain_text("Właściciel testowy")
        responsive(page, base, ["/administracja/import"])
    assert not errors, errors
    print("PASS admin-only import metrics and isolation; no uncaught JavaScript errors")
    context.close()


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="service-workflows-", dir=os.environ.get("TMPDIR")) as temp:
        directory = Path(temp)
        token = secrets.token_urlsafe(32)
        env = {**os.environ, "HOST":"127.0.0.1", "PORT":"0", "DATA_DIR":temp, "APP_MODE":"development", "APP_ORIGIN":"",
               "OWNER_EMAIL":ADMIN_EMAIL, "OWNER_SETUP_TOKEN":token, "MAIL_API_KEY":"", "MAIL_FROM":"",
               "IMPORT_SECRET_KEY":base64.b64encode(secrets.token_bytes(32)).decode(), "IMPORT_TICK_MS":"500", "IMPORT_CHANNELS":"[]",
               "STRIPE_SUPPORT_ENABLED":"0", "OPENAI_API_KEY":"", "SERVICE_AI_PROVIDER":""}
        process = subprocess.Popen(["node", "server.mjs"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            line = process.stdout.readline()
            assert "http://" in line, (line, process.stderr.readline())
            base = line.strip().split(" · ")[-1]
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=CHROME, headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage", "--single-process", "--no-zygote", "--disable-gpu", "--disable-software-rasterizer"])
                try:
                    run(browser, base, directory, token)
                finally:
                    browser.close()
        finally:
            process.terminate()
            _, stderr = process.communicate(timeout=10)
            if stderr:
                print(stderr)
