"""Playwright regression checks for the local, disposable BRUMBRUM.VIN server."""
import json
from hashlib import sha256
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
from datetime import datetime, timezone
import urllib.request
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROME = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
OUTPUT = os.environ.get("BROWSER_TEST_OUTPUT", "")
DEMO_LISTINGS = 113
errors = []


def label(page, name):
    return page.get_by_label(re.compile(r"^"+re.escape(name)+r"(?: \*)?$"))


def button(page, name):
    return page.get_by_role("button", name=name, exact=True)


def stitched_vehicle_button(action):
    expect(action).to_be_visible()
    assert action.evaluate("""action => {
        const button = action.getBoundingClientRect();
        const border = getComputedStyle(action);
        const seam = getComputedStyle(action, '::after');
        const left = button.left + parseFloat(border.borderLeftWidth) + parseFloat(seam.left) + parseFloat(seam.borderLeftWidth);
        const right = button.right - parseFloat(border.borderRightWidth) - parseFloat(seam.right) - parseFloat(seam.borderRightWidth);
        const label = document.createRange();
        label.selectNodeContents(action.querySelector('.button-embroidery-label'));
        const parts = [action.querySelector('.ui-icon').getBoundingClientRect(), ...label.getClientRects()];
        return seam.borderLeftStyle === 'dashed' && parts.length === 2 &&
            parts.every(part => part.left - left >= 6 && right - part.right >= 6) &&
            button.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
    }""")


def open_profile(page):
    trigger = page.locator("[data-profile-menu-toggle]:visible")
    trigger.click()
    expect(trigger).to_have_attribute("aria-expanded", "true")


def nav_geometry(page, width):
    stats = page.evaluate("""() => {
      const nav = document.querySelector('.bottom-nav');
      const side = document.querySelector('.side-nav');
      const links = Array.from(nav.children).map(a => a.getBoundingClientRect());
      const labels = Array.from(nav.querySelectorAll('a > span:not(.count)'));
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        nav: getComputedStyle(nav).display,
        closed: side.inert && !side.hasAttribute('data-side-visible'),
        fixedRight: getComputedStyle(side).position === 'fixed' && getComputedStyle(side).right === '0px',
        headerActions: getComputedStyle(document.querySelector('.head-actions')).display,
        rows: new Set(links.map(r => Math.round(r.top))).size,
        count: links.length,
        inBounds: links.every(r => r.x >= 0 && r.right <= innerWidth),
        labelsFit: labels.every(label => {
          const box = label.getBoundingClientRect();
          const tab = label.parentElement.getBoundingClientRect();
          return box.height > 0 && box.top >= tab.top && box.bottom <= Math.min(tab.bottom, innerHeight)
            && label.scrollWidth <= label.clientWidth + 1;
        }),
        gap: document.body.getBoundingClientRect().bottom - document.querySelector('.site-foot').getBoundingClientRect().bottom
      };
    }""")
    assert stats["overflow"] == 0, (width, stats)
    height = page.viewport_size["height"]
    desktop = width >= 1041 and page.evaluate("matchMedia('(hover:hover) and (pointer:fine)').matches")
    landscape_tablet = width >= 768 and height >= 480 and width > height
    if not (desktop or landscape_tablet):
        assert stats["nav"] == "grid" and stats["count"] == 6 and stats["rows"] == 1 and stats["inBounds"] and stats["labelsFit"], stats
        assert stats["gap"] >= 60 and stats["closed"], stats
    else:
        assert stats["closed"] and stats["nav"] == "none" and stats["fixedRight"] and stats["headerActions"] == "none", stats


def account_menu(browser, base):
    with browser.new_context(viewport={"width": 810, "height": 1080}, has_touch=True) as context:
        page = context.new_page()
        page.goto(base + "/demo/zaloguj")
        expect(page.locator(".demo-roles")).to_contain_text("Dla komisów i dealerów")
        for role, group_count in (("Administrator", 3), ("Kupujący", 2)):
            page.goto(base + "/demo/zaloguj")
            button(page, "Wybierz rolę · " + role).tap()
            expect(page.locator(".account-identity-role")).to_contain_text(role)
            for width, height in ((360, 800), (768, 1024), (1024, 768), (1440, 900), (1920, 1080)):
                page.set_viewport_size({"width": width, "height": height})
                expect(page.locator("#ustawienia-konta #jezyk > summary")).to_be_visible()
                nav_geometry(page, width)
            page.reload()
            dashboard = page.locator(".account-dashboard")
            expect(dashboard.locator(".account-menu-group:visible")).to_have_count(group_count)
            titles = dashboard.locator(".account-menu-copy > strong:visible")
            for title in ("Moje ogłoszenia", "Wiadomości", "Powiadomienia", "Ulubione", "Porównywarka"):
                expect(titles.filter(has_text=re.compile(r"^" + title + r"$"))).to_be_visible()
            expect(dashboard.locator(".account-menu-copy small").first).to_have_css("font-size", "14px")
            expect(titles.filter(has_text="Panel administratora")).to_have_count(int(role == "Administrator"))
            options = page.locator("#ustawienia-konta .account-settings-columns")
            for target in ("dane-konta", "kontakt-profilu", "preferencje-powiadomien", "jezyk", "rozmiar-tekstu", "wyglad-ikon"):
                expect(options.locator(f"#{target} > summary")).to_be_visible()
            expect(options.get_by_role("link", name="Polityka prywatności", exact=True)).to_be_visible()
            expect(options.get_by_role("link", name="Ustawienia cookies", exact=True)).to_be_visible()
            expect(page.locator("#role-demo .account-menu-row:visible")).to_have_count(5)
            if OUTPUT and role == "Administrator":
                page.screenshot(path=str(Path(OUTPUT) / "account-desktop.png"), full_page=True)
            options.locator("#dane-konta > summary").focus()
            page.keyboard.press("Enter")
            expect(label(page, "Nazwa profilu")).to_be_visible()
            expect(options.locator("#jezyk > summary")).to_be_visible()
    with browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True) as context:
        page = context.new_page()
        page.add_init_script("localStorage.setItem('a4-icon-style', 'aurora')")
        page.goto(base + "/demo/zaloguj")
        roles = page.locator(".demo-roles button[type=submit]")
        expect(roles).to_have_count(5)
        assert roles.evaluate_all("rows => rows.every(row => row.getBoundingClientRect().height >= 44)")
        if OUTPUT:
            page.screenshot(path=str(Path(OUTPUT) / "account-demo-roles.png"))
        button(page, "Wybierz rolę · Sprzedawca").tap()
        expect(page).to_have_url(base + "/demo/konto")
        expect(page.locator(".account-identity")).to_contain_text("Sprzedawca demo")
        menu_group = page.locator(".account-dashboard .account-menu-box").first
        expect(menu_group).to_have_css("border-top-width", "0px")
        expect(menu_group).to_have_css("background-color", "rgba(0, 0, 0, 0)")
        expect(menu_group.locator(".account-menu-icon").first).to_be_visible()
        add_vehicle = page.get_by_role("link", name="Dodaj pojazd", exact=True)
        expect(add_vehicle).to_have_attribute("href", "/demo/sprzedaj")
        expect(add_vehicle).to_have_css("box-shadow", "none")
        expect(add_vehicle).to_have_css("background-color", "rgb(7, 88, 182)")
        for width in (320, 390):
            page.set_viewport_size({"width": width, "height": 844})
            assert add_vehicle.evaluate("""action => {
                const label = action.querySelector('.button-embroidery-label') ??
                    [...action.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
                const range = document.createRange();
                range.selectNodeContents(label);
                const bounds = action.getBoundingClientRect();
                const heading = action.closest('.account-menu-heading').getBoundingClientRect();
                return range.getClientRects().length === 1 && bounds.height >= 44 && bounds.right <= heading.right + 1;
            }"""), width
        page.evaluate("""() => localStorage.setItem('a4-button-finish', JSON.stringify({
            color: 'graphite', material: 'grained', stitch: 'double', thread: 'red'
        }))""")
        page.reload()
        for width in (320, 390, 768, 820):
            page.set_viewport_size({"width": width, "height": 1080})
            stitched_vehicle_button(add_vehicle)
        page.goto(base + "/")
        sell_vehicle = page.locator(".head-sell")
        for width in (768, 820):
            page.set_viewport_size({"width": width, "height": 1080})
            stitched_vehicle_button(sell_vehicle)
        page.evaluate("localStorage.removeItem('a4-button-finish')")
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(base + "/demo/konto")
        if OUTPUT:
            page.screenshot(path=str(Path(OUTPUT) / "account-menu.png"))
        page.get_by_role("link", name="Zarządzaj kontem").tap()
        expect(page).to_have_url(base + "/demo/konto#ustawienia-konta")
        expect(page.locator("#ustawienia-konta #dane-konta > summary")).to_be_in_viewport()
        expect(page.locator("#funkcje-konta").get_by_role("button", name="Wyloguj się")).to_be_visible()
        page.locator("#wyglad-ikon > summary").tap()
        expect(page.locator("#wyglad-ikon [data-icon-settings]")).to_be_visible()
        expect(page.locator("#icon-style-dialog")).to_have_count(0)
        appearance = page.locator("#wyglad-ikon [data-icon-settings]")
        for group in ("lines", "collections"):
            appearance.locator(f'[data-appearance-icon-group="{group}"] > summary').tap()
        for width, height, columns in ((390, 844, 2), (820, 1080, 3), (1024, 768, 3), (1440, 900, 3)):
            page.set_viewport_size({"width": width, "height": height})
            layout = appearance.evaluate("""settings => {
                const columns = grid => {
                    const cards = [...grid.querySelectorAll('.icon-style-card')];
                    const firstTop = cards[0].getBoundingClientRect().top;
                    return cards.filter(card => Math.abs(card.getBoundingClientRect().top - firstTop) < 1).length;
                };
                const [lines, collections] = settings.querySelectorAll('.icon-style-grid');
                const container = settings.closest('.account-settings-columns');
                return {
                    panelInset: container.clientWidth - settings.clientWidth,
                    lineColumns: columns(lines), collectionColumns: columns(collections),
                    overflow: document.documentElement.scrollWidth - innerWidth
                };
            }""")
            assert 0 <= layout["panelInset"] <= 26 and layout["overflow"] == 0, (width, layout)
            assert layout["lineColumns"] == columns and layout["collectionColumns"] >= columns, (width, layout)
        page.set_viewport_size({"width": 390, "height": 844})
        appearance.locator('[data-appearance-section="buttons"] > summary').tap()
        dock = appearance.locator(".button-finish-preview-dock")
        expect(dock).to_be_hidden()
        appearance.locator('[data-appearance-button-group="upholstery"] > summary').tap()
        expect(dock).to_be_in_viewport(ratio=1)
        assert dock.evaluate("""dock => {
            const before = window.scrollY;
            const bottom = dock.getBoundingClientRect().bottom;
            window.scrollTo(0, before + 140);
            const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
            return window.scrollY >= before + 120 &&
                Math.abs(dock.getBoundingClientRect().bottom - bottom) <= 1 &&
                Math.abs(bottom - nav.top) <= 1;
        }""")
        assert dock.evaluate("""dock => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            return document.querySelector('.site-foot').getBoundingClientRect().bottom <=
                dock.getBoundingClientRect().top + 1;
        }""")
        appearance.locator('[data-appearance-button-group="upholstery"] > summary').tap()
        expect(dock).to_be_hidden()
        appearance.locator('[data-appearance-button-group="account-style"] > summary').tap()
        outline = appearance.get_by_role("button", name="Sama ramka")
        outline.tap()
        expect(outline).to_have_attribute("aria-pressed", "true")
        expect(page.locator("html")).to_have_attribute("data-account-buttons", "outline")
        expect(menu_group.locator(".account-menu-row").first).to_have_css("background-color", "rgba(0, 0, 0, 0)")
        expect(add_vehicle).to_have_css("background-color", "rgba(0, 0, 0, 0)")
        appearance.get_by_text("Same napisy", exact=True).tap()
        expect(menu_group.locator(".account-menu-icon").first).to_be_hidden()
        expect(page.locator(".account-identity-action > .ui-icon")).to_be_hidden()
        expect(add_vehicle.locator(".ui-icon")).to_be_hidden()
        appearance.get_by_text("Z ikonami i ramką", exact=True).tap()
        expect(menu_group.locator(".account-menu-icon").first).to_be_visible()
        expect(page.locator(".account-identity-action > .ui-icon")).to_be_visible()
        page.locator("#wyglad-ikon > summary").tap()
        page.locator("#dane-konta summary").tap()
        name = label(page, "Nazwa profilu")
        name.fill("")
        page.locator("#dane-konta summary").tap()
        page.locator("#kontakt-profilu summary").tap()
        save = button(page.locator("#kontakt-profilu"), "Zapisz ustawienia")
        save.tap()
        expect(name).to_be_visible()
        name.fill("Sprzedawca demo QA")
        label(page, "Miejscowość").fill("Kraków")
        label(page, "Numer telefonu").fill("błędny")
        page.locator("#preferencje-powiadomien summary").tap()
        page.get_by_role("switch", name="Nowe wiadomości").uncheck()
        save.tap()
        expect(page.locator("#kontakt-profilu [data-form-status]")).to_contain_text("prawidłowy numer")
        expect(label(page, "Miejscowość")).to_have_value("Kraków")
        label(page, "Numer telefonu").fill("")
        save.tap()
        expect(page.locator("#kontakt-profilu [data-form-status]")).to_have_text("Zapisano ustawienia.")
        expect(label(page, "Miejscowość")).to_have_value("Kraków")
        expect(page.get_by_role("switch", name="Nowe wiadomości")).not_to_be_checked()
        expect(page.get_by_role("switch", name="Status ogłoszeń")).to_be_checked()
        appearance_summary = page.locator("#wyglad-ikon > summary")
        themes = appearance.locator(".appearance-theme")
        appearance_summary.tap()
        themes.get_by_text("System", exact=True).tap()
        page.emulate_media(color_scheme="dark")
        expect(page.locator("html")).to_have_attribute("data-theme", "dark")
        expect(page.locator(".demo-bar")).to_have_css("background-color", "rgb(23, 45, 73)")
        expect(page.locator(".account-menu-copy small").first).to_have_css("color", "rgb(178, 193, 213)")
        expect(themes.locator(":checked+span")).to_have_css("color", "rgb(16, 40, 66)")
        expect(page.locator(".account-menu-row .account-menu-icon").first).to_be_visible()
        expect(themes.locator(".theme-swatch")).to_have_count(22)
        expect(page.locator(".bottom-nav .ui-icon").first).to_have_css("width", "44px")
        if OUTPUT:
            themes.scroll_into_view_if_needed()
            page.screenshot(path=str(Path(OUTPUT) / "account-settings-dark.png"))
        page.reload()
        appearance_summary.tap()
        expect(themes.get_by_role("radio", name="System")).to_be_checked()
        page.emulate_media(color_scheme="light")
        expect(page.locator("html")).to_have_attribute("data-theme", "light")
        expect(themes.locator(":checked+span")).to_have_css("color", "rgb(255, 255, 255)")
        for label, palette, background in (("Czarny", "black", "rgb(0, 0, 0)"),
                                           ("Grafitowy", "graphite", "rgb(32, 34, 37)"),
                                           ("Granatowy", "dark", "rgb(14, 25, 42)")):
            themes.get_by_text(label, exact=True).tap()
            expect(page.locator("html")).to_have_attribute("data-palette", palette)
            expect(page.locator("body")).to_have_css("background-color", background)
        themes.get_by_text("Czarny", exact=True).tap()
        page.reload()
        expect(page.locator("html")).to_have_attribute("data-palette", "black")
        page.locator("#rozmiar-tekstu summary").tap()
        page.get_by_text("Największy", exact=True).tap()
        expect(page.locator("html")).to_have_attribute("data-account-text-size", "extra")
        appearance_summary.tap()
        for width in (320, 360, 390, 768, 1440):
            page.set_viewport_size({"width":width,"height":844})
            nav_geometry(page, width)
            expect(menu_group).to_have_css("border-top-width", "0px")
            assert page.locator(".account-menu-row:visible").evaluate_all(
                """rows => rows.every(row => {
                    const bounds = row.getBoundingClientRect();
                    return bounds.height >= 44 && bounds.right <= innerWidth + 1;
                })"""
            )
            assert themes.locator(".settings-theme-options label>span").evaluate_all(
                "labels => labels.every(label => label.scrollWidth <= label.clientWidth + 1)"
            ), width
            if OUTPUT and width == 390:
                themes.scroll_into_view_if_needed()
                page.screenshot(path=str(Path(OUTPUT) / "account-settings-light-options.png"))
        page.set_viewport_size({"width":390,"height":844})
        demo_roles = page.locator("#role-demo")
        expect(button(demo_roles, "Wybierz rolę · Sprzedawca")).to_have_attribute("aria-current", "true")
        button(demo_roles, "Wybierz rolę · Dealer").tap()
        expect(page.locator("#ogloszenia").get_by_role("link", name=re.compile("^Panel dealera"))).to_be_visible()
        page.goto(base + "/demo/ustawienia?lang=en")
        expect(page.get_by_role("heading", name="App appearance")).to_be_visible()
        expect(page.locator("#logo-firmy > summary")).to_be_visible()
        expect(page.locator("#dokumenty").get_by_role("link", name="Privacy policy", exact=True)).to_be_visible()
        expect(page.locator("html")).to_have_attribute("data-account-text-size", "extra")
        appearance_summary.tap()
        expect(themes.get_by_role("radio", name="Black")).to_be_checked()
        themes.get_by_text("Navy", exact=True).tap()
        expect(page.locator("html")).to_have_attribute("data-theme", "dark")
        themes.get_by_text("White", exact=True).tap()
        expect(page.locator("html")).to_have_attribute("data-theme", "light")
        page.goto(base + "/demo/ustawienia?lang=en#dane-konta")
        expect(label(page, "Display name")).to_be_visible()
    print("All account and settings groups visible on load, direct links, role switching, profile validation and saved preferences")


def language_options(browser, base):
    names = ("Polski", "English", "Čeština", "Slovenčina", "Deutsch", "Українська")
    languages = (
        ("cs", "Čeština", "Vozidla na prodej", "Všechny značky", "Všechny modely"),
        ("sk", "Slovenčina", "Vozidlá na predaj", "Všetky značky", "Všetky modely"),
        ("de", "Deutsch", "Fahrzeuge zum Verkauf", "Alle Marken", "Alle Modelle"),
        ("uk", "Українська", "Транспорт на продаж", "Усі марки", "Усі моделі"),
    )
    with browser.new_context(viewport={"width": 1440, "height": 940}) as context:
        page = context.new_page()
        page.goto(base + "/demo/szukaj?type=car&maxPrice=85000#main")
        dialog = page.locator("#language-picker")
        desktop_trigger = page.locator(".side-nav [data-language-open]")
        for code, name, heading, makes, models in languages:
            open_profile(page)
            desktop_trigger.click()
            expect(dialog.locator(".language-option span:nth-child(2)")).to_have_text(list(names))
            dialog.get_by_role("link", name=name, exact=True).click()
            expect(page.locator("html")).to_have_attribute("lang", code)
            expect(page.get_by_role("heading", name=heading, exact=True)).to_be_visible()
            parsed = urlsplit(page.url)
            assert parse_qs(parsed.query) == {"type": ["car"], "maxPrice": ["85000"], "lang": [code]}
            assert parsed.fragment == "main"
            page.reload()
            expect(page.locator("html")).to_have_attribute("lang", code)
            page.goto(base + "/demo/szukaj")
            expect(page.get_by_role("heading", name=heading, exact=True)).to_be_visible()
            filters = page.locator("[data-search-form]")
            filters.locator("[data-filter-type]").select_option("motorcycle")
            brand = filters.locator("[data-filter-make]")
            expect(brand.locator("option[value='']")).to_have_text(makes)
            brand.select_option("Yamaha")
            model = filters.locator("[data-filter-model]")
            expect(model.locator("option[value='']")).to_have_text(models)
            expect(model.locator("option[value='MT-07']")).to_be_attached()
            page.goto(base + "/demo/szukaj?type=car&maxPrice=85000#main")
        page.set_viewport_size({"width": 360, "height": 800})
        for code, _, _, _, _ in languages:
            page.goto(base + "/demo?lang=" + code)
            nav_geometry(page, 360)
        page.goto(base + "/demo/oferta/przyklad-25?lang=de")
        mobile_trigger = page.locator(".head-actions [data-language-open]")
        mobile_trigger.click()
        expect(dialog.get_by_role("link", name="Deutsch")).to_have_attribute("aria-current", "true")
        page.keyboard.press("Escape")
        expect(mobile_trigger).to_be_focused()
        mobile_trigger.click()
        dialog.get_by_role("link", name="Українська").click()
        expect(page.locator("html")).to_have_attribute("lang", "uk")
        expect(page.locator("#listing-title")).to_have_text("Lamborghini Huracán")
        nav_geometry(page, 360)
        description = page.locator(".offer-section").first
        description.locator("summary").click()
        expect(description.locator(".prose")).to_contain_text("Чорний Huracán EVO")
        if OUTPUT:
            mobile_trigger.click()
            page.screenshot(path=str(Path(OUTPUT) / "language-picker-mobile.png"))
    print("Six native labels, four new languages, persisted choice, localized filter updates, mobile fit and focus")


def check_side_caption(page, item, docked_icon_x):
    caption = item.locator(":scope > span:not(.count)")
    expect(caption).to_have_css("opacity", "1")
    expect(caption).to_have_css("clip-path", "inset(0px)")
    page.wait_for_function("""([item, dockedX]) => {
      const nav = item.closest('.side-nav');
      const panel = nav.getBoundingClientRect();
      const icon = item.querySelector('.ui-icon').getBoundingClientRect();
      const caption = item.querySelector('span:not(.count)');
      const labels = [...nav.querySelectorAll(':is(a,button,summary) > span:not(.count)')].filter(label => label.offsetWidth);
      const expanded = nav.hasAttribute('data-side-open');
      const shown = expanded ? labels : [caption];
      const widest = Math.ceil(Math.max(...shown.map(label => label.getBoundingClientRect().width)));
      const style = getComputedStyle(nav);
      const rowLeft = panel.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
      const rowRight = panel.right - parseFloat(style.paddingRight);
      const slot = parseFloat(style.getPropertyValue('--rail-slot'));
      const same = (a, b) => Math.abs(a - b) < 1;
      const inColumns = labels.every(label => {
        const row = label.parentElement;
        const mark = [...row.querySelectorAll(':scope > .ui-icon')].find(svg => svg.getBoundingClientRect().width);
        const rowBox = row.getBoundingClientRect();
        const iconBox = mark.getBoundingClientRect();
        const words = document.createRange();
        words.selectNodeContents(label);
        const text = words.getBoundingClientRect();
        return same(rowBox.left, rowLeft) && same(rowBox.right, rowRight)
          && same(iconBox.left, rowLeft + (slot - iconBox.width) / 2)
          && same(text.left, rowLeft + slot + parseFloat(style.getPropertyValue('--rail-label-gap')))
          && (!expanded && label !== caption || text.right <= rowRight + 1);
      });
      const surface = document.elementFromPoint(panel.left + 3, panel.top + panel.height / 2);
      return same(panel.width, 56 + widest) && same(dockedX - icon.left, widest) && inColumns
        && getComputedStyle(caption).backgroundColor === 'rgba(0, 0, 0, 0)'
        && nav.contains(surface);
    }""", arg=[item.element_handle(), docked_icon_x])


def side_navigation(page, base):
    page.emulate_media(reduced_motion="no-preference")
    page.evaluate("""() => {
      localStorage.setItem('a4-icon-style', 'classic');
      localStorage.setItem('a4-theme', 'light');
    }""")
    page.goto(base + "/demo/oferta/przyklad-1")
    page.mouse.move(30, 30)
    rail = page.locator(".side-nav")
    expect(rail).to_be_hidden()
    open_profile(page)
    toggle = rail.locator("[data-side-toggle]")
    categories = rail.get_by_role("link", name="Kategorie", exact=True)
    captions = rail.locator("a > span:not(.count), button:visible > span:not(.count), .side-theme-picker > summary > span")
    expect(toggle).to_have_attribute("aria-expanded", "false")
    expect(rail).to_have_css("width", "56px")
    expect(rail).to_have_css("backdrop-filter", "blur(16px) saturate(0.75)")
    expect(rail).to_have_css("background-color", "rgb(255, 255, 255)")
    expect(categories.locator("span")).to_have_css("opacity", "0")
    expect(categories.locator("span")).to_have_css("clip-path", "inset(0px 100% 0px 0px)")
    assert rail.locator("a > svg:visible, button > svg:visible, .side-theme-picker > summary > svg:visible").evaluate_all("""icons => icons.length === 21
        && new Set(icons.map(icon => icon.innerHTML)).size === icons.length
        && icons.every(icon => icon.getAttribute('aria-hidden') === 'true'
            && icon.getBoundingClientRect().width === 40
            && icon.getBoundingClientRect().left >= icon.closest('nav').getBoundingClientRect().left
            && icon.getBoundingClientRect().right <= icon.closest('nav').getBoundingClientRect().right
            && parseFloat(getComputedStyle(icon.querySelector('g')).strokeWidth) === 1.25)""")
    assert rail.locator(".side-sell > svg").get_attribute("data-icon-name") == "listing"
    assert rail.locator("[data-icon-style-open] > svg").get_attribute("data-icon-name") == "side-appearance"
    assert rail.get_by_role("link", name="Porównywarka", exact=True).locator("svg").get_attribute("data-icon-name") == "scale"
    expect(toggle.locator(".side-panel-arrow")).to_have_css("transform", "none")
    expect(rail).to_have_attribute("data-side-ready", "")
    icon = categories.locator("svg")
    icon_box = icon.bounding_box()
    search = rail.get_by_role("link", name="Szukaj", exact=True)
    search_x = search.locator("svg").bounding_box()["x"]
    categories.hover()
    expect(toggle).to_have_attribute("aria-expanded", "false")
    expect(rail).to_have_css("backdrop-filter", "blur(16px) saturate(0.75)")
    check_side_caption(page, categories, icon_box["x"])
    caption = categories.locator("span")
    assert caption.evaluate("""label => {
      const slideDelay = parseFloat(getComputedStyle(label.parentElement).transitionDelay);
      return getComputedStyle(label).transitionDelay.split(',').every(delay => parseFloat(delay) > slideDelay);
    }""")
    caption.hover()
    expect(caption).to_have_css("opacity", "1")
    assert captions.evaluate_all("labels => labels.filter(label => getComputedStyle(label).opacity === '1').length === 1")
    assert categories.evaluate("""item => {
      const tile = getComputedStyle(item, '::after');
      return tile.content === 'none' && tile.boxShadow === 'none';
    }""")
    toggle.click()
    expect(toggle).to_have_attribute("aria-expanded", "true")
    check_side_caption(page, search, search_x)
    expect(toggle.locator(".side-panel-arrow")).not_to_have_css("transform", "none")
    assert page.locator(".gallery-controls").evaluate("controls => controls.getBoundingClientRect().right <= document.querySelector('.side-nav').getBoundingClientRect().left")
    expect(rail.get_by_role("link", name="Szukaj", exact=True).locator("span")).to_have_css("opacity", "1")
    assert captions.evaluate_all("labels => labels.every(label => getComputedStyle(label).opacity === '1')")
    assert rail.get_by_role("link").count() == 16
    assert rail.locator(".side-nav-group").count() == 4
    if OUTPUT:
        page.screenshot(path=str(Path(OUTPUT) / "detail-menu-open.png"))
    toggle.click()
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_function("""item => matchMedia('(prefers-reduced-motion: reduce)').matches
      && getComputedStyle(item, '::after').transform === 'none'""", arg=categories.element_handle())
    page.mouse.move(30, 30)
    expect(rail).to_have_css("width", "56px")
    page.keyboard.press("Escape")
    profile = page.locator(".head-profile")
    expect(profile).to_be_focused()
    page.keyboard.press("Enter")
    expect(toggle).to_be_focused()
    expect(toggle).to_have_attribute("aria-expanded", "false")
    page.keyboard.press("Tab")
    expect(rail.get_by_role("link", name="Zainstaluj aplikację", exact=True)).to_be_focused()
    expect(rail.get_by_role("link", name="Zainstaluj aplikację", exact=True).locator("span")).to_have_css("opacity", "1")
    expect(toggle).to_have_attribute("aria-expanded", "false")
    page.goto(base + "/demo/szukaj")
    open_profile(page)
    active = rail.get_by_role("link", name="Szukaj", exact=True)
    expect(active).to_have_attribute("aria-current", "page")
    theme = rail.locator("[data-side-theme-picker]")
    expect(theme.get_by_role("radiogroup")).to_be_hidden()
    theme.locator("summary").click()
    expect(theme.get_by_role("radiogroup", name="Tło strony")).to_be_visible()
    expect(theme.get_by_role("radio")).to_have_count(22)
    expect(theme.get_by_role("radio", name="Biały")).to_be_checked()
    page.mouse.move(30, 30)
    expect(toggle).to_have_attribute("aria-expanded", "true")
    expect(active).to_have_css("background-color", "rgba(0, 0, 0, 0)")
    expect(active.locator(".ui-icon-glyph")).to_have_css("stroke", "rgb(39, 56, 77)")
    theme.get_by_text("Granatowy", exact=True).click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    expect(rail).to_have_css("color", "rgb(23, 35, 51)")
    expect(rail).to_have_css("background-color", "rgb(255, 255, 255)")
    expect(active).to_have_css("background-color", "rgba(0, 0, 0, 0)")
    expect(active.locator(".ui-icon-glyph")).to_have_css("stroke", "rgb(39, 56, 77)")
    theme.get_by_text("Karbon Twill", exact=True).click()
    expect(page.locator("html")).to_have_attribute("data-palette", "carbon-twill")
    assert rail.evaluate("""nav => getComputedStyle(nav).backgroundImage !== 'none'
      && getComputedStyle(nav).backgroundColor !== 'rgba(0, 0, 0, 0)'
      && getComputedStyle(nav.querySelector('.side-nav-group-title')).backgroundColor === 'rgba(0, 0, 0, 0)'""")
    page.keyboard.press("Escape")
    expect(toggle).to_have_attribute("aria-expanded", "false")
    expect(theme.get_by_role("radiogroup")).to_be_hidden()
    page.goto(base + "/demo/oferta/przyklad-1")
    expect(page.locator("html")).to_have_attribute("data-palette", "carbon-twill")
    open_profile(page)
    theme.locator("summary").click()
    expect(theme.get_by_role("radio", name="Karbon Twill")).to_be_checked()
    theme.get_by_text("Biały", exact=True).click()
    expect(page.locator("html")).to_have_attribute("data-theme", "light")
    print("Desktop right menu: palette choice and persistence, active page, hover, keyboard and reduced motion")


def side_navigation_sound(browser, base):
    with browser.new_context(viewport={"width":1440,"height":940}) as context:
        page = context.new_page()
        page.add_init_script("""(() => {
          window.notes = 0;
          const create = AudioContext.prototype.createOscillator;
          AudioContext.prototype.createOscillator = function () {
            const tone = create.call(this);
            const start = tone.start.bind(tone);
            tone.start = (...args) => { window.notes++; return start(...args); };
            return tone;
          };
        })()""")
        page.goto(base + "/demo/oferta/przyklad-25")
        rail = page.locator(".side-nav")
        categories = rail.get_by_role("link", name="Kategorie", exact=True)
        sound = button(rail, "Dźwięk menu")
        assert page.evaluate("window.notes") == 0
        open_profile(page)
        categories.hover()
        page.wait_for_function("window.notes > 0")
        sound.click()
        expect(sound).to_have_attribute("aria-pressed", "false")
        open_profile(page)
        notes = page.evaluate("window.notes")
        categories.hover()
        assert page.evaluate("window.notes") == notes
        page.reload()
        open_profile(page)
        expect(sound).to_have_attribute("aria-pressed", "false")
        sound.click()
        open_profile(page)
        expect(sound).to_have_attribute("aria-pressed", "true")
        categories.hover()
        page.wait_for_function("window.notes > 0")
    print("Desktop hover sound starts after interaction and respects persistent mute")


def compact_profile_navigation(browser, base):
    with browser.new_context(viewport={"width": 768, "height": 1024}, has_touch=True,
                             is_mobile=True, reduced_motion="reduce") as context:
        page = context.new_page()
        page.goto(base + "/demo/oferta/przyklad-1")
        menu = page.locator("[data-side-nav]")
        profile = page.locator(".bottom-nav [data-profile-menu-toggle]")
        expand = menu.locator("[data-side-toggle]")
        for width, height in ((390, 844), (844, 390), (768, 1024), (1024, 1366)):
            page.set_viewport_size({"width": width, "height": height})
            expect(menu).to_be_hidden()
            profile.tap()
            expect(profile).to_have_attribute("aria-expanded", "true")
            expect(expand).to_be_focused()
            expect(menu).to_have_css("width", "56px")
            services = menu.get_by_role("link", name="Usługi motoryzacyjne", exact=True)
            icon_box = services.locator("svg").bounding_box()
            services.tap()
            check_side_caption(page, services, icon_box["x"])
            expect(menu.get_by_role("link", name="Start", exact=True).locator("span")).to_have_css("opacity", "0")
            expand.tap()
            expect(expand).to_have_attribute("aria-expanded", "true")
            check_side_caption(page, services, icon_box["x"])
            panel = menu.locator(".side-nav-panel")
            assert panel.evaluate("el => el.scrollTop === 0 && el.scrollWidth <= el.clientWidth")
            last = menu.locator(".side-mode")
            last.scroll_into_view_if_needed()
            assert last.evaluate("""el => {
                const r = el.getBoundingClientRect();
                const bar = document.querySelector('.bottom-nav').getBoundingClientRect();
                return r.bottom <= bar.top && el.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2));
            }""")
            profile.tap()
            expect(menu).to_be_hidden()
            expect(profile).to_be_focused()
        profile.tap()
        page.set_viewport_size({"width": 1366, "height": 1024})
        expect(menu).to_have_css("width", "56px")
        expect(expand).to_have_attribute("aria-expanded", "false")
        expect(profile).to_be_hidden()
        page.set_viewport_size({"width": 1024, "height": 1366})
        expect(menu).to_be_hidden()
        profile.tap()
        help_link = menu.get_by_role("link", name="Pomoc i FAQ", exact=True)
        help_link.tap()
        expect(help_link.locator("span")).to_have_css("opacity", "1")
        help_link.locator("span").tap()
        expect(page).to_have_url(base + "/demo/pomoc")
        expect(menu).to_be_hidden()


def landscape_tablet_navigation(browser, base):
    with browser.new_context(viewport={"width": 1024, "height": 768}, has_touch=True, is_mobile=True,
                             reduced_motion="reduce") as context:
        page = context.new_page()
        page.goto(base + "/demo")
        rail = page.locator(".side-nav")
        toggle = rail.locator("[data-side-toggle]")
        categories = rail.get_by_role("link", name="Kategorie", exact=True)
        install = rail.get_by_role("link", name="Zainstaluj aplikację", exact=True)
        settings = rail.get_by_role("link", name="Ustawienia konta", exact=True)
        for width, height in ((820, 540), (1024, 768), (1180, 820), (1366, 1024)):
            page.set_viewport_size({"width": width, "height": height})
            expect(page.locator(".bottom-nav")).to_be_hidden()
            expect(rail).to_be_hidden()
            open_profile(page)
            expect(rail).to_have_css("width", "56px")
            expect(rail.locator("[data-side-theme-picker]")).to_be_hidden()
            expect(rail.locator("[data-theme-toggle]")).to_be_visible()
            expect(toggle.locator("span")).to_have_css("opacity", "0")
            icon_x = categories.locator("svg").bounding_box()["x"]
            toggle.tap()
            expect(toggle).to_have_attribute("aria-expanded", "true")
            check_side_caption(page, categories, icon_x)
            if height < 900:
                assert rail.locator(".side-nav-links").evaluate("list => list.scrollHeight > list.clientHeight")
            rail.get_by_role("link", name="Pomoc i FAQ", exact=True).scroll_into_view_if_needed()
            expect(install).to_be_in_viewport(ratio=1)
            expect(settings).to_be_in_viewport(ratio=1)
            page.locator("h1").tap()
            expect(toggle).to_have_attribute("aria-expanded", "false")
        open_profile(page)
        toggle.tap()
        categories.tap()
        expect(page).to_have_url(base + "/demo#kategorie")
        expect(toggle).to_have_attribute("aria-expanded", "false")
        open_profile(page)
        toggle.tap()
        toggle.tap()
        expect(toggle).to_have_attribute("aria-expanded", "false")
        toggle.tap()
        expect(toggle).to_have_attribute("aria-expanded", "true")
        page.set_viewport_size({"width": 768, "height": 1024})
        expect(rail).to_be_hidden()
        expect(page.locator(".bottom-nav")).to_be_visible()
        page.set_viewport_size({"width": 1024, "height": 768})
        expect(toggle).to_have_attribute("aria-expanded", "false")
        open_profile(page)
        install.tap()
        install.locator("span").tap()
        expect(page.get_by_role("heading", name="Zainstaluj aplikację", exact=True)).to_be_visible()
        expect(page.get_by_role("heading", name="Komputer", exact=True)).to_be_visible()
        open_profile(page)
        expect(install).to_have_attribute("aria-current", "page")
        settings.tap()
        settings.locator("span").tap()
        expect(page).to_have_url(base + "/demo/zaloguj?dalej=%2Fdemo%2Fustawienia")
        button(page, "Wybierz rolę · Dealer").tap()
        expect(page.get_by_role("heading", name="Ustawienia konta", exact=True)).to_be_visible()
        open_profile(page)
        expect(settings).to_have_attribute("aria-current", "page")
        expect(rail.locator("[aria-current=page]")).to_have_count(1)
        expect(rail.get_by_role("link", name="Panel dealera", exact=True)).to_have_attribute("href", "/demo/panel-dealera")
        expect(rail.get_by_role("link", name="Moje ogłoszenia", exact=True)).to_have_attribute("href", "/demo/moje-ogloszenia")
        expect(rail.get_by_role("link", name="Administracja", exact=True)).to_have_count(0)
        toggle.tap()
        rail.get_by_role("link", name="Rozmiar tekstu", exact=True).tap()
        expect(page.locator("#rozmiar-tekstu")).to_have_attribute("open", "")
        open_profile(page)
        toggle.tap()
        button(rail, "Wyloguj się").tap()
        expect(page).to_have_url(base + "/demo/")
        expect(rail.get_by_role("link", name="Panel dealera", exact=True)).to_have_count(0)
    print("Tablet side menu: touch, scrolling shortcuts, rotation, install, login return, settings and dealer access")


def category_directory(page, prefix):
    directory = page.locator("#kategorie")
    home_url = page.url
    page.evaluate("document.fonts.ready")
    bodies = {
        "car": "hatchback sedan liftback wagon minivan van crossover suv suv_coupe offroad raised_wagon pickup coupe fastback shooting_brake convertible roadster targa stretch_limo other",
        "truck": "tractor rigid_truck dump_truck box_truck refrigerated_truck flatbed_truck tanker_truck concrete_mixer truck_hooklift truck_curtain timber_truck truck_loader_crane",
        "camper": "camper_overcab camper_low_profile camper_integrated camper_van camper",
        "motorcycle": "naked sportbike touring cruiser adventure enduro classic supermoto chopper scrambler minibike",
        "van": "panel van_crew van_dropside van_curtain van_box van_fridge van_tipper van_transporter van_chassis",
        "scooter": "scooter maxiscooter moped three_wheel_scooter", "quad": "atv_utility atv_sport atv_youth",
        "utv": "utv buggy", "kart": "track_kart offroad_kart", "snowmobile": "snow_touring snow_sport snow_utility snow_mountain",
        "bus": "city_bus coach minibus intercity_bus double_decker", "trailer": "cargo_trailer flatbed_trailer motorcycle_trailer horse_trailer boat_trailer refrigerated_trailer box_trailer plant_trailer tipper_trailer travel_trailer bale_trailer livestock_trailer catering_trailer semi_trailer semi_curtain semi_refrigerated semi_tipper semi_container semi_lowbed semi_tanker other",
        "garden": "garden_mower riding_mower zero_turn garden_tractor snow_blower wood_chipper stump_grinder motorized_wheelbarrow mini_dumper",
        "farm": "farm_tractor combine forage_harvester beet_harvester baler sprayer seed_drill disc_harrow farm_plough fertilizer_spreader farm_mower farm_machine",
        "construction": "excavator mini_excavator backhoe loader skid_steer bulldozer roller crane grader paver articulated_dumper drilling_rig mobile_crusher",
        "industrial": "forklift electric_pallet_truck telehandler aerial_platform scissor_lift industrial_cart reach_truck order_picker warehouse_tug",
        "special": "tow_truck ambulance fire_engine service_vehicle municipal road_sweeper refuse_truck snow_plow vacuum_truck",
        "other": "microcar trike tuk_tuk cargo_tricycle mobility_scooter e_bike e_scooter golf_cart",
    }
    families = directory.locator("a.catalog-type-tile[data-vehicle-type]")
    sections = directory.locator(":scope > section[data-catalog-type]")
    assert sections.evaluate_all("items => items.map(item => item.dataset.catalogType)") == list(bodies)
    assert families.evaluate_all("items => items.map(item => item.dataset.vehicleType)") == list(bodies)
    expect(directory.locator("#odmiany-rekreacyjne")).to_have_count(1)
    expect(directory.locator("#odmiany-transportu")).to_have_count(1)
    expect(directory.locator('a#samochody-osobowe[data-vehicle-type="car"]')).to_have_count(1)
    variants = directory.locator("a.category-variant[data-vehicle-filter]")
    variant_count = sum(len(names.split()) for names in bodies.values())
    expect(directory.locator("a.category-variant:visible")).to_have_count(variant_count)
    expect(page.locator(".home-content > .robot-entry-banner:last-child")).to_have_count(1)
    shortcuts = page.locator("#filtry-pojazdow [data-filter-shortcut]").evaluate_all(
        "items => items.map(button => button.dataset.filterShortcut + '=' + button.value)")
    assert shortcuts == ["condition=new", "condition=used"] + [
        "fuel=" + key for key in ("petrol", "diesel", "lpg", "hybrid", "plugin", "electric", "other")
    ]
    expect(directory.locator("a.catalog-type-tile:visible")).to_have_count(18)
    assert sections.evaluate_all("""groups => groups.every(section => {
      const head = section.querySelector('h3 a').getBoundingClientRect();
      const grid = section.querySelector('.home-vehicle-variants').getBoundingClientRect();
      const rows = new Map();
      for (const tile of section.querySelectorAll('.category-variant')) {
        const rect = tile.getBoundingClientRect(), key = Math.round(rect.top);
        const row = rows.get(key) || [];
        row.push(rect);
        rows.set(key, row);
      }
      return Math.abs(grid.left-head.left)<1 && Math.abs(grid.right-head.right)<1 && grid.top>=head.bottom
        && [...rows.values()].every(row => Math.abs(row[0].left-grid.left)<1 && Math.abs(row.at(-1).right-grid.right)<1);
    })"""), page.viewport_size

    def check_tiles(locator):
        missing_images = locator.evaluate_all("""async tiles => {
          const results = await Promise.all(tiles.map(async tile => {
            const img = tile.querySelector('img');
            if (img) {
              img.loading = 'eager';
              try {
                await img.decode();
                if (img.naturalWidth && img.naturalHeight) return null;
              } catch {}
            }
            return tile.getAttribute('href');
          }));
          return results.filter(Boolean);
        }""")
        assert not missing_images, missing_images
        clipped = locator.evaluate_all(r"""tiles => tiles.flatMap(tile => {
          const card = tile.getBoundingClientRect();
          const image = tile.querySelector('img').getBoundingClientRect();
          const caption = tile.querySelector('strong');
          const content = caption.querySelector('span') || caption;
          const label = caption.getBoundingClientRect();
          const text = content.firstChild;
          const range = document.createRange();
          const wordsFit = [...text.textContent.matchAll(/[^ \t\r\n-]+/g)].every(match => {
            range.setStart(text, match.index);
            range.setEnd(text, match.index + match[0].length);
            const rects = [...range.getClientRects()].filter(rect => rect.width > 0);
            return new Set(rects.map(rect => Math.round(rect.top))).size === 1
              && rects.every(rect => rect.left >= label.left - 1 && rect.right <= label.right + 1);
          });
          return card.left >= -1 && card.right <= innerWidth + 1 && card.width > 0 && card.height > 0
              && wordsFit && image.height >= (tile.matches('.catalog-type-tile') ? 44 : 75)
              && (image.bottom <= label.top + 1 || image.right <= label.left + 1) ? [] : [text.textContent];
        })""")
        assert not clipped, (page.viewport_size, clipped)

    check_tiles(families)
    check_tiles(variants)
    all_links = set()
    for kind, names in bodies.items():
        category = directory.locator(f'a.catalog-type-tile[data-vehicle-type="{kind}"]')
        destination = prefix + "/szukaj?type=" + kind
        expect(category).to_have_attribute("href", destination)
        all_links.add(destination)
        group = directory.locator(f'section[data-catalog-type="{kind}"]')
        expect(group.locator("h3 a.catalog-type-tile")).to_have_attribute("href", destination)
        tiles = group.locator('a.category-variant')
        urls = tiles.evaluate_all("items => items.map(link => link.getAttribute('href'))")
        assert [parse_qs(urlsplit(url).query) for url in urls] == [
            {"type": [kind], "body": [body]} for body in names.split()
        ]
        assert not all_links.intersection(urls)
        all_links.update(urls)
        if kind in ("car", "trailer"):
            assert tiles.evaluate_all("items => new Set(items.map(item => item.querySelector('img').src)).size === items.length")
        if kind == "trailer":
            expect(group.locator('a[href$="&body=other"] img')).to_have_attribute("src", "/assets/category-body-other-trailers.webp")
            expect(directory.locator('a[href*="body=semi_trailer"] img')).to_have_css("transform", "matrix(-1, 0, 0, 1, 0, 0)")
    assert len(all_links) == len(bodies) + variant_count
    page.goto(home_url)


def device_views(browser, base):
    with browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True) as context:
        page = context.new_page()
        page.goto(base + "/demo")
        page.get_by_role("link", name="Dodaj aplikację", exact=True).tap()
        expect(page).to_have_url(base + "/demo/aplikacja")
        expect(page.get_by_role("heading", name="Zainstaluj aplikację")).to_be_visible()
        expect(page.get_by_text("Otwórz jako aplikację internetową", exact=True)).to_be_visible()
        expect(page.get_by_role("heading", name="Android")).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
        page.evaluate("navigator.serviceWorker.ready.then(registration => registration.scope)")
        cdp = context.new_cdp_session(page)
        for prefix, start in (("/demo", "/demo"), ("", "/")):
            page.goto(base + prefix + "/aplikacja")
            manifest = page.locator('link[rel="manifest"]')
            expect(manifest).to_have_attribute("href", prefix + "/manifest.webmanifest?lang=pl")
            response = page.request.get(base + manifest.get_attribute("href"))
            assert response.ok
            data = response.json()
            assert data["id"] == (prefix or "/") and data["scope"] == (prefix or "/")
            assert data["start_url"] == start and data["display"] == "standalone"
            assert data["name"] == ("BRUMBRUM.VIN Demo" if prefix else "BRUMBRUM.VIN")
            assert data["shortcuts"][0]["url"] == prefix + "/szukaj"
            assert cdp.send("Page.getInstallabilityErrors")["installabilityErrors"] == []
        install = page.locator("[data-install]")
        page.evaluate("""() => {
          const event = new Event('beforeinstallprompt', {cancelable:true});
          event.prompt = async () => { window.installPromptOpened = true; };
          event.userChoice = Promise.resolve({outcome:'dismissed'});
          window.dispatchEvent(event);
        }""")
        install.tap()
        assert page.evaluate("window.installPromptOpened")
        expect(install).to_be_hidden()
        expect(page.get_by_role("status").filter(has_text="Instalacja została anulowana")).to_be_visible()
        page.evaluate("window.dispatchEvent(new Event('appinstalled'))")
        expect(page.get_by_role("status").filter(has_text="Aplikacja jest zainstalowana")).to_be_visible()
        page.goto(base + "/demo/aplikacja")
        if OUTPUT:
            page.screenshot(path=str(Path(OUTPUT) / "app-install-mobile.png"), full_page=True)
        page.get_by_role("link", name="Otwórz widok na zegarek").tap()
        for width in (192, 224, 240):
            page.set_viewport_size({"width":width,"height":width})
            page.reload()
            expect(page.locator(".watch-list li")).to_have_count(6)
            expect(page.locator(".watch-demo")).to_be_visible()
            assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
            assert page.locator("main a").evaluate_all("links => links.every(a => a.getBoundingClientRect().height >= 44)")
        if OUTPUT:
            page.screenshot(path=str(Path(OUTPUT) / "watch-240.png"))
        offer = page.locator(".watch-list li a").first
        offer_name = offer.locator("strong").inner_text()
        offer.tap()
        expect(page.get_by_role("heading", name=offer_name, exact=True)).to_be_visible()
        expect(page.get_by_role("link", name="Pełne ogłoszenie")).to_have_attribute("href", re.compile(r"^/demo/oferta/"))
        page.get_by_role("link", name="Wróć do listy").tap()
        page.get_by_role("link", name="Ulubione").tap()
        expect(page.get_by_role("link", name="Zaloguj się")).to_have_attribute("href", "/demo/zaloguj?dalej=%2Fdemo%2Fzegarek%3Fwidok%3Dulubione")
        page.set_viewport_size({"width":390,"height":844})
        page.get_by_role("link", name="Zaloguj się").tap()
        button(page, "Wybierz rolę · Kupujący").tap()
        expect(page).to_have_url(base + "/demo/zegarek?widok=ulubione")
        expect(page.get_by_text("Nie masz zapisanych ofert.")).to_be_visible()
        page.goto(base + "/demo/oferta/przyklad-1")
        favorite = page.locator(".showcase-photo-actions [data-favorite]")
        with page.expect_response(re.compile(r"/demo/api/favorites$")) as saved:
            favorite.tap()
        assert saved.value.ok
        expect(favorite).to_have_attribute("aria-pressed", "true")
        page.goto(base + "/demo/zegarek?widok=ulubione")
        expect(page.locator(".watch-list")).to_contain_text("Audi A4")
        expect(page.locator(".watch-list li")).to_have_count(1)
        page.reload()
        expect(page.locator(".watch-list")).to_contain_text("Audi A4")
        page.goto(base + "/demo/aplikacja?lang=en")
        expect(page.get_by_role("heading", name="Install the app", exact=True)).to_be_visible()
        expect(page.get_by_role("heading", name="iPhone and iPad")).to_be_visible()
    print("Installable phone PWA, separate live and demo launches, compact watch listings and persistent account favorites")


def reel_geometry(page, width):
    stats = page.locator(".search-main [data-reel-track]").evaluate("""track => {
      const wrapper = track.closest('.wrap').getBoundingClientRect();
      const viewport = track.getBoundingClientRect();
      const card = track.firstElementChild.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(track).columnGap);
      const rail = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--side-rail'));
      return {width: track.clientWidth, card: card.width, gap, left: wrapper.left,
        overflow: track.scrollWidth - track.clientWidth,
        rows: new Set([...track.children].map(item => item.offsetTop)).size,
        right: innerWidth - wrapper.right - rail, inBounds: card.left >= viewport.left && card.right <= viewport.right + 1};
    }""")
    max_columns = sum(stats["width"] >= breakpoint for breakpoint in (0, 600, 900, 1260, 1600, 1980))
    assert stats["inBounds"] and stats["left"] <= 30 and stats["right"] <= 30, (width, stats)
    assert abs(stats["card"] - (stats["width"] - (max_columns - 1) * stats["gap"]) / max_columns) < 1.5, (width, stats)
    assert stats["overflow"] == 0 and stats["rows"] == (DEMO_LISTINGS + max_columns - 1) // max_columns, (width, stats)


def single_result_geometry(page):
    card = page.locator('[data-search-results] [data-reel-size="1"] .offer-card')
    assert card.evaluate("""card => {
        const box = element => element.getBoundingClientRect();
        const image = card.querySelector('.offer-image img');
        const frame = box(card.querySelector('.offer-image'));
        const panel = box(card.querySelector('.offer-info'));
        const horizontal = card.closest('[data-reel]').clientWidth >= 690;
        if (!horizontal) return frame.bottom <= panel.top + 1 && frame.height > 0 && panel.height > 0;
        return Math.abs(panel.top - frame.top) < 1 && Math.abs(panel.bottom - frame.bottom) < 1
          && Math.abs(box(image).height - frame.height) < 1 && Math.abs(box(image).width - frame.width) < 1
          && getComputedStyle(image).objectFit === 'cover' && Math.abs(panel.left - frame.right) < 1;
    }"""), page.viewport_size


def detail_geometry(page, width, name="Audi A4", cover="01"):
    panel = page.locator(".showcase-copy")
    expect(panel.get_by_role("heading", name=name, exact=True)).to_be_visible()
    expect(panel.get_by_text("Opis sprzedawcy", exact=True)).to_have_count(0)
    description = page.locator(".offer-section").first
    expect(description.locator("summary")).to_have_text("Opis sprzedawcy")
    expect(description.locator(".prose")).to_be_hidden()
    expect(panel.locator(".facts-grid dt")).to_have_count(4)
    expect(page.locator(".detail-main details[open]")).to_have_count(0)
    expect(panel.get_by_role("link", name="Napisz wiadomość")).to_be_visible()
    expect(panel.get_by_role("link", name="Umów oględziny")).to_be_visible()
    if width <= 700:
        actions = page.locator(".showcase-photo-actions")
        expect(button(actions, "Udostępnij ogłoszenie")).to_be_visible()
        expect(panel.locator(".detail-tools")).to_be_hidden()
    else:
        expect(button(panel, "Udostępnij")).to_be_visible()
    expect(page.locator("[data-gallery-image]")).to_have_attribute("src", f"/assets/showcase-hd/{cover}-front.webp")
    page.wait_for_function("() => { const image = document.querySelector('[data-gallery-image]'); return image.naturalWidth === 1920 && image.naturalHeight === 1080; }")
    expect(page.locator(".gallery-thumbs [data-thumb]")).to_have_count(3)
    stats = page.locator(".listing-showcase").evaluate("""hero => {
      const stage = hero.getBoundingClientRect();
      const photo = hero.querySelector('.gallery-main').getBoundingClientRect();
      const copy = hero.querySelector('.showcase-copy').getBoundingClientRect();
      const controls = hero.querySelector('.gallery-controls').getBoundingClientRect();
      const thumbnails = hero.querySelector('.gallery-thumbs').getBoundingClientRect();
      const thumb = hero.querySelector('.gallery-thumbs img').getBoundingClientRect();
      const prev = hero.querySelector('.gallery-controls .gallery-prev').getBoundingClientRect();
      const next = hero.querySelector('.gallery-controls .gallery-next').getBoundingClientRect();
      const playback = hero.querySelector('.gallery-playback').getBoundingClientRect();
      const bars = [...document.querySelectorAll('.offer-section')].map(bar => bar.getBoundingClientRect());
      const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height'));
      const rail = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--side-rail'));
      if (innerWidth <= 700) {
        const heading = hero.querySelector('.showcase-heading').getBoundingClientRect();
        const facts = hero.querySelector('.gallery-mobile-facts').getBoundingClientRect();
        const photoActions = hero.querySelector('.showcase-photo-actions').getBoundingClientRect();
        const labels = hero.querySelector('.showcase-labels');
        const badgeRight = Math.max(...[...labels.children].map(badge => badge.getBoundingClientRect().right));
        const title = hero.querySelector('.detail-heading h1').getBoundingClientRect();
        return {mobileCard: stage.left > 0 && stage.right < innerWidth && photo.left === stage.left
            && photo.right === stage.right && parseFloat(getComputedStyle(hero).borderRadius) >= 12,
          photoHeading: heading.top >= photo.top && heading.bottom <= photo.bottom && badgeRight <= photoActions.left
            && title.top >= photoActions.bottom - 1,
          photoActions: hero.querySelectorAll('.showcase-photo-actions button').length === 3
            && photoActions.right === heading.right && photoActions.top === heading.top,
          photoControls: [prev,next,playback].every(r => r.top >= photo.top && r.bottom <= photo.bottom)
            && prev.width >= 44 && next.width >= 44 && prev.left < photo.left + 9 && next.right > photo.right - 9,
          compactFacts: facts.top >= thumbnails.bottom && facts.bottom <= copy.top + 1,
          mobileThumbnails: thumb.width >= 85 && thumb.height >= 42 && thumbnails.top >= photo.bottom,
          detailBars: bars.length === 6 && bars.every(bar => bar.left > 0 && bar.right < innerWidth && bar.top >= stage.bottom && bar.height >= 46 && bar.height <= 48),
          groupedBars: bars.slice(1).every((bar,index) => Math.abs(bar.top - bars[index].bottom) < 1)};
      }
      return {edgeToEdge: stage.left === 0 && photo.left === 0 && Math.abs(stage.right - innerWidth) < 1
          && Math.abs(photo.right - stage.right) < 1,
        widthOfBars: bars.length === 6 && bars.every(bar => bar.left === 0 && Math.abs(bar.right - innerWidth) < 1 && bar.top >= stage.bottom),
        fillsHeight: stage.bottom >= innerHeight - nav - 2,
        controlsInView: controls.bottom <= innerHeight - nav + 1,
        leftOverlay: copy.left < innerWidth * .07 && copy.right < innerWidth * .43 && copy.top >= photo.top && copy.bottom <= photo.bottom,
        dockBelowPhoto: controls.top >= photo.bottom - 1 && controls.bottom <= stage.bottom + 1,
        fullWidthThumbnails: Math.abs(controls.left) < 1 && Math.abs(controls.right - (innerWidth - rail)) < 1
            && controls.width - thumbnails.width <= 62,
        compactControls: controls.height - thumbnails.height <= 20 && playback.top >= thumbnails.top && playback.top < thumbnails.bottom,
        edgeButtons: prev.width >= 44 && next.width >= 44 && Math.abs(prev.left - thumbnails.left) <= 4
            && Math.abs(next.right - thumbnails.right) <= 4 && [prev, next].every(r => r.top >= thumbnails.top && r.bottom <= thumbnails.bottom),
        largeThumbnails: thumb.width >= 98 && thumb.height >= 70};
    }""")
    if width <= 700:
        assert all(stats.values()), (width, stats)
        expect(page.locator(".listing-trail")).to_be_visible()
        expect(page.locator(".gallery-mobile-facts dt")).to_have_count(4)
        return
    assert all(stats[key] for key in ("edgeToEdge", "widthOfBars", "dockBelowPhoto", "fullWidthThumbnails", "largeThumbnails", "compactControls", "edgeButtons")), (width, stats)
    assert stats["leftOverlay"], (width, stats)
    if width > 1040:
        assert stats["fillsHeight"], (width, stats)
    if width >= 1440:
        assert stats["controlsInView"], (width, stats)
    expect(panel.get_by_role("link", name="Napisz wiadomość")).to_be_in_viewport()


def gallery_slideshow(browser, base, page):
    route = base + "/demo/oferta/przyklad-1"
    page.emulate_media(reduced_motion="no-preference")
    page.mouse.move(10, 10)
    page.goto(route)
    gallery = page.locator("[data-gallery]")
    image = gallery.locator("[data-gallery-image]")
    position = gallery.locator("[data-gallery-count]")
    controls = gallery.locator(".gallery-controls")
    frames = json.loads(gallery.get_attribute("data-gallery"))
    assert len(set(frame["url"] for frame in frames)) == 3
    expect(image).to_have_attribute("src", frames[0]["url"])
    expect(button(controls, "Wstrzymaj pokaz slajdów")).to_have_attribute("aria-pressed", "true")
    expect(position).to_have_text("2 / 3", timeout=9000)
    expect(image).to_have_attribute("src", frames[1]["url"])
    button(controls, "Wstrzymaj pokaz slajdów").click()
    expect(button(controls, "Włącz pokaz slajdów")).to_have_attribute("aria-pressed", "false")
    strip = controls.locator(".gallery-thumbs")
    strip.evaluate("element => element.style.setProperty('--thumb-columns', '1')")
    button(controls, "Następne zdjęcie").click()
    expect(position).to_have_text("3 / 3")
    assert strip.evaluate("""element => {
      const active = element.querySelector('[aria-pressed=true]').getBoundingClientRect();
      return active.left >= element.getBoundingClientRect().left && active.right <= element.getBoundingClientRect().right;
    }""")
    strip.evaluate("element => element.style.setProperty('--thumb-columns', '3')")
    button(controls, "Zdjęcie 3").click()
    expect(position).to_have_text("3 / 3")
    expect(image).to_have_attribute("src", frames[2]["url"])
    button(controls, "Następne zdjęcie").press("ArrowRight")
    expect(position).to_have_text("1 / 3")
    button(gallery, "Powiększ zdjęcie").click()
    lightbox = gallery.locator("[data-lightbox]")
    expect(lightbox).to_be_visible()
    button(lightbox, "Następne zdjęcie").click()
    expect(lightbox.locator("img")).to_have_attribute("src", frames[1]["url"])
    page.keyboard.press("Escape")
    expect(lightbox).to_be_hidden()
    page.emulate_media(reduced_motion="reduce")
    page.reload()
    expect(button(controls, "Włącz pokaz slajdów")).to_have_attribute("aria-pressed", "false")
    spec = page.locator(".offer-section").filter(has_text="Pełna specyfikacja")
    spec.locator("summary").click()
    expect(spec.locator(".spec-table")).to_be_visible()

    with browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True,
                             reduced_motion="reduce") as mobile:
        phone = mobile.new_page()
        phone.goto(route)
        touch = mobile.new_cdp_session(phone)
        for selector, selected in ((".gallery-main", 2), (".gallery-thumbs", 3)):
            area = phone.locator(selector).bounding_box()
            x, y = round(area["x"] + area["width"] * .85), round(area["y"] + area["height"] * .5)
            touch.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{"x":x,"y":y}]})
            for shift in (24, 49, 75, 102, 128):
                touch.send("Input.dispatchTouchEvent", {"type":"touchMove","touchPoints":[{"x":x-shift,"y":y}]})
            touch.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
            expect(phone.locator("[data-gallery-count]")).to_have_text(f"{selected} / 3")
            expect(phone.locator("[data-gallery-image]")).to_have_attribute("src", frames[selected-1]["url"])
        button(phone.locator(".gallery-controls"), "Poprzednie zdjęcie").tap()
        expect(phone.locator("[data-gallery-count]")).to_have_text("2 / 3")
        expect(phone.locator("[data-lightbox]")).to_be_hidden()
    page.emulate_media(reduced_motion="no-preference")
    print("Full-screen demo slideshow: autoplay, pause, keyboard, lightbox and swipe on the main photo and full-width strip")


def sliding_offer_panel(browser, base):
    route = base + "/demo/oferta/przyklad-29"
    with browser.new_context(viewport={"width":1440,"height":940}) as context:
        page = context.new_page()
        page.goto(route)
        toggle = page.locator("[data-showcase-toggle]")
        summary = page.locator("#listing-summary")
        summary.hover()
        page.wait_for_timeout(5200)
        expect(toggle).to_have_attribute("aria-expanded", "true")
        page.mouse.move(920, 120)
        started = page.evaluate("performance.now()")
        expect(toggle).to_have_attribute("aria-expanded", "false", timeout=6800)
        assert page.evaluate("performance.now()") - started >= 4750
        expect(toggle).to_have_accessible_name("Pokaż cenę i dane")
        expect(summary).to_have_attribute("inert", "")
        page.wait_for_function("element => element.getBoundingClientRect().right <= 1", arg=summary.element_handle())
        if OUTPUT:
            page.screenshot(path=str(Path(OUTPUT) / "ferrari-collapsed.png"))
        toggle.press("Enter")
        expect(toggle).to_have_attribute("aria-expanded", "true")
        expect(summary).not_to_have_attribute("inert", "")
        expect(summary.get_by_role("heading", name="Ferrari 488 GTB", exact=True)).to_be_visible()
        expect(summary.get_by_role("link", name="Napisz wiadomość")).to_be_visible()

    print("Desktop listing panel slides away after five idle seconds, stays open on hover and reopens by keyboard")


def mobile_photo_view(browser, base):
    with browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True) as context:
        page = context.new_page()
        page.goto(base + "/demo/oferta/przyklad-27", wait_until="domcontentloaded")
        showcase = page.locator(".listing-showcase")
        stack = showcase.locator("[data-photo-stack]")
        toggle = showcase.locator("[data-photo-view-toggle]")
        expect(showcase.locator(".contact-actions")).to_be_visible()
        expect(stack).to_be_hidden()
        page.wait_for_function("() => document.querySelector('.listing-showcase').hasAttribute('data-photo-view-fading')",
                               timeout=4400)
        expect(stack).to_be_visible()
        expect(toggle).to_have_accessible_name("Pokaż dane i przyciski")
        expect(toggle).to_be_in_viewport(ratio=1)
        expect(showcase.locator(".gallery-main")).to_be_hidden()
        expect(showcase.locator(".contact-actions")).to_be_hidden()
        expect(showcase.get_by_role("heading", name="Lamborghini Revuelto")).to_be_visible()
        expect(showcase.locator(".showcase-heading .detail-heading > p")).to_have_text("6.5 V12 Plug-in")
        expect(showcase.locator(".showcase-heading .detail-price")).to_be_visible()
        expect(stack.locator("[data-stack-photo]")).to_have_count(3)
        page.wait_for_function("""() => [...document.querySelectorAll('[data-photo-stack] img')]
            .every(image => image.complete && image.naturalWidth > 0)""")
        assert stack.evaluate("""group => {
            const cards = [...group.children].map(card => card.getBoundingClientRect());
            const heading = document.querySelector('.showcase-heading');
            const title = heading.querySelector('#listing-title').getBoundingClientRect();
            const brand = heading.querySelector('.showcase-make').getBoundingClientRect();
            const price = heading.querySelector('.detail-price').getBoundingClientRect();
            return brand.top >= cards[0].top && title.top >= brand.bottom &&
                price.top >= title.bottom && price.bottom <= cards[0].bottom &&
                cards.every((card,index) => Math.abs(card.width - group.clientWidth) < 1 &&
                (index === 0 || card.top >= cards[index - 1].bottom));
        }""")
        stack.locator("[data-stack-photo='1']").tap()
        dialog = showcase.locator("[data-lightbox]")
        expect(dialog).to_be_visible()
        expect(dialog.locator("img")).to_have_attribute("src", "/assets/showcase-hd/27-rear.webp")
        button(dialog, "Zamknij").tap()
        stack.locator("[data-stack-photo='2']").scroll_into_view_if_needed()
        assert toggle.evaluate("""action => {
            const rect = action.getBoundingClientRect();
            return action.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        }""")
        time_origin = page.evaluate("performance.timeOrigin")
        toggle.tap()
        expect(stack).to_be_hidden()
        expect(showcase.locator(".showcase-heading .detail-price")).to_be_visible()
        expect(showcase.locator(".contact-actions .primary")).to_be_in_viewport(ratio=1)
        assert page.evaluate("performance.timeOrigin") == time_origin
        page.wait_for_timeout(3300)
        expect(stack).to_be_hidden()
        page.emulate_media(reduced_motion="reduce")
        page.reload()
        page.wait_for_timeout(3300)
        expect(stack).to_be_hidden()
        toggle.tap()
        expect(stack).to_be_visible()
    print("Mobile listing switches once to three stacked photos and restores its controls on request")


def desktop_collection_logo(page, base):
    page.goto(base + "/")
    opener = button(page.locator(".side-nav"), "Wygląd ikon i przycisków")
    open_profile(page)
    opener.click()
    styles = page.locator("#icon-style-dialog")
    styles.locator(".icon-board summary").click()
    for group in ("lines", "collections"):
        styles.locator(f'[data-appearance-icon-group="{group}"] > summary').click()
    board = styles.locator("[data-icon-board]")
    widths, letter_heights = [], []
    for collection in ("sapphire-braid", "luggage-club", "platinum-tour", "classic"):
        styles.locator(f'input[name="icon-style"][value="{collection}"]').check()
        expect(board).to_have_attribute("data-icon-style", collection)
        widths.append(board.get_by_role("img", name="BRUMBRUM.VIN").bounding_box()["width"])
        letters = board.locator(".icon-collection-brand-letters")
        expect(letters.locator(".collection-brand-face")).to_have_attribute("href", "#brumbrum-collection-letters")
        letter_heights.append(letters.bounding_box()["height"])
    assert min(widths) >= 400 and max(widths) - min(widths) <= 1, widths
    assert min(letter_heights) >= 40 and max(letter_heights) - min(letter_heights) <= 1, letter_heights
    button(styles, "Zamknij").click()
    open_profile(page)
    opener.click()
    expect(styles.get_by_role("heading", name="Motyw strony")).to_be_in_viewport()
    button(styles, "Zamknij").click()


def mobile_listing(browser, base):
    with browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True,
                             reduced_motion="reduce") as context:
        page = context.new_page()
        page.goto(base + "/demo/oferta/przyklad-19")
        detail_geometry(page, 390, "BMW Seria 4", "19")
        nav_geometry(page, 390)
        expect(page.locator(".listing-trail [aria-current=page]")).to_have_text("430i Coupé")
        expect(page.locator("[data-listing-menu], .listing-head-actions")).to_have_count(0)
        nav = page.locator(".bottom-nav")
        expect(nav.get_by_role("link", name="Szukaj")).to_have_attribute("href", "/demo/szukaj")
        expect(nav.get_by_role("link", name="Konto")).to_have_attribute("href", "/demo/konto")
        expect(page.locator(".head-actions [data-language-open]")).to_be_visible()
        expect(page.locator(".head-actions [data-theme-toggle]")).to_be_visible()
        appearance = button(page.locator(".head-actions"), "Wygląd ikon i przycisków")
        appearance.tap()
        styles = page.locator("#icon-style-dialog")
        expect(styles).to_be_visible()
        expect(styles.get_by_role("heading", name="Motyw strony")).to_be_visible()
        expect(styles.locator("[data-theme-choice]")).to_have_count(22)
        stitching = styles.locator("[data-theme-stitch-settings]")
        expect(stitching).to_be_hidden()
        styles.get_by_text("Grafitowa Alcantara", exact=True).tap()
        expect(page.locator("html")).to_have_attribute("data-palette", "alcantara")
        expect(page.locator("html")).to_have_attribute("data-theme", "dark")
        styles.get_by_text("Skóra kremowa", exact=True).tap()
        expect(page.locator("html")).to_have_attribute("data-palette", "leather-ivory")
        expect(page.locator("html")).to_have_attribute("data-theme", "light")
        seam_colors = []
        for label, palette in (("Biała skóra · czerwona nić", "leather-pearl-rosso"),
                               ("Biała skóra · fioletowa nić", "leather-pearl-violet")):
            styles.get_by_text(label, exact=True).tap()
            expect(page.locator("html")).to_have_attribute("data-palette", palette)
            expect(page.locator("html")).to_have_attribute("data-theme", "light")
            swatch = styles.locator(f'[data-swatch="{palette}"]')
            for surface in (page.locator("body"), swatch):
                expect(surface).to_have_css("background-image", re.compile(r"/assets/buttons/nappa\.webp"))
                assert "radial-gradient(" not in surface.evaluate("element => getComputedStyle(element).backgroundImage")
            seam_colors.append(swatch.evaluate("element => getComputedStyle(element, '::before').borderColor"))
            menu_row = styles.locator('[data-appearance-section="buttons"] > summary')
            assert menu_row.evaluate("element => getComputedStyle(element, '::before').borderColor") == seam_colors[-1]
        assert len(set(seam_colors)) == 2
        styles.get_by_text("Karbon Twill", exact=True).tap()
        expect(page.locator("html")).to_have_attribute("data-palette", "carbon-twill")
        expect(page.locator("html")).to_have_attribute("data-theme", "dark")
        expect(page.locator("body")).to_have_css("background-image", re.compile(r"/assets/buttons/carbon-fiber\.webp"))
        styles.get_by_text("Czarny Kwas", exact=True).tap()
        expect(stitching).to_be_visible()
        preview = stitching.locator(".theme-stitch-preview")
        read_seam = """element => {
            const seam = getComputedStyle(element, '::before');
            return [seam.borderTopColor, parseFloat(seam.borderTopWidth)];
        }"""
        initial_seam = preview.evaluate(read_seam)
        stitching.get_by_text("Fioletowa", exact=True).tap()
        expect(page.locator("html")).to_have_attribute("data-theme-thread", "violet")
        purple_seam = preview.evaluate(read_seam)
        assert purple_seam[0] != initial_seam[0]
        stitching.get_by_text("Mocny", exact=True).tap()
        expect(page.locator("html")).to_have_attribute("data-theme-stitch-contrast", "strong")
        strong_seam = preview.evaluate(read_seam)
        assert strong_seam[1] > purple_seam[1]
        menu_row = styles.locator('[data-appearance-section="buttons"] > summary')
        assert menu_row.evaluate(read_seam) == strong_seam
        styles.get_by_text("Grafitowa skóra RS", exact=True).tap()
        expect(stitching.get_by_role("radio", name="Z motywu")).to_be_checked()
        styles.get_by_text("Czarny Kwas", exact=True).tap()
        expect(stitching.get_by_role("radio", name="Fioletowa")).to_be_checked()
        expect(stitching.get_by_role("radio", name="Mocny")).to_be_checked()
        styles.get_by_text("Czarny", exact=True).tap()
        expect(page.locator("html")).to_have_attribute("data-palette", "black")
        expect(stitching).to_be_hidden()
        styles.get_by_text("Biały", exact=True).tap()
        expect(styles.locator(".icon-board")).not_to_have_attribute("open", "")
        expect(styles.locator("[data-appearance-icon-group][open]")).to_have_count(0)
        expect(styles.locator('[data-appearance-section="buttons"][open]')).to_have_count(0)
        surfaces = styles.locator('[data-appearance-icon-group="surface"]')
        surfaces.locator("summary").tap()
        expect(surfaces.get_by_role("radio")).to_have_count(3)
        surfaces.locator("summary").tap()
        styles.locator('[data-appearance-section="buttons"] > summary').tap()
        dock = styles.locator(".button-finish-preview-dock")
        expect(dock).to_be_hidden()
        styles.locator('[data-appearance-button-group="upholstery"] > summary').tap()
        expect(dock).to_be_in_viewport(ratio=1)
        finishes = {"color": "graphite", "material": "grained", "stitch": "double", "thread": "red"}
        upholstery = styles.locator(".button-finish-settings")
        expect(upholstery.locator("select")).to_have_count(0)
        expect(upholstery.get_by_role("radio")).to_have_count(11)
        upholstery.get_by_text("Grafit GT", exact=True).tap()
        expect(upholstery.get_by_role("radio", name="Grafit GT")).to_be_checked()
        upholstery.locator(".button-finish-customizer > summary").tap()
        upholstery.locator('[data-appearance-button-axis="color"] > summary').tap()
        upholstery.locator('[data-button-finish-palette="ferrari"] > summary').tap()
        upholstery.get_by_text("Krem Crema", exact=True).tap()
        upholstery.locator('[data-appearance-button-axis="material"] > summary').tap()
        upholstery.get_by_text("Alcantara perforowana", exact=True).tap()
        upholstery.locator('[data-appearance-button-axis="stitch"] > summary').tap()
        upholstery.get_by_text("Krzyżykowe", exact=True).tap()
        upholstery.locator('[data-appearance-button-axis="thread"] > summary').tap()
        upholstery.get_by_text("Granatowe", exact=True).tap()
        for field, value in {"color": "f-crema", "material": "alcantara-perforated", "stitch": "cross", "thread": "navy"}.items():
            expect(page.locator("html")).to_have_attribute("data-button-" + field, value)
        expect(upholstery.get_by_role("radio", name="Własny styl")).to_be_checked()
        preview_button = dock.locator(".button-finish-preview-button")
        assert preview_button.bounding_box()["height"] >= 64
        expect(preview_button).to_have_css("background-image", re.compile(r"/assets/buttons/alcantara-perforated\.webp"))
        preview_label = preview_button.locator(".button-embroidery-label")
        satin_texture = preview_label.evaluate("label => getComputedStyle(label).backgroundImage")
        embroidery = upholstery.locator('[data-appearance-button-axis="embroidery"]')
        embroidery.locator("summary").tap()
        expect(embroidery.get_by_role("radio")).to_have_count(6)
        embroidery.get_by_text("Metalizowana", exact=True).tap()
        expect(page.locator("html")).to_have_attribute("data-button-embroidery", "metallic")
        expect(preview_label).to_have_css("background-image", re.compile(r"repeating-linear-gradient"))
        assert preview_label.evaluate("label => getComputedStyle(label).backgroundImage") != satin_texture
        assert dock.evaluate("""dock => {
          const dialog = dock.closest('dialog');
          const options = dock.previousElementSibling;
          options.scrollTop = 0;
          const first = dock.getBoundingClientRect().bottom;
          options.scrollTop = options.scrollHeight;
          const bounds = dock.getBoundingClientRect();
          return options.scrollTop >= 130 && Math.abs(first - bounds.bottom) <= 1 &&
            options.getBoundingClientRect().bottom <= bounds.top &&
            bounds.bottom <= Math.min(innerHeight, dialog.getBoundingClientRect().bottom);
        }""")
        expect(dock).to_be_in_viewport(ratio=1)
        upholstery.locator(".button-finish-customizer > summary").tap()
        upholstery.get_by_text("Grafit GT", exact=True).tap()
        expect(preview_button).to_have_css("background-image", re.compile(r"/assets/buttons/grained\.webp"))
        expect(upholstery.get_by_role("radio", name="Grafit GT")).to_be_checked()
        for key, value in finishes.items():
            expect(page.locator("html")).to_have_attribute("data-button-" + key, value)
        sample = upholstery.locator(".button-finish-card").filter(has_text="Grafit GT").locator(".button-finish-swatch")
        expect(sample).to_have_css("background-image", re.compile(r"/assets/buttons/grained\.webp"))
        assert sample.evaluate("""el => ['::before','::after'].every(layer =>
            getComputedStyle(el, layer).borderTopStyle === 'dashed')""")
        page.reload()
        listing_button = page.locator(".showcase-copy .contact-actions .btn.primary").first
        expect(listing_button).to_have_css(
            "background-image", re.compile(r"/assets/buttons/grained\.webp"))
        expect(page.locator("html")).to_have_attribute("data-button-embroidery", "metallic")
        expect(listing_button.locator(".button-embroidery-label")).to_have_css("background-image", re.compile(r"repeating-linear-gradient"))
        appearance.tap()
        styles.locator('[data-appearance-section="buttons"] > summary').tap()
        styles.locator('[data-appearance-button-group="upholstery"] > summary').tap()
        expect(upholstery.get_by_role("radio", name="Grafit GT")).to_be_checked()
        embroidery.locator("summary").tap()
        expect(embroidery.get_by_role("radio", name="Metalizowana")).to_be_checked()
        embroidery.get_by_text("Gładki napis", exact=True).tap()
        expect(preview_label).to_have_css("background-image", "none")
        upholstery.get_by_text("Fabryczny niebieski", exact=True).tap()
        expect(upholstery.get_by_role("radio", name="Fabryczny niebieski")).to_be_checked()
        styles.locator('[data-appearance-section="buttons"] > summary').tap()
        styles.locator('[data-appearance-icon-group="lines"] > summary').tap()
        styles.locator('[data-appearance-icon-group="collections"] > summary').tap()
        assert set(styles.locator('input[name="icon-style"]').evaluate_all('options => options.map(option => option.value)')) == {
            "classic", "classic-solid", "classic-duotone", "classic-cobalt", "classic-sage", "classic-copper", "rosso", "tourbillon",
            "silver-arrow", "desert-rally", "midnight-gt",
            "alpine", "art-deco", "heritage", "aventurine", "aurora", "regulator",
            "porsche-gt", "super-trofeo", "night-endurance",
            "glacier-platinum", "imperial-jade", "obsidian-vault", "vermilion-calibre", "amethyst-moonphase", "copper-patina", "champagne-meteorite", "burgundy-enamel", "pearl-guilloche", "blue-bronze",
            "forged-carbon", "checkered-flag", "serpent", "green-gold", "rosso-corsa", "lime-superbike", "oil-slick", "classic-garage",
            "amethyst-forge", "carrara-chrome", "deco-imperial", "cognac-coachwork", "emerald-coachwork", "cobalt-turbo", "damascus-copper",
            "saffiano-gt", "saddle-touring", "bordeaux-nappa", "suede-rs", "ivory-atelier",
            "flat-six", "v12-corse", "gt1-pearl", "rally-martini", "riviera-1967",
            "coachbuilt-walnut", "smoked-crystal", "ruby-cabochon", "tiger-eye", "malachite-salon",
            "meteorite-black", "titanium-exhaust", "cnc-atelier", "woven-bronze", "luggage-club",
            "sapphire-braid", "platinum-tour", "green-fairway", "cognac-pave", "gti-jewel",
            "white-gold-links", "ivory-club", "riviera-cabochon", "bordeaux-coachline", "track-platinum",
            "ceramic-midnight", "ceramic-ivory", "ceramic-petrol", "ceramic-burgundy", "ceramic-forest",
            "sirocco-black", "arte-cognac", "sirocco-champagne", "arte-oxblood", "arte-deep-blue",
            "inferno-copper", "afterburner-blue", "crimson-manifold", "violet-heat", "amber-turbine",
            "brushed-aluminium", "black-titanium", "anodised-jade", "piston-bronze", "forged-copper",
            "pagani-atelier", "clockwork-gold", "platinum-jewel", "crystal-night", "neon-tachometer",
        }
        styles.locator('input[name="icon-style"][value="classic-duotone"]').check()
        expect(page.locator("html")).to_have_attribute("data-icon-style", "classic-duotone")
        styles.locator(".icon-board summary").tap()
        expect(styles.locator(".icon-board-item>.ui-icon")).to_have_count(69)
        board = styles.locator("[data-icon-board]")
        expect(board).to_have_attribute("data-icon-style", "classic-duotone")
        expect(board.get_by_role("img", name="BRUMBRUM.VIN")).to_be_visible()
        assert board.evaluate("""el => {
          const board = el.getBoundingClientRect();
          const arrow = el.querySelector('[data-icon-board-step]');
          const style = getComputedStyle(arrow);
          return board.width >= innerWidth - 24 && board.left >= 0 && board.right <= innerWidth
            && style.borderInlineStartWidth === '0px' && style.backgroundColor === 'rgba(0, 0, 0, 0)'
            && arrow.getBoundingClientRect().width >= 44;
        }""")
        board.evaluate("""board => {
          const touch = (type, x, y) => board.dispatchEvent(new PointerEvent(type, {
            bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
            clientX: x, clientY: y
          }));
          touch('pointerdown', 240, 100);
          touch('pointerup', 80, 104);
        }""")
        expect(board).to_have_attribute("data-icon-style", "classic-cobalt")
        expect(styles.get_by_role("radio", name="Kobalt", exact=True)).to_be_checked()
        expect(page.locator("html")).to_have_attribute("data-icon-style", "classic-duotone")
        for key, title in (("classic-sage", "Szałwia"), ("classic-copper", "Miedź")):
            button(board, "Następna kolekcja").tap()
            expect(board).to_have_attribute("data-icon-style", key)
            expect(styles.get_by_role("radio", name=title, exact=True)).to_be_checked()
            expect(board.locator(".icon-board-item>.ui-icon>.ui-icon-glyph").first).to_be_visible()
        button(board, "Następna kolekcja").tap()
        expect(board).to_have_attribute("data-icon-style", "amethyst-forge")
        expect(styles.get_by_role("radio", name="Amethyst Forge", exact=True)).to_be_checked()
        expect(page.locator("html")).to_have_attribute("data-icon-style", "classic-duotone")
        button(board, "Ustaw zestaw").tap()
        expect(page.locator("html")).to_have_attribute("data-icon-style", "amethyst-forge")
        button(board, "Następna kolekcja").tap()
        expect(styles.get_by_role("radio", name="Carrara Chrome", exact=True)).to_be_checked()
        styles.get_by_text("Carrara Chrome", exact=True).first.tap()
        expect(page.locator("html")).to_have_attribute("data-icon-style", "carrara-chrome")
        for collection in ("sapphire-braid", "platinum-tour", "green-fairway", "cognac-pave", "gti-jewel",
                           "white-gold-links", "ivory-club", "riviera-cabochon", "bordeaux-coachline", "track-platinum",
                           "ceramic-midnight", "ceramic-ivory", "ceramic-petrol", "ceramic-burgundy", "ceramic-forest",
                           "sirocco-black", "arte-cognac", "sirocco-champagne", "arte-oxblood", "arte-deep-blue",
                           "inferno-copper", "afterburner-blue", "crimson-manifold", "violet-heat", "amber-turbine",
                           "brushed-aluminium", "black-titanium", "anodised-jade", "piston-bronze", "forged-copper",
                           "pagani-atelier", "clockwork-gold", "platinum-jewel", "crystal-night", "neon-tachometer",
                           ):
            styles.locator(f'input[name="icon-style"][value="{collection}"]').check()
            expect(board).to_have_attribute("data-icon-style", collection)
            assert board.evaluate("""(board, collection) => {
                const icons = [...board.querySelectorAll('.icon-board-item > .ui-icon')];
                const wordmark = board.querySelector('.icon-collection-brand-letters');
                const logo = wordmark.closest('.icon-collection-brand').getBoundingClientRect();
                const sample = document.querySelector(`.icon-style-sample[data-icon-style="${collection}"]`);
                const thumbnail = sample.querySelector('.icon-collection-brand').getBoundingClientRect();
                const sampleWordmark = sample.querySelector('.icon-collection-brand-letters');
                const luggageWordmark = document.querySelector('.icon-style-sample[data-icon-style="luggage-club"] .icon-collection-brand-letters');
                return icons.length === 69 && new Set(icons.map(icon => icon.dataset.iconName)).size === 69 &&
                    icons.every(icon => getComputedStyle(icon).backgroundImage.includes('/' + collection + '.webp')) &&
                    wordmark.getBoundingClientRect().height >= 25 &&
                    wordmark.querySelector('.collection-brand-face').getAttribute('href') === '#brumbrum-collection-letters' &&
                    sampleWordmark.querySelector('.collection-brand-face').getAttribute('href') === '#brumbrum-collection-letters' &&
                    Math.abs(sampleWordmark.getBoundingClientRect().height - luggageWordmark.getBoundingClientRect().height) <= 1 &&
                    logo.width >= innerWidth - 46 && logo.left >= 0 && logo.right <= innerWidth &&
                    Math.abs(thumbnail.width - sample.querySelector('.icon-style-sample-icons').getBoundingClientRect().width) <= 1 &&
                    getComputedStyle(sample.querySelector('.ui-icon'))
                        .backgroundImage.includes('/' + collection + '-preview.webp');
            }""", collection)
        styles.locator('input[name="icon-style"][value="classic-duotone"]').check()
        assert styles.locator(".icon-board-item>.ui-icon").evaluate_all("""icons =>
            new Set(icons.map(icon => icon.dataset.iconName)).size === icons.length &&
            icons.every(icon => icon.querySelector('.ui-icon-glyph').childElementCount > 0 &&
                getComputedStyle(icon.querySelector('.ui-icon-glyph')).visibility === 'visible')
        """)
        button(styles, "Zamknij").tap()
        expect(styles).to_be_hidden()
        page.reload()
        expect(page.locator("html")).to_have_attribute("data-icon-style", "classic-duotone")
        assert page.locator(".bottom-nav .ui-icon").evaluate_all("""icons => icons.every(icon =>
            getComputedStyle(icon.querySelector('.ui-icon-glyph')).visibility === 'visible' &&
            getComputedStyle(icon).width === '44px')
        """)
        assert page.locator(".gallery-mobile-facts .facts-grid > div").evaluate_all("""cells => cells.every(cell => {
            const [icon, label, value] = ['.ui-icon', 'dt', 'dd'].map(selector => cell.querySelector(selector));
            const [iconBounds, labelBounds, valueBounds] = [icon, label, value].map(el => el.getBoundingClientRect());
            const tile = cell.getBoundingClientRect();
            return iconBounds.width >= 22 && iconBounds.right <= labelBounds.left &&
                Math.abs((iconBounds.top + iconBounds.bottom) - (labelBounds.top + labelBounds.bottom)) <= 2 &&
                labelBounds.height <= parseFloat(getComputedStyle(label).lineHeight) + 1 &&
                valueBounds.top >= Math.max(iconBounds.bottom, labelBounds.bottom) &&
                getComputedStyle(value).textAlign === 'center' &&
                Math.abs((valueBounds.left + valueBounds.right) - (tile.left + tile.right)) <= 2;
        })""")
        assert page.locator(".offer-section summary>.ui-icon").evaluate_all("""icons => icons.every(icon =>
            getComputedStyle(icon.querySelector('.ui-icon-glyph')).visibility === 'visible')
        """)
        expect(page.locator(".gallery-controls > .gallery-next")).to_have_css("min-width", "44px")
        captions = page.locator(".gallery-thumb-caption")
        expect(captions).to_have_text(["+Przód pojazdu", "+Tył pojazdu", "+Bok pojazdu"])
        expect(captions.first.locator("span")).to_be_hidden()
        expect(page.locator(".gallery-detail-dock")).to_be_hidden()
        assert captions.evaluate_all("""labels => labels.every(label => {
            const caption = label.getBoundingClientRect();
            const thumb = label.previousElementSibling.getBoundingClientRect();
            return Math.abs(caption.top - thumb.bottom) <= 1 && Math.abs(caption.left - thumb.left) <= 1
                && Math.abs(caption.right - thumb.right) <= 1;
        })""")
        button(page, "Tył pojazdu").tap()
        preview = page.locator("[data-gallery-detail-preview]")
        expect(preview.get_by_role("heading")).to_have_text("Tył pojazdu")
        expect(preview.locator("[data-gallery-detail-image]")).to_have_attribute("src", "/assets/showcase-hd/19-rear.webp")
        button(preview, "Zamknij").tap()
        expect(preview).to_be_hidden()
        if OUTPUT:
            page.screenshot(path=str(Path(OUTPUT) / "bmw-mobile.png"))
        top_favorite = page.locator(".showcase-photo-actions [data-favorite]")
        bottom_favorite = page.locator(".detail-tools [data-favorite]")
        top_favorite.tap()
        expect(top_favorite).to_have_attribute("aria-pressed", "true")
        expect(bottom_favorite).to_have_attribute("aria-pressed", "true")
        top_favorite.tap()
        expect(top_favorite).to_have_attribute("aria-pressed", "false")
        top_compare = page.locator(".showcase-photo-actions [data-compare]")
        top_compare.tap()
        expect(top_compare).to_have_attribute("aria-pressed", "true")
        expect(page.locator("[data-compare-tray] a")).to_have_attribute("href", "/demo/porownanie")
        top_compare.tap()
        expect(top_compare).to_have_attribute("aria-pressed", "false")
        expect(page.locator("[data-compare-tray]")).to_be_hidden()
        page.wait_for_timeout(5200)
        expect(page.locator("[data-showcase-toggle]")).to_be_hidden()
        expect(page.locator(".detail-price")).to_contain_text("154 900")
        expect(page.locator("#listing-summary")).not_to_have_attribute("inert", "")
        description = page.locator(".offer-section").first
        next_section = page.locator(".offer-section").nth(1)
        before = next_section.evaluate("el => el.offsetTop")
        description.locator("summary").tap()
        expect(description.locator(".prose")).to_be_visible()
        page.wait_for_function("([el, top]) => el.offsetTop > top", arg=[next_section.element_handle(), before])
        if OUTPUT:
            description.scroll_into_view_if_needed()
            page.screenshot(path=str(Path(OUTPUT) / "bmw-mobile-description.png"))
        description.locator("summary").tap()
        expect(description.locator(".prose")).to_be_hidden()
        next_section.locator("summary").tap()
        expect(next_section.locator(".spec-table")).to_contain_text("BMW")

        page.goto(base + "/demo/oferta/przyklad-113")
        dock = page.locator(".gallery-detail-dock")
        expect(button(dock, "Reflektory")).to_be_visible()
        expect(button(dock, "Felgi")).to_be_visible()
        assert dock.evaluate("""dock => {
            const box = dock.getBoundingClientRect();
            const actions = document.querySelector('.showcase-photo-actions').getBoundingClientRect();
            const gallery = document.querySelector('.gallery-main').getBoundingClientRect();
            return box.top >= actions.bottom && box.bottom <= gallery.bottom &&
                Math.abs(box.right - actions.right) <= 1 && box.left >= actions.left;
        }""")
        button(dock, "Reflektory").tap()
        expect(preview.get_by_role("heading")).to_have_text("Reflektory")
        button(preview, "Zamknij").tap()
        button(dock, "Felgi").tap()
        expect(preview.get_by_role("heading")).to_have_text("Felgi")
        button(preview, "Zamknij").tap()
        photos_only = button(page, "Same zdjęcia")
        expect(photos_only).to_have_css("border-top-style", "solid")
        expect(photos_only.locator(".ui-icon").first).to_be_visible()
        photos_only.tap()
        expect(page.locator("[data-photo-stack]")).to_be_visible()
    print("Mobile listings: subdued photo captions, detail shortcuts, contact actions and the photo mode button")


def card_geometry(page):
    card = page.locator("[data-search-results] .offer-card").first
    assert card.evaluate("""card => {
      const box = selector => card.querySelector(selector).getBoundingClientRect();
      const photo = box('.offer-image'), star = box('.favorite'), pin = box('.offer-location');
      const price = box('.offer-price'), facts = box('.offer-specs');
      return card.querySelectorAll('.offer-specs li').length === 4 && facts.left > price.left
        && Math.abs(photo.right - pin.right) < 13 && Math.abs(photo.bottom - pin.bottom) < 13
        && Math.abs(photo.right - star.right) < 13 && Math.abs(photo.top - star.top) < 13;
    }""")
    assert card.locator("..").evaluate("""track => {
      const rows = new Map();
      for (const card of track.children) {
        const top = card.getBoundingClientRect().top;
        const positions = ['.offer-image', '.trim', '.offer-price', '.offer-specs li', '.offer-foot']
          .map(selector => card.querySelector(selector).getBoundingClientRect().top);
        const height = card.getBoundingClientRect().height;
        if (!rows.has(top)) rows.set(top, [...positions, height]);
        if (![...positions, height].every((value, i) => Math.abs(value - rows.get(top)[i]) < 1)) return false;
      }
      return true;
    }""")


def footer_geometry(page, base):
    for width, height in ((390, 844), (768, 1024), (1440, 940)):
        page.set_viewport_size({"width": width, "height": height})
        for route in ("/zaloguj", "/porownanie"):
            page.goto(base + route)
            page.evaluate("document.fonts.ready")
            page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
            assert page.evaluate("""() => {
              const nav = document.querySelector('.bottom-nav');
              const edge = getComputedStyle(nav).display === 'none' ? innerHeight : nav.getBoundingClientRect().top;
              const footer = document.querySelector('.site-foot').getBoundingClientRect();
              return Math.abs(footer.bottom - edge) <= 1;
            }"""), (width, route)
            if width == 768:
                assert page.evaluate("document.documentElement.scrollHeight === innerHeight"), route
                if OUTPUT:
                    page.screenshot(path=str(Path(OUTPUT) / f"{route[1:]}-footer-tablet.png"))
    print("Footer reaches the bottom on short sign-in and comparison pages at phone, tablet and desktop widths")


def top_filters(page):
    form = page.get_by_role("form", name="Filtry ogłoszeń")
    for field in ("category", "make", "model", "minPrice", "maxPrice", "city"):
        expect(form.locator(f'[name="{field}"]')).to_be_visible()
    filters = form.bounding_box()
    results = page.locator(".search-main").bounding_box()
    assert abs(filters["x"] - results["x"]) < 1
    assert abs(filters["width"] - results["width"]) < 1
    assert filters["y"] + filters["height"] < results["y"]


def vehicle_search_options(browser, base):
    with browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True,
                             reduced_motion="reduce") as context:
        page = context.new_page()
        page.goto(base + "/demo")
        form = page.get_by_role("form", name="Wyszukiwarka pojazdów")
        category = form.locator("[data-filter-type]")
        make = form.get_by_role("combobox", name="Marki", exact=True)
        model = form.locator("[data-filter-model]")
        expect(make.locator('option[value=""]')).to_have_text("Wszystkie marki")
        expect(category.locator("option")).to_have_count(21)
        expect(model).to_be_disabled()
        samples = {
            "car": ("BMW", "Seria 4"), "van": ("Ford", "Transit"), "truck": ("MAN", "TGX"),
            "camper": ("Fiat", "Ducato"), "motorcycle": ("Yamaha", "MT-07"),
            "scooter": ("Yamaha", "NMAX"), "quad": ("Yamaha", "YFZ450R"),
            "utv": ("Polaris", "Ranger"), "kart": ("Tony Kart", "Racer 401"),
            "snowmobile": ("Ski-Doo", "Grand Touring LE"), "bus": ("Solaris", "Urbino 12"),
            "farm": ("John Deere", "6155R"), "construction": ("Kubota", "U27-4"),
            "industrial": ("Toyota", "Traigo 48"), "special": ("Bucher", "CityCat 5006"),
            "trailer": ("Schmitz Cargobull", "S.CS"), "other": ("Aixam", "City"),
        }
        for vehicle_type, (brand, name) in samples.items():
            category.select_option(vehicle_type)
            expect(make.locator('option[value=""]')).to_have_text("Wszystkie marki")
            expect(make.get_by_role("option", name=brand, exact=True)).to_have_count(1)
            make.select_option(brand)
            model.select_option(name)
            expect(model).to_have_value(name)
        category.select_option("truck:tractor")
        make.select_option("MAN")
        model.select_option("TGX")
        expect(model.get_by_role("option", name="TGL", exact=True)).to_have_count(0)
        category.select_option("trailer:semi_trailer")
        expect(make.get_by_role("option", name="Hobby", exact=True)).to_have_count(0)
        category.select_option("motorcycle")
        make.select_option("Yamaha")
        model.select_option("MT-07")
        category.select_option("quad")
        expect(make).to_have_value("Yamaha")
        expect(model).to_have_value("")
        expect(model.get_by_role("option", name="MT-07", exact=True)).to_have_count(0)
        expect(make.get_by_role("option", name="Lamborghini", exact=True)).to_have_count(0)
        model.select_option("YFZ450R")
        make.select_option("CFMOTO")
        expect(model).to_have_value("")
        expect(model.get_by_role("option", name="UFORCE 600", exact=True)).to_have_count(0)
        model.select_option("CFORCE 520")
        button(form, "Filtry zaawansowane").tap()
        expect(page.get_by_role("dialog", name="Filtry zaawansowane")).to_be_visible()
        page.keyboard.press("Escape")
        expect(page.locator("[data-filter-type]")).to_have_value("quad")
        expect(page.get_by_role("combobox", name="Marki", exact=True)).to_have_value("CFMOTO")
        expect(page.locator("[data-filter-model]")).to_have_value("CFORCE 520")
        expect(page.locator("[data-search-count]")).to_have_text("Wyniki · 1")
        page.locator(".offer-card h3 a").first.tap()
        expect(page).to_have_url(re.compile(r"/demo/oferta/"))
        page.go_back(wait_until="domcontentloaded")
        expect(page).to_have_url(re.compile(r"/demo/szukaj\?.*type=quad"))
        page.reload()
        expect(page.locator("[data-filter-model]")).to_have_value("CFORCE 520")
        nav_geometry(page, 390)
        page.goto(base + "/demo/szukaj?type=trailer&body=semi_trailer&lang=en")
        expect(page.locator("[data-filter-type]")).to_have_value("trailer:semi_trailer")
        expect(page.get_by_role("combobox", name="Brand", exact=True).locator('option[value=""]')).to_have_text("All brands")
        expect(page.locator("[data-filter-make]").get_by_role("option", name="Krone", exact=True)).to_have_count(1)
        expect(page.locator("[data-filter-make]").get_by_role("option", name="Scania", exact=True)).to_have_count(0)
        page.locator("[data-filter-make]").select_option("Schmitz Cargobull")
        page.locator("[data-filter-model]").select_option("S.CS")
        button(page.get_by_role("form", name="Listing filters"), "Show results").first.tap()
        expect(page.locator("[data-search-count]")).to_have_text("Results · 1")
        params=parse_qs(urlsplit(page.url).query)
        assert params["type"]==["trailer"] and params["body"]==["semi_trailer"]
        page.goto(base + "/?lang=pl")
        expect(page.get_by_role("form", name="Wyszukiwarka pojazdów").locator("[data-filter-type]")).to_have_count(1)
        expect(page.locator("[data-filter-make]").get_by_role("option", name="Yamaha", exact=True)).to_have_count(1)
    print("All 18 vehicle categories and two heavy-vehicle shortcuts, make and model reset, PL/EN, direct URLs, refresh and advanced search")


def browse_reels(browser, base, page):
    page.emulate_media(reduced_motion="reduce")
    page.goto(base + "/szukaj")
    expect(page.locator(".results-head h2")).to_have_text("Wyniki · 0")
    preview = page.locator(".demo-preview [data-reel-track]")
    expect(preview.locator(".offer-card")).to_have_count(10)
    expect(preview.locator(".offer-card h3").first).to_have_text("Porsche Taycan")
    assert preview.evaluate("""track => {
        const rows = Map.groupBy([...track.children], item => item.offsetTop);
        return rows.size === 2 && [...rows.values()].every(cards => cards.length === 5
            && Math.abs(cards[0].offsetLeft) <= 1
            && Math.abs(cards.at(-1).offsetLeft + cards.at(-1).offsetWidth - track.clientWidth) <= 1);
    }""")
    assert page.locator(".demo-preview .offer-image a").evaluate_all("links => links.every(link => link.pathname.startsWith('/demo/oferta/'))")
    open_profile(page)
    page.locator(".side-nav .side-mode").click()
    expect(page).to_have_url(base + "/demo")
    expect(page.locator("[data-ad-carousel]")).to_be_visible()
    open_profile(page)
    page.locator(".side-nav").get_by_role("link", name="Szukaj", exact=True).click()
    expect(page).to_have_url(base + "/demo/szukaj")
    expect(page.locator(".results-head h2")).to_have_text(f"Wyniki · {DEMO_LISTINGS}")
    for width in (320, 360, 390, 768, 1440):
        page.set_viewport_size({"width": width, "height": 900})
        tools = page.locator(".results-head")
        expect(tools.locator("[data-reel-mode]")).to_be_visible()
        assert tools.evaluate("""head => {
            const controls = ['h2', '[data-sort]', '.results-compare', '[data-reel-mode]']
                .map(selector => head.querySelector(selector).getBoundingClientRect());
            const center = rect => rect.top + rect.height/2;
            return controls.every((rect, i) => Math.abs(center(rect) - center(controls[0])) <= 1
                && rect.left >= 0 && rect.right <= innerWidth
                && (i === 0 || (controls[i-1].right <= rect.left && rect.width >= 44 && rect.height >= 44)));
        }"""), width
    track = page.locator(".search-main [data-reel-track]")
    reel = page.locator(".search-main [data-reel]")
    expect(track.locator(".offer-card")).to_have_count(DEMO_LISTINGS)
    expect(reel.locator("[data-reel-controls]")).to_be_hidden()
    first = track.locator(".offer-card").first
    expect(first.locator(".reel-description")).to_be_hidden()
    mode = button(reel, "Tryb rolek")
    mode.click()
    expect(mode).to_have_attribute("aria-pressed", "true")
    expect(first.locator(".reel-description")).to_be_visible()
    expect(first.locator(".reel-description")).to_contain_text("Taycan Turbo S")
    assert first.evaluate("""card => {
      const box = selector => card.querySelector(selector).getBoundingClientRect();
      const image = box('.offer-image'), info = box('.offer-info');
      const price = box('.offer-price'), description = box('.reel-description');
      return info.left >= image.left && info.right < image.left + image.width * .55
        && price.top >= image.top && price.bottom <= description.top && description.bottom <= image.bottom;
    }""")
    page.wait_for_function("() => document.querySelector('.reel-single .offer-image img').currentSrc.includes('/assets/showcase-hd/')")
    assert track.evaluate("track => Math.abs(track.clientWidth - track.firstElementChild.getBoundingClientRect().width) < 1")
    expect(reel.locator("[data-reel-position]")).to_have_text(f"1 z {DEMO_LISTINGS}")
    button(reel, "Następne ogłoszenia").click()
    expect(reel.locator("[data-reel-position]")).to_have_text(f"2 z {DEMO_LISTINGS}")
    button(reel, "Poprzednie ogłoszenia").click()
    expect(reel.locator("[data-reel-position]")).to_have_text(f"1 z {DEMO_LISTINGS}")
    track.focus()
    track.press("ArrowRight")
    expect(reel.locator("[data-reel-position]")).to_have_text(f"2 z {DEMO_LISTINGS}")
    track.press("End")
    expect(reel.locator("[data-reel-position]")).to_have_text(f"{DEMO_LISTINGS} z {DEMO_LISTINGS}")
    track.press("Home")
    photo = track.locator(".offer-image a").first
    photo.scroll_into_view_if_needed()
    box = photo.bounding_box()
    x, y = box["x"] + box["width"] * .97, box["y"] + box["height"] * .56
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x - box["width"] * .94, y, steps=12)
    page.mouse.up()
    expect(reel.locator("[data-reel-position]")).to_have_text(f"2 z {DEMO_LISTINGS}")
    expect(page).to_have_url(base + "/demo/szukaj")
    if OUTPUT:
        mode.scroll_into_view_if_needed()
        page.screenshot(path=str(Path(OUTPUT) / "reel-desktop.png"))
    mode.click()
    expect(mode).to_have_attribute("aria-pressed", "false")
    expect(reel.locator("[data-reel-controls]")).to_be_hidden()
    expect(first.locator(".reel-description")).to_be_hidden()
    reel_geometry(page, 1440)
    if OUTPUT:
        page.screenshot(path=str(Path(OUTPUT) / "listing-grid.png"))
    page.emulate_media(reduced_motion="no-preference")

    context = browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
    try:
        phone = context.new_page()
        phone.goto(base + "/demo/szukaj")
        button(phone.locator(".results-head"), "Rolki").click()
        first = phone.locator("[data-reel-track] .offer-card").first
        expect(first.locator(".offer-price")).to_be_visible()
        expect(first.locator(".reel-description")).to_be_visible()
        assert first.evaluate("""card => card.querySelector('.offer-image').getBoundingClientRect().bottom
            <= card.querySelector('.offer-info').getBoundingClientRect().top + 1""")
        if OUTPUT:
            first.scroll_into_view_if_needed()
            phone.screenshot(path=str(Path(OUTPUT) / "reel-phone.png"))
        phone.locator("[data-reel-track] .offer-image a").first.scroll_into_view_if_needed()
        photo = phone.locator("[data-reel-track] .offer-image a").first.bounding_box()
        start = round(photo["x"] + photo["width"] * .87)
        y = round(photo["y"] + photo["height"] * .55)
        touch = context.new_cdp_session(phone)
        touch.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{"x":start,"y":y}]})
        for shift in (38, 76, 114, 152, 190, 228, 266):
            touch.send("Input.dispatchTouchEvent", {"type":"touchMove","touchPoints":[{"x":start-shift,"y":y}]})
        touch.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
        phone.wait_for_function("() => document.querySelector('[data-reel-track]').scrollLeft > 280")
        expect(phone).to_have_url(base + "/demo/szukaj")
    finally:
        context.close()
    print(f"All {DEMO_LISTINGS} demo listings on one page; optional full-size reels by keyboard, buttons, mouse and touch")


def load_more_results(page, base, database):
    database = sqlite3.connect(Path(database) / "all4auto.sqlite")
    try:
        with database:
            database.executemany("""INSERT INTO listings(id,scope,user_id,client_key,slug,status,make,model,variant,type,body,fuel,
                gearbox,condition,year,mileage,price,city,region,demo_photo,created_at,updated_at,published_at)
                SELECT ?,scope,user_id,?,?,'published',make,model,?,type,body,fuel,gearbox,condition,year,mileage,?,city,region,demo_photo,
                created_at,updated_at,published_at FROM listings WHERE slug='przyklad-1' AND scope='demo:seed'""",
                [(f"test-feed-{i}", f"test-feed-{i}", f"test-feed-{i}", f"Próba doładowania {i}", 600000000+i) for i in range(1,4)])
        url = base + "/demo/szukaj?condition=used&sort=price_asc"
        page.goto(url)
        page.evaluate("window.feedDocument = true")
        cards = page.locator("[data-search-results] .offer-card")
        expect(cards).to_have_count(DEMO_LISTINGS)
        expect(page.locator("[data-search-count]")).to_have_text(f"Wyniki · {DEMO_LISTINGS + 1}")
        page.get_by_role("link", name="Pokaż więcej ogłoszeń").click()
        expect(cards).to_have_count(DEMO_LISTINGS + 1)
        assert page.evaluate("() => window.feedDocument === true")
        expect(page).to_have_url(url + "&pokaz=2")
        assert len(set(cards.evaluate_all("items => items.map(card => card.id)"))) == DEMO_LISTINGS + 1
        expect(page.locator("[data-search-more]")).to_be_hidden()
        target = page.locator("#oferta-test-feed-3")
        expect(target).to_contain_text("Próba doładowania 3")
        target.locator("h3 a").click()
        expect(page).to_have_url(re.compile(r"/demo/oferta/test-feed-3\?powrot="))
        page.get_by_role("link", name="Wróć do wyników").click()
        expect(page).to_have_url(url + "&pokaz=2#oferta-test-feed-3")
        expect(target).to_be_in_viewport()
        page.reload()
        expect(cards).to_have_count(DEMO_LISTINGS + 1)
        expect(target).to_be_in_viewport()
    finally:
        with database:
            database.execute("DELETE FROM listings WHERE scope='demo:seed' AND id LIKE 'test-feed-%'")
        database.close()
    print("Additional listings append in the same document; filter, sort, reload and back to the opened card")


def check_studio_comparison(page):
    photos = page.locator("[data-photo-grid] .edit-photo")
    original_url = photos.first.locator("img").get_attribute("src")
    viewport = page.viewport_size
    page.set_viewport_size({"width": 390, "height": 844})
    button(photos.first, "Zmień tło").click()
    studio = page.locator("[data-photo-studio]")
    expect(studio).to_be_visible()
    tracer = studio.locator("[data-studio-original]")
    trace = studio.locator("[data-studio-outline]")
    stage = studio.locator("[data-studio-stage]")
    slider = studio.get_by_role("slider", name="Granica porównania przed i po")
    expect(studio.locator("[data-studio-status]")).to_contain_text(re.compile("Sprawdź krawędzie|ręcznie"))
    trace.click()
    expect(tracer).to_be_visible()
    expect(slider).to_be_hidden()
    expect(studio.locator("[data-studio-apply]")).to_be_disabled()
    bounds = tracer.bounding_box()
    for x, y in ((.15, .35), (.85, .35), (.85, .8), (.15, .8)):
        tracer.click(position={"x": bounds["width"] * x, "y": bounds["height"] * y})
    trace.click()
    expect(studio.locator("[data-studio-composition]")).to_be_hidden()
    studio.locator("[data-studio-confirm]").click()
    expect(slider).to_be_visible()
    expect(studio.locator("[data-studio-apply]")).to_be_enabled()
    assert stage.evaluate('''element => {
      const before = element.querySelector('[data-studio-before]');
      const after = element.querySelector('[data-studio-output]');
      return before.width === after.width && before.height === after.height &&
        before.getBoundingClientRect().width === after.getBoundingClientRect().width;
    }''')
    slider.press("Home")
    expect(slider).to_have_value("0")
    slider.press("End")
    expect(slider).to_have_value("100")
    stage.scroll_into_view_if_needed()
    bounds = stage.bounding_box()
    y = bounds["y"] + bounds["height"] * .5
    page.mouse.move(bounds["x"] + bounds["width"] * .75, y)
    page.mouse.down()
    page.mouse.move(bounds["x"] + bounds["width"] * .25, y, steps=5)
    page.mouse.up()
    assert 24 <= int(slider.input_value()) <= 26
    expect(studio.locator("[data-studio-before]")).to_have_css("clip-path", re.compile(r"inset\("))
    button(studio, "Tło 2").click()
    expect(slider).to_have_value(re.compile(r"2[456]"))
    button(studio, "Zastosuj i dodaj kopię").click()
    expect(studio).to_be_hidden()
    expect(photos).to_have_count(4)
    expect(photos.first.locator("img")).to_have_attribute("src", original_url)
    button(photos.last, "Usuń zdjęcie").click()
    expect(photos).to_have_count(3)
    page.set_viewport_size(viewport)


def add_listing_media(page):
    page.locator(".media-editor summary").filter(has_text="Widok 360°").click()
    spin_input = page.locator("[data-spin-input]")
    spin_input.set_input_files([str(ROOT / "public/assets/vehicle-1.webp")])
    expect(page.locator("[data-spin-warning]")).to_be_visible()
    expect(spin_input).to_be_enabled()
    spin_input.set_input_files([str(ROOT / f"public/assets/vehicle-{index}.webp") for index in range(2,9)])
    frames = page.locator("[data-spin-grid] .edit-photo")
    expect(frames).to_have_count(8, timeout=20000)
    expect(page.locator("[data-spin-warning]")).to_be_hidden()
    second = frames.nth(1).locator("img").get_attribute("src")
    button(frames.nth(1), "Przesuń wcześniej").click()
    expect(frames.first.locator("img")).to_have_attribute("src", second)
    page.locator(".media-editor summary").filter(has_text="Wideo").click()
    video_input = page.locator("[data-video-input]")
    video_input.set_input_files({"name":"wrong.txt", "mimeType":"text/plain", "buffer":b"invalid"})
    expect(page.locator("[data-video-errors]")).to_contain_text("MP4")
    video_input.set_input_files(str(ROOT / "test/fixtures/vehicle.webm"))
    expect(page.locator("[data-video-status]")).to_have_text("Dodano")
    expect(button(page, "Dalej")).to_be_enabled()


def check_media_preview(page):
    button(page, "Widok 360°").click()
    expect(page.locator("[data-spin-position]")).to_have_text("1 / 8")
    page.wait_for_function("() => document.querySelector('[data-spin-image]').naturalWidth > 0")
    first = page.locator("[data-spin-image]").get_attribute("src")
    button(page, "Następna klatka").click()
    expect(page.locator("[data-spin-position]")).to_have_text("2 / 8")
    expect(page.locator("[data-spin-image]")).not_to_have_attribute("src", first)
    stage = page.locator(".spin-stage")
    stage.press("ArrowLeft")
    expect(page.locator("[data-spin-position]")).to_have_text("1 / 8")
    stage.scroll_into_view_if_needed()
    box = stage.bounding_box()
    x, y = box["x"] + box["width"] * .8, box["y"] + box["height"] * .5
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x - box["width"] * .5, y, steps=8)
    page.mouse.up()
    expect(page.locator("[data-spin-position]")).not_to_have_text("1 / 8")
    viewer = page.locator(".spin-viewer")
    viewer.locator("[data-spin-zoom]").click()
    expect(stage).to_have_class(re.compile("is-zoomed"))
    viewer.locator("[data-spin-reset]").click()
    expect(viewer.locator("[data-spin-position]")).to_have_text("1 / 8")
    expect(viewer.locator("[data-spin-zoom]")).to_have_attribute("aria-pressed", "false")
    play = viewer.locator("[data-spin-play]")
    play.click()
    expect(viewer.locator("[data-spin-position]")).not_to_have_text("1 / 8")
    play.click()
    expect(play).to_have_attribute("aria-pressed", "false")
    fullscreen = viewer.locator("[data-spin-fullscreen]")
    fullscreen.click()
    expect(fullscreen).to_have_attribute("aria-pressed", "true")
    fullscreen.click()
    expect(fullscreen).to_have_attribute("aria-pressed", "false")
    page.locator("[data-media-tab=video]").click()
    player = page.locator("[data-listing-video]")
    expect(player).to_be_visible()
    page.wait_for_function("() => document.querySelector('[data-listing-video]').readyState >= 1")
    player.evaluate("video => { video.muted = true; return video.play(); }")
    page.wait_for_function("() => document.querySelector('[data-listing-video]').currentTime > .15")
    button(page, "Zdjęcia").click()
    expect(player).to_be_hidden()
    assert player.evaluate("video => video.paused")


def touch_spin(browser, context, offer_url):
    mobile = browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True,
                                 storage_state=context.storage_state())
    try:
        phone = mobile.new_page()
        phone.goto(offer_url)
        button(phone, "Widok 360°").click()
        stage = phone.locator(".spin-stage")
        stage.scroll_into_view_if_needed()
        box = stage.bounding_box()
        x, y = round(box["x"] + box["width"] * .85), round(box["y"] + box["height"] * .46)
        touch = mobile.new_cdp_session(phone)
        touch.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{"x":x,"y":y}]})
        for shift in (22, 46, 71, 95, 118):
            touch.send("Input.dispatchTouchEvent", {"type":"touchMove","touchPoints":[{"x":x-shift,"y":y}]})
        touch.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
        expect(phone.locator("[data-spin-position]")).not_to_have_text("1 / 8")
        expect(phone).to_have_url(offer_url)
    finally:
        mobile.close()


ADVERTISEMENTS = (
    ("all4rent-rental-banner.jpg", "https://all4rent.app/"),
    ("jcb-rental-banner.png", None),
    ("fazicars-banner.png", "https://fazicars.pl/"),
    ("cars-collection-banner.png", "https://carscollection.pl/"),
    ("cars-rent-banner.png", "https://cars-rent.pl/"),
    ("rankomat-banner.png", "https://rankomat.pl/brand"),
    ("jet-partner-banner.png", "https://jetpartner.pl/wynajem-odrzutowcow/"),
    ("all4rent-advertise-banner.png", "https://all4rent.app/?contact=1&topic=Reklama%20banerowa"),
)


def pause_ad_clock(page):
    # Leave ample virtual time for the pause to take effect before navigating.
    page.clock.install(time=datetime(2026, 11, 13, 12, 0, tzinfo=timezone.utc))
    page.clock.pause_at(datetime(2026, 11, 13, 13, 0, tzinfo=timezone.utc))


def ad_geometry(banner):
    assert banner.evaluate("""carousel => {
      const stage = carousel.querySelector('[data-ad-stage]').getBoundingClientRect();
      const active = carousel.querySelector('[data-ad-slide]:not([hidden])');
      const image = active.querySelector('.ad-carousel-image');
      const art = image || active.querySelector('.ad-carousel-house-art');
      const box = art.getBoundingClientRect();
      const inside = element => {
        const r = element.getBoundingClientRect();
        return r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1
          && r.left >= stage.left - 1 && r.right <= stage.right + 1;
      };
      return Math.abs(box.width - 3 * box.height) < 1
        && Math.abs(carousel.getBoundingClientRect().height - stage.height) <= 1
        && Math.abs(stage.height - box.height) <= 1
        && (!image || getComputedStyle(image).objectFit === 'contain')
        && [...carousel.querySelectorAll('.ad-carousel-control,.ad-carousel-status')].every(inside)
        && [...carousel.querySelectorAll('.ad-carousel-control')].every(button =>
          button.offsetWidth >= 44 && button.offsetHeight >= 44 && button.querySelector('svg').clientWidth <= 16);
    }""")


def ad_carousel(browser, base):
    with browser.new_context(viewport={"width": 1440, "height": 940}) as context:
        page = context.new_page()
        pause_ad_clock(page)
        page.goto(base + "/demo")
        banner = page.locator("[data-ad-carousel]")
        slides = banner.locator("[data-ad-slide]")
        active = banner.locator("[data-ad-slide]:not([hidden])")
        dots = banner.locator("[data-ad-dot]")
        position = banner.locator("[data-ad-position]")
        forward = banner.locator("[data-ad-forward]")
        previous = banner.locator("[data-ad-previous]")
        expect(dots).to_have_count(9)
        expect(position).to_have_text("1 / 9")
        page.clock.run_for(2999)
        expect(banner).not_to_have_attribute("data-collapsed", "")
        page.clock.run_for(1)
        expect(banner).to_have_attribute("data-collapsed", "")
        assert banner.bounding_box()["height"] == 54
        page.clock.run_for(3500)
        expect(position).to_have_text("2 / 9")
        banner.locator("[data-ad-stage]").hover()
        expect(banner).not_to_have_attribute("data-collapsed", "")
        page.clock.run_for(6600)
        expect(position).to_have_text("2 / 9")
        for i, slide in enumerate(slides.all()):
            dots.nth(i).click()
            expect(dots.nth(i)).to_have_attribute("aria-current", "true")
            expect(position).to_have_text(f"{i+1} / 9")
            ad_geometry(banner)
            if slide.get_attribute("data-banner-id") == "brumbrum":
                expect(active.locator(".ad-carousel-house-link")).to_have_attribute("href", "/demo/sprzedaj")
                expect(active.locator(".ad-carousel-house-contact")).to_have_attribute("href", "/demo/reklama")
                expect(active.locator(".ad-carousel-house-contact")).to_be_visible()
            else:
                photo = active.locator(".ad-carousel-image")
                file = Path(photo.get_attribute("src")).name
                assert file in dict(ADVERTISEMENTS)
                assert photo.get_attribute("alt").strip()
                assert photo.evaluate("async image => { await image.decode(); return image.naturalWidth === image.naturalHeight * 3; }")
                url = dict(ADVERTISEMENTS)[file]
                if url:
                    expect(active.locator("a")).to_have_attribute("href", url)
                    expect(active.locator("a")).to_have_attribute("rel", "noopener noreferrer")
                else:
                    expect(active.locator("a")).to_have_count(0)
        dots.last.click()
        forward.focus()
        page.keyboard.press("Enter")
        expect(position).to_have_text("1 / 9")
        previous.click()
        expect(position).to_have_text("9 / 9")
        if OUTPUT:
            banner.screenshot(path=str(Path(OUTPUT) / "ads-desktop.png"))

    for width, height in [(390, 844), (1024, 1366)]:
        with browser.new_context(viewport={"width": width, "height": height}, is_mobile=True, has_touch=True) as context:
            page = context.new_page()
            page.goto(base)
            banner = page.locator("[data-ad-carousel]")
            rotation = banner.locator("[data-ad-rotation]")
            rotation.tap()
            expect(rotation).to_have_attribute("aria-label", "Wznów automatyczną zmianę reklam")
            expect(banner.locator(".ad-carousel-dots")).to_be_hidden()
            ad_geometry(banner)
            expect(banner).not_to_have_attribute("data-collapsed", "")
            forward = banner.locator("[data-ad-forward]")
            previous = banner.locator("[data-ad-previous]")
            forward.tap()
            expect(banner.locator("[data-ad-position]")).to_have_text("2 / 9")
            previous.tap()
            expect(banner.locator("[data-ad-position]")).to_have_text("1 / 9")
            # Capture intent without leaving the fixture or making a request to the advertiser.
            page.evaluate("""() => {
                window.adClicks = [];
                document.addEventListener('click', e => {
                    const link = e.target.closest('[data-banner-click]');
                    if (link && !e.defaultPrevented) {window.adClicks.push(link.href);e.preventDefault();}
                });
            }""")
            touch = context.new_cdp_session(page)
            stage = banner.locator("[data-ad-stage]")
            stage.evaluate("el => el.scrollIntoView({block:'center'})")

            def swipe(direction, cancel=False):
                box = stage.bounding_box()
                x, y = round(box["x"] + box["width"] / 2), round(box["y"] + box["height"] * .5)
                touch.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{"x":x,"y":y}]})
                for offset in (15, 35, 65, 90):
                    touch.send("Input.dispatchTouchEvent", {"type":"touchMove","touchPoints":[{"x":x + direction*offset,"y":y}]})
                assert stage.evaluate("""stage => {
                    const current = stage.querySelector('[data-ad-slide]:not([hidden])').getBoundingClientRect();
                    const neighbor = stage.querySelector('[data-ad-peek]').getBoundingClientRect();
                    const frame = stage.getBoundingClientRect();
                    return Math.abs(current.x - frame.x) > 60 && neighbor.right > frame.left && neighbor.left < frame.right;
                }""")
                touch.send("Input.dispatchTouchEvent", {"type":"touchCancel" if cancel else "touchEnd","touchPoints":[]})
                expect(stage.locator("[data-ad-peek]")).to_have_count(0)

            swipe(1)
            expect(banner.locator("[data-ad-position]")).to_have_text("9 / 9")
            swipe(-1)
            expect(banner.locator("[data-ad-position]")).to_have_text("1 / 9")
            swipe(-1, cancel=True)
            expect(banner.locator("[data-ad-position]")).to_have_text("1 / 9")
            assert page.evaluate("window.adClicks") == []
            assert context.pages == [page]
            ids = banner.locator("[data-ad-slide]").evaluate_all("items => items.map(item => item.dataset.bannerId)")
            for _ in range(ids.index("all4rent-rental")):
                forward.tap()
            active = banner.locator('[data-ad-slide]:not([hidden]) .ad-carousel-image')
            active.tap(position={"x": round(active.bounding_box()["width"] / 2), "y": round(active.bounding_box()["height"] / 2)})
            assert page.evaluate("window.adClicks") == ["https://all4rent.app/"]
            if OUTPUT:
                banner.screenshot(path=str(Path(OUTPUT) / f"ads-{width}.png"))
            before = page.evaluate("scrollY")
            current = banner.locator("[data-ad-position]").inner_text()
            box = stage.bounding_box()
            x, y = round(box["x"] + box["width"] / 2), round(box["y"] + box["height"] / 2)
            touch.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{"x":x,"y":y}]})
            for delta in (20, 60, 100, 125):
                touch.send("Input.dispatchTouchEvent", {"type":"touchMove","touchPoints":[{"x":x+3,"y":y-delta}]})
            touch.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
            expect(banner.locator("[data-ad-position]")).to_have_text(current)
            assert page.evaluate("scrollY") > before
            assert page.evaluate("window.adClicks") == ["https://all4rent.app/"]

    with browser.new_context(viewport={"width": 1440, "height": 940}, reduced_motion="reduce") as context:
        page = context.new_page()
        pause_ad_clock(page)
        page.goto(base)
        banner = page.locator("[data-ad-carousel]")
        page.clock.run_for(14000)
        expect(banner).not_to_have_attribute("data-collapsed", "")
        expect(banner.locator("[data-ad-position]")).to_have_text("1 / 9")
        banner.locator("[data-ad-stage]").hover()
        banner.locator("[data-ad-dot]").last.click()
        expect(banner.locator("[data-ad-position]")).to_have_text("9 / 9")
    print("Nine ads, overlay geometry, direct taps, horizontal swipes in both directions and natural vertical scroll verified")


def mobile_account_icons(browser, base, database):
    token = "a" * 64
    user = "mobile-icon-regression"
    date = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(Path(database) / "all4auto.sqlite") as db:
        db.execute("INSERT INTO users(id,scope,email,name,profile_type,verified_at,created_at) VALUES(?,'live',?,?,'private',?,?)",
                   (user, "mobile-icons@example.test", "Test ikon", date, date))
        db.execute("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)",
                   (sha256(token.encode()).hexdigest(), user, "9999-01-01T00:00:00.000Z"))
        db.execute("INSERT INTO notifications(id,user_id,kind,created_at) VALUES(?,?,'archived',?)",
                   ("mobile-icon-notice", user, date))
    with browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True) as context:
        context.add_cookies([{"name": "a4_session", "value": token, "url": base}])
        page = context.new_page()
        for width in (320, 390):
            page.set_viewport_size({"width": width, "height": 844})
            page.goto(base + "/konto")
            expect(page.locator(".account-dashboard .count").first).to_have_text("1")
            assert page.locator(".account-menu-row:visible").evaluate_all('''rows => rows.every(row => {
              const rowBox = row.getBoundingClientRect();
              const icon = row.querySelector('.account-menu-icon > .ui-icon').getBoundingClientRect();
              const end = row.querySelector('.account-menu-end').getBoundingClientRect();
              const label = row.querySelector('.account-menu-copy').getBoundingClientRect();
              return icon.width >= 40 && icon.right < label.left && label.right <= end.left &&
                end.right <= rowBox.right && rowBox.right <= document.documentElement.clientWidth;
            })''')
            expect(page.locator("#zdjecia-profilu summary .account-menu-end > .ui-icon")).to_have_css("width", "26px")
            page.locator("#zdjecia-profilu summary").tap()
            expect(page.locator("#zdjecia-profilu .asset-form .btn > .ui-icon")).to_have_css("width", "33px")
            expect(page.locator("#zdjecia-profilu button[form=account-profile] > .ui-icon")).to_have_css("width", "33px")
            expect(page.locator(".bottom-nav .ui-icon").first).to_have_css("width", "44px")

            for path, selectors in (
                ("/wiadomosci", {".page-head .btn > .ui-icon": "33px", ".empty .btn > .ui-icon": "33px", ".empty-icon > .ui-icon": "46px"}),
                ("/porownanie", {".page-head .btn > .ui-icon": "33px", ".empty-icon > .ui-icon": "46px"}),
                ("/powiadomienia", {".page-head .btn > .ui-icon": "33px", ".notice .mini-icon > .ui-icon": "38px"}),
            ):
                page.goto(base + path)
                for selector, size in selectors.items():
                    expect(page.locator(selector).first).to_have_css("width", size)
                assert page.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth"), (path, width)

        page.set_viewport_size({"width": 1440, "height": 940})
        page.goto(base + "/konto")
        expect(page.locator(".account-menu-row>.account-menu-icon>.ui-icon").first).to_have_css("width", "30px")
        page.goto(base + "/powiadomienia")
        expect(page.locator(".notice .mini-icon>.ui-icon")).to_have_css("width", "21px")
    print("Mobile account, inbox, comparison and notice icons at 320 and 390 px; desktop sizes preserved")


def run(browser, base, database, server):
    language_options(browser, base)
    ad_carousel(browser, base)
    vehicle_search_options(browser, base)
    account_menu(browser, base)
    mobile_account_icons(browser, base, database)
    device_views(browser, base)
    compact_profile_navigation(browser, base)
    landscape_tablet_navigation(browser, base)
    context = browser.new_context(viewport={"width": 1440, "height": 940}, timezone_id="Europe/Warsaw")
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(base + "/demo")
    expect(page.get_by_role("heading", name="Znajdź samochód dla siebie", exact=True)).to_be_visible()
    if OUTPUT:
        page.screenshot(path=str(Path(OUTPUT) / "desktop.png"))
    rail_theme = page.locator(".side-nav [data-side-theme-picker]")
    open_profile(page)
    rail_theme.locator("summary").click()
    rail_theme.get_by_text("Granatowy", exact=True).click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    expect(page.locator(".side-nav")).to_have_css("backdrop-filter", "blur(16px) saturate(0.75)")
    rail_theme.get_by_text("Biały", exact=True).click()
    page.keyboard.press("Escape")
    expect(page.locator("html")).to_have_attribute("data-theme", "light")
    print("Desktop theme control")

    for width, height in [(360, 800), (390, 844), (768, 1024), (1024, 768), (1041, 768), (1440, 940), (1920, 1080), (2560, 1440)]:
        page.set_viewport_size({"width": width, "height": height})
        page.goto(base + "/demo")
        page.evaluate("document.fonts.ready")
        nav_geometry(page, width)
        category_directory(page, "/demo")
        if OUTPUT and width in (390, 1024, 1440):
            for kind in ("car", "truck", "construction"):
                section = page.locator(f'#kategorie > section[data-catalog-type="{kind}"]')
                section.locator("img").evaluate_all("async images => { for (const i of images) i.loading='eager'; await Promise.all(images.map(i=>i.decode())); }")
                section.screenshot(path=str(Path(OUTPUT) / f"{kind}-{width}.png"))
        if width in (390, 1440):
            if width == 390:
                page.get_by_role("link", name="Wszystkie kategorie", exact=True).click()
            else:
                open_profile(page)
                page.locator(".side-nav").get_by_role("link", name="Kategorie", exact=True).click()
            expect(page).to_have_url(base + "/demo#kategorie")
            expect(page.get_by_role("heading", name="Wszystkie kategorie", exact=True)).to_be_in_viewport()
            if OUTPUT:
                page.screenshot(path=str(Path(OUTPUT) / f"categories-{width}.png"))
        page.goto(base + "/demo/szukaj")
        nav_geometry(page, width)
        top_filters(page)
        reel_geometry(page, width)
        card_geometry(page)
        if width <= 700:
            page.locator("[data-filter-open-button]").click()
            expect(page.get_by_role("dialog", name="Filtry zaawansowane")).to_be_visible()
            page.keyboard.press("Escape")
            expect(page.locator("[data-filter-panel]")).to_be_hidden()
        elif width == 1440:
            toggle = page.locator("[data-filter-open-button]")
            toggle.click()
            expect(page.locator("[data-filter-panel] select[name=fuel]")).to_be_visible()
            page.locator("[data-filter-panel] select[name=fuel]").select_option("electric")
            button(page.locator("[data-filter-panel]"), "Pokaż wyniki").click()
            expect(page).to_have_url(base + "/demo/szukaj?fuel=electric")
            expect(page.locator("[data-search-count]")).to_have_text("Wyniki · 7")
        page.goto(base + "/demo/oferta/przyklad-1")
        page.emulate_media(reduced_motion="reduce")
        nav_geometry(page, width)
        detail_geometry(page, width)
        expect(page.locator("[data-gallery-image]")).to_be_visible()
        if OUTPUT and width == 1440:
            page.screenshot(path=str(Path(OUTPUT) / "detail.png"))
        if OUTPUT and width == 390:
            page.screenshot(path=str(Path(OUTPUT) / "detail-mobile.png"))
        if width == 768:
            page.goto(base + "/demo/oferta/przyklad-13")
            detail_geometry(page, width, "Yamaha MT-07", "13")
            if OUTPUT:
                page.screenshot(path=str(Path(OUTPUT) / "yamaha-tablet.png"))
            button(page.locator(".gallery-thumbs"), "Zdjęcie 2").click()
            expect(page.locator("[data-gallery-image]")).to_have_attribute("src", "/assets/showcase-hd/13-rear.webp")
        if width in (360, 1041, 1920, 2560):
            page.goto(base + "/")
            nav_geometry(page, width)
            expect(page.locator(".head-demo" if width <= 1040 else ".head-profile").first).to_be_in_viewport(ratio=1)
        print(f"Responsive Huracán home, top filters, results, detail and navigation: {width}×{height}")

    page.set_viewport_size({"width":1440,"height":940})
    mobile_listing(browser, base)
    with browser.new_context(viewport={"width":1440,"height":940}) as logo_context:
        desktop_collection_logo(logo_context.new_page(), base)
    side_navigation(page, base)
    side_navigation_sound(browser, base)
    gallery_slideshow(browser, base, page)
    sliding_offer_panel(browser, base)
    mobile_photo_view(browser, base)
    page.goto(base + "/demo/oferta/przyklad-29")
    detail_geometry(page, 1440, "Ferrari 488 GTB", "29")
    description = page.locator(".offer-section").first
    description.locator("summary").click()
    expect(description.locator(".prose")).to_contain_text("Rosso Corsa")
    if OUTPUT:
        page.locator(".gallery-controls").scroll_into_view_if_needed()
        page.screenshot(path=str(Path(OUTPUT) / "ferrari-gallery.png"))
    footer_geometry(page, base)
    browse_reels(browser, base, page)
    load_more_results(page, base, database)
    page.set_viewport_size({"width":1920,"height":1080})
    for route in ("/zaloguj", "/demo/zaloguj", "/pomoc", "/reklama", "/kontakt"):
        page.goto(base + route)
        nav_geometry(page, 1920)
        assert page.locator("main > .wrap").first.evaluate("wrap => wrap.getBoundingClientRect().width >= innerWidth - 124"), route
    page.goto(base + "/demo/oferta/przyklad-1")
    button(page, "Powiększ zdjęcie").click()
    lightbox = page.locator("[data-lightbox]")
    expect(lightbox).to_be_visible()
    assert lightbox.evaluate("dialog => dialog.getBoundingClientRect().width >= innerWidth - 60")
    page.keyboard.press("Escape")
    actions = page.locator(".detail-tools")
    favorite = button(actions, "Ulubione")
    favorite.click()
    expect(favorite).to_have_attribute("aria-pressed", "true")
    favorite.click()
    expect(favorite).to_have_attribute("aria-pressed", "false")
    compare = button(actions, "Porównaj")
    compare.click()
    expect(page.locator("[data-compare-tray] a")).to_have_attribute("href", "/demo/porownanie")
    compare.click()
    expect(page.locator("[data-compare-tray]")).to_be_hidden()
    print("Edge-to-edge sign-in, help, contact, advertising and full photo dialog at 1920 px")
    print("Showcase glass controls keep favorite and comparison actions functional")
    page.set_viewport_size({"width":1440,"height":940})
    page.goto(base + "/demo#kategorie")
    page.locator("#kategorie img").evaluate_all("images => images.forEach(image => image.loading = 'eager')")
    page.wait_for_function("""() => [...document.querySelectorAll('#kategorie img')]
      .every(image => image.complete && image.naturalWidth > 0)""")
    page.goto(base + "/demo#samochody-osobowe")
    passenger_type = page.locator('a.catalog-type-tile[data-vehicle-type="car"]')
    expect(passenger_type).to_be_in_viewport()
    passenger_type.click()
    expect(page).to_have_url(base + "/demo/szukaj?type=car")
    page.go_back()
    page.locator("#kategorie").get_by_role("link", name="SUV", exact=True).click()
    expect(page).to_have_url(base + "/demo/szukaj?type=car&body=suv")
    expect(page.locator(".results-head h2")).to_have_text("Wyniki · 5")
    page.go_back()
    expect(page).to_have_url(base + "/demo#samochody-osobowe")
    page.reload()
    page.locator("#kategorie").get_by_role("link", name="Liftback", exact=True).click()
    expect(page).to_have_url(base + "/demo/szukaj?type=car&body=liftback")
    expect(page.locator(".active-filters")).to_contain_text("Liftback")
    expect(page.locator(".offer-card")).to_have_count(1)
    expect(page.locator(".offer-card")).to_contain_text("Škoda Superb")
    page.goto(base + "/demo/oferta/przyklad-45")
    detail_geometry(page, 1440, "Škoda Superb", "45")
    page.goto(base + "/demo")
    home_search = page.locator("#filtry-pojazdow")
    button(home_search, "Filtry pojazdów").click()
    home_search.locator(".category-shortcuts").get_by_role("button", name="Elektryczne", exact=True).click()
    button(home_search.locator("[data-filter-panel]"), "Szukaj pojazdów").click()
    expect(page).to_have_url(base + "/demo/szukaj?fuel=electric")
    expect(page.locator(".active-filters")).to_contain_text("Elektryczny")
    page.goto(base + "/demo#kategorie")
    page.locator("#kategorie").get_by_role("link", name="Furgon", exact=True).click()
    expect(page).to_have_url(base + "/demo/szukaj?type=van&body=panel")
    expect(page.locator(".offer-card")).to_have_count(1)
    expect(page.locator(".offer-card")).to_contain_text("Ford Transit")
    single_result_geometry(page)
    page.goto(base + "/demo#kategorie")
    page.locator('a.catalog-type-tile[data-vehicle-type="quad"]').click()
    expect(page).to_have_url(base + "/demo/szukaj?type=quad")
    expect(page.locator(".offer-card")).to_have_count(3)
    expect(page.locator(".offer-card").filter(has_text="CFMOTO CFORCE 520")).to_be_visible()
    page.goto(base + "/demo#kategorie")
    page.locator("#kategorie").get_by_role("link", name="Ciągniki siodłowe (TIR)", exact=True).click()
    expect(page).to_have_url(base + "/demo/szukaj?type=truck&body=tractor")
    expect(page.locator(".offer-card")).to_have_count(1)
    expect(page.locator(".offer-card")).to_contain_text("MAN TGX")
    page.goto(base + "/demo#kategorie")
    page.locator("#kategorie").get_by_role("link", name="Naczepy", exact=True).click()
    expect(page).to_have_url(base + "/demo/szukaj?type=trailer&body=semi_trailer")
    expect(page.locator(".active-filters")).to_contain_text("Naczepa")
    expect(page.locator(".offer-card")).to_contain_text("Schmitz Cargobull S.CS")
    page.goto(base + "/demo#odmiany-rekreacyjne")
    page.locator('#kategorie a[href="/demo/szukaj?type=quad&body=atv_utility"]').click()
    expect(page).to_have_url(base + "/demo/szukaj?type=quad&body=atv_utility")
    expect(page.locator(".offer-card")).to_contain_text("CFMOTO CFORCE 520")
    page.goto(base + "/?lang=en#kategorie")
    expect(page.get_by_role("heading", name="All categories", exact=True)).to_be_visible()
    for width in (320, 768, 1024, 1440):
        page.set_viewport_size({"width": width, "height": 940})
        category_directory(page, "")
    page.goto(base + "/demo?lang=pl#kategorie")
    page.set_viewport_size({"width": 320, "height": 800})
    category_directory(page, "/demo")
    print("All vehicle sections, photographic variants, distinct filters, image loading and category navigation verified")

    page.set_viewport_size({"width": 768, "height": 1024})
    page.goto(base + "/demo/szukaj")
    filters = page.locator("[data-filter-panel]")
    toggle = page.locator("[data-filter-open-button]")
    results = page.locator(".search-main")
    before = results.bounding_box()["y"]
    toggle.click()
    expect(filters).to_be_visible()
    expect(filters).to_have_css("position", "static")
    expect(page.get_by_role("dialog", name="Filtry zaawansowane")).to_have_count(0)
    assert results.bounding_box()["y"] > before
    filters.locator("select[name=fuel]").select_option("electric")
    page.set_viewport_size({"width": 1024, "height": 768})
    nav_geometry(page, 1024)
    expect(filters).to_have_css("position", "static")
    expect(filters.locator("select[name=fuel]")).to_have_value("electric")
    page.keyboard.press("Escape")
    expect(filters).to_be_hidden()
    toggle.click()
    expect(filters.locator("select[name=fuel]")).to_have_value("electric")
    button(filters, "Pokaż wyniki").click()
    expect(page).to_have_url(base + "/demo/szukaj?fuel=electric")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(base + "/demo")
    mobile_filter_font = page.locator(".quick-fields select[name=type]").evaluate("control => getComputedStyle(control).fontSize")
    page.locator(".quick-fields input[name=city]").focus()
    page.set_viewport_size({"width": 390, "height": 550})
    expect(page.locator(".bottom-nav")).to_be_hidden()
    expect(page.locator(".quick-fields input[name=city]")).to_be_focused()
    page.locator(".quick-fields input[name=city]").fill("Warszawa")
    page.locator("h1").click()
    page.set_viewport_size({"width": 390, "height": 844})
    expect(page.locator(".bottom-nav")).to_be_visible()
    print("Tablet filter rotation and keyboard-sized viewport")

    page.set_viewport_size({"width": 1440, "height": 940})
    page.goto(base + "/demo/szukaj?make=Toyota&model=Corolla&fuel=hybrid")
    expect(page.locator(".results-head h2")).to_have_text("Wyniki · 1")
    page.get_by_role("link", name="Toyota Corolla", exact=True).last.click()
    expect(page).to_have_url(re.compile(r"/demo/oferta/przyklad-2\?powrot="))
    page.go_back()
    expect(page).to_have_url(re.compile(r"make=Toyota&model=Corolla&fuel=hybrid"))
    page.reload()
    expect(page.locator('select[name="model"]')).to_have_value("Corolla")
    page.locator("[data-filter-make]").select_option("BMW")
    expect(page.locator("[data-filter-model]")).to_have_value("")
    page.goto(base + "/demo/szukaj?sort=price_asc")
    expect(page.locator(".offer-card")).to_have_count(DEMO_LISTINGS)
    page.locator(".offer-card [data-favorite]").first.click()
    expect(page.locator(".offer-card [data-favorite]").first).to_have_attribute("aria-pressed", "true")
    for i in range(4):
        page.locator(".offer-card [data-compare]").nth(i).click()
    expect(page.locator("[data-compare-tray]")).to_contain_text("4/4")
    page.locator(".offer-card [data-compare]").nth(4).click()
    expect(page.locator("[data-toast]")).to_contain_text("maksymalnie cztery")
    page.locator("[data-compare-tray] a").click()
    expect(page.locator(".compare-table")).to_be_visible()
    assert page.locator("[data-remove-compare]").count() == 4
    page.locator("[data-remove-compare]").first.click()
    expect(page.locator("[data-remove-compare]")).to_have_count(3)
    page.set_viewport_size({"width": 360, "height": 800})
    scroll = page.locator(".compare-scroll")
    expect(page.locator(".compare-scroll-hint")).to_be_visible()
    assert scroll.evaluate("el => el.scrollWidth > el.clientWidth")
    for count in (2, 1):
        page.locator("[data-remove-compare]").first.click()
        expect(page.locator("[data-remove-compare]")).to_have_count(count)
        assert scroll.evaluate("el => el.scrollWidth <= el.clientWidth")
        assert page.locator(".compare-photo").first.evaluate("el => el.offsetHeight <= 100")
    nav_geometry(page, 360)
    page.set_viewport_size({"width": 1440, "height": 940})
    page.goto(base + "/demo/ulubione")
    expect(page.locator(".offer-card")).to_have_count(1)
    print("URL filters, Back and reload, dependent models, favorites and four-car compare")

    def choose(role, target="/demo/konto"):
        page.goto(base + "/demo/zaloguj?dalej=" + target)
        button(page, "Wybierz rolę · " + role).click()
        expect(page).to_have_url(base + target)

    page.set_viewport_size({"width": 390, "height": 844})
    choose("Sprzedawca", "/demo/sprzedaj")
    button(page, "Rozpocznij ogłoszenie").click()
    expect(page.locator("[data-wizard]")).to_be_visible()
    expect(page.locator("select[name=type]")).to_have_css("font-size", mobile_filter_font)
    expect(page.locator("input[name=make]")).to_have_css("font-size", mobile_filter_font)
    listing = page.locator("[data-wizard]").get_attribute("data-wizard")
    page.locator('select[name=type]').select_option("quad")
    expect(page.locator('input[name=hours]')).to_be_visible()
    page.locator('select[name=body]').select_option("atv_utility")
    page.locator('select[name=type]').select_option("trailer")
    expect(page.locator('select[name=body]')).to_have_value("")
    expect(page.locator('input[name=mileage]')).to_be_hidden()
    page.locator('select[name=body]').select_option("semi_trailer")
    button(page, "Dalej").click()
    expect(page.locator('input[name=grossWeight]')).to_be_visible()
    expect(page.locator('select[name=fuel]')).to_be_disabled()
    expect(page.locator('input[name=power]')).to_be_hidden()
    button(page, "Wstecz").click()
    page.locator('select[name=type]').select_option("truck")
    page.locator('select[name=body]').select_option("tractor")
    page.locator('select[name=body]').select_option("dump_truck")
    page.locator('select[name=type]').select_option("construction")
    page.locator('select[name=body]').select_option("crane")
    expect(page.locator('input[name=hours]')).to_be_visible()
    page.locator('select[name=type]').select_option("car")
    expect(page.locator('input[name=hours]')).to_be_hidden()
    page.locator('select[name=body]').select_option("liftback")
    page.locator('select[name=type]').select_option("truck")
    expect(page.locator('select[name=body]')).to_have_value("")
    expect(page.locator('select[name=body] option[value=liftback]')).to_have_count(0)
    page.locator('select[name=type]').select_option("car")
    label(page, "Marka").fill("Toyota")
    label(page, "Model").fill("Corolla")
    label(page, "Wersja").fill("Przeglądarka QA")
    page.locator('input[name=year]').fill("2022")
    page.locator('input[name=mileage]').fill("42000")
    page.locator('select[name=body]').select_option("wagon")
    page.locator('input[name=vin]').fill("ZZZ-TEST 0000000001")
    button(page, "Dalej").click()
    expect(page.get_by_role("heading", name="Parametry i wyposażenie")).to_be_visible()
    expect(page.locator("select[name=fuel]")).to_have_css("font-size", mobile_filter_font)
    expect(page.locator("textarea[name=description]")).to_have_css("font-size", mobile_filter_font)
    for key, value in [("fuel", "hybrid"), ("gearbox", "auto"), ("drive", "fwd"), ("damage", "no")]:
        page.locator(f'select[name={key}]').select_option(value)
    page.locator("input[name=power]").fill("122")
    page.locator("textarea[name=description]").fill("Przykładowe ogłoszenie ALL4AUTO. " * 9 + "Koniec opisu testowego.")
    button(page, "Dalej").click()
    expect(page.get_by_role("heading", name="Zdjęcia", exact=True)).to_be_visible()
    files = [str(ROOT / f"public/assets/vehicle-{i}.webp") for i in (1, 2, 3)]
    photo_input = page.locator("[data-photo-input]")
    photo_input.set_input_files(files)
    expect(page.locator(".edit-photo")).to_have_count(3, timeout=14000)
    check_studio_comparison(page)
    photo_input.set_input_files({"name":"bad.txt", "mimeType":"text/plain", "buffer":b"not an image"})
    expect(page.locator("[data-photo-errors]")).to_contain_text("Wybierz plik JPEG")
    photo_input.set_input_files({"name":"too-large.jpg", "mimeType":"image/jpeg", "buffer":b"x" * (13 * 1024 * 1024)})
    expect(page.locator("[data-photo-errors]")).to_contain_text("12 MB")
    cover2 = page.locator(".edit-photo").nth(1).locator("img").get_attribute("src")
    page.locator(".edit-photo").nth(1).get_by_role("button", name="Ustaw jako główne").click()
    expect(page.locator(".edit-photo").first.locator("img")).to_have_attribute("src", cover2)
    page.locator(".edit-photo").last.get_by_role("button", name="Przesuń wcześniej").click()
    page.locator(".edit-photo").last.get_by_role("button", name="Usuń zdjęcie").click()
    expect(page.locator(".edit-photo")).to_have_count(2)
    add_listing_media(page)
    button(page, "Dalej").click()
    expect(page.locator("select[name=contact]")).to_have_css("font-size", mobile_filter_font)
    expect(page.locator("input[name=listingPhone]")).to_have_css("font-size", mobile_filter_font)
    page.locator("input[name=price]").fill("71500")
    page.locator("input[name=city]").fill("Poznań")
    page.locator("input[name=region]").fill("Wielkopolskie")
    button(page, "Zapisz szkic").click()
    expect(page.locator("[data-save-status]")).to_contain_text("Szkic zapisany")
    page.reload()
    expect(page.locator("input[name=price]")).to_have_value("71500")
    expect(page.locator("input[name=variant]")).to_have_value("Przeglądarka QA")
    button(page, "Dalej").click()
    button(page, "Otwórz pełny podgląd").click()
    expect(page).to_have_url(base + "/demo/podglad/" + listing)
    description = page.locator(".offer-section").filter(has_text="Opis sprzedawcy")
    expect(description.locator(".prose")).to_be_hidden()
    description.locator("summary").click()
    expect(description.locator(".prose")).to_contain_text("Koniec opisu testowego")
    description.locator("summary").click()
    expect(page.locator("[data-gallery-count]")).to_have_text("1 / 2")
    page.locator(".gallery-controls [data-gallery-next]").click()
    expect(page.locator("[data-gallery-count]")).to_have_text("2 / 2")
    button(page, "Powiększ zdjęcie").click()
    expect(page.locator("[data-lightbox]")).to_be_visible()
    page.keyboard.press("Escape")
    check_media_preview(page)
    button(page, "Prześlij ogłoszenie").click()
    expect(page).to_have_url(base + "/demo/moje-ogloszenia")
    expect(page.get_by_text("Oczekuje na moderację", exact=True)).to_be_visible()

    choose("Moderator", "/demo/moderacja")
    page.get_by_role("link", name="Otwórz całą ofertę").click()
    expect(page.locator("[data-gallery-count]")).to_have_text("1 / 2")
    expect(button(page, "Widok 360°")).to_be_visible()
    expect(button(page, "Wideo")).to_be_visible()
    button(page, "Zatwierdź ofertę").click()
    expect(page).to_have_url(base + "/demo/moderacja")
    page.goto(base + "/demo/szukaj?q=Przegl%C4%85darka%20QA")
    expect(page.locator(".results-head h2")).to_have_text("Wyniki · 1")
    href = page.locator(".offer-image a").get_attribute("href").split("?")[0]
    choose("Kupujący", href)
    expect(button(page, "Widok 360°")).to_be_visible()
    expect(button(page, "Wideo")).to_be_visible()
    touch_spin(browser, context, page.url)
    vin_section = page.locator("#sprawdz-vin")
    expect(page.locator(".detail-main .offer-section").last).to_contain_text("Sprawdź po numerze VIN")
    expect(vin_section.locator(".vin-check")).to_be_hidden()
    page.get_by_role("link", name="Sprawdź VIN", exact=True).click()
    expect(page).to_have_url(base + href + "#sprawdz-vin")
    expect(vin_section.locator("summary")).to_be_in_viewport()
    expect(vin_section.locator("code")).to_have_text("ZZZTEST0000000001")
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin=base)
    button(vin_section, "Kopiuj VIN").click()
    assert page.evaluate("navigator.clipboard.readText()") == "ZZZTEST0000000001"
    expect(page.locator("[data-toast]")).to_have_text("Skopiowano.")
    provider = vin_section.get_by_role("link", name="Sprawdź w carVertical")
    expect(provider).to_have_attribute("href", "https://www.carvertical.com/pl/historia-pojazdu")
    expect(provider).to_have_attribute("target", "_blank")
    assert vin_section.evaluate("section => section.getBoundingClientRect().bottom <= document.querySelector('.seller-panel').getBoundingClientRect().top")
    page.reload()
    expect(vin_section.get_by_role("link", name="Sprawdź w carVertical")).to_be_visible()
    button(page, "Napisz wiadomość").click()
    page.locator('dialog[open] textarea').fill("Czy można obejrzeć samochód w weekend?")
    button(page, "Wyślij wiadomość").click()
    expect(page).to_have_url(re.compile(r"/demo/wiadomosci/[a-f0-9-]+"))
    thread_url = page.url
    expect(page.locator(".bubble")).to_contain_text("w weekend")
    choose("Sprzedawca", "/demo/wiadomosci")
    page.get_by_role("link", name=re.compile("Toyota Corolla")).click()
    page.locator("textarea[data-message-body]").fill("Tak, podam termin w następnej wiadomości.")
    button(page, "Wyślij").click()
    expect(page.locator(".bubble").last).to_contain_text("podam termin")
    page.goto(base + "/demo/moje-ogloszenia")
    qa_row = page.locator(".listing-row").filter(has_text="Przeglądarka QA")
    button(qa_row, "Oznacz jako sprzedane").click()
    expect(qa_row.get_by_text("Sprzedane", exact=True)).to_be_visible()
    page.goto(base + href)
    expect(page.get_by_text("Samochód został sprzedany.")).to_be_visible()
    page.goto(thread_url)
    expect(page.locator(".bubble").last).to_contain_text("podam termin")
    print("Mobile seller flow: photos, compact description, 360° by mouse and touch, video playback and moderation")

    page.goto(base + "/demo/reklama")
    expect(page.locator('form[data-api="/contact"]')).to_be_visible()
    page.locator('input[name=name]').fill("Reklama Test")
    page.locator('input[name=email]').fill("ad-test@example.test")
    page.locator('textarea[name=body]').fill("Test lokalnego zapisu zapytania reklamowego.")
    button(page, "Wyślij zapytanie").click()
    expect(page.locator("[data-form-status]")).to_have_text("Zapytanie zapisano.")
    choose("Administrator", "/demo/administracja")
    page.get_by_role("link", name="Kontakt i reklama").click()
    expect(page.get_by_text(re.compile("Reklama Test"))).to_be_visible()
    page.goto(base + "/demo/szukaj?lang=en")
    expect(page.get_by_role("heading", name="Vehicles for sale", exact=True)).to_be_visible()
    expect(page.get_by_role("navigation", name="Main navigation").last.get_by_text("Sell", exact=True)).to_be_visible()
    print("Advertisement saved to administration; English content and mobile navigation")

    page.goto(base + "/demo?lang=uk")
    page.evaluate("navigator.serviceWorker.ready")
    page.wait_for_function("() => Boolean(navigator.serviceWorker.controller)")
    page.wait_for_function("""async () => {
      const preference = await caches.match('/offline-language');
      return (await preference?.text()) === 'uk';
    }""")
    server.terminate()
    server.wait(timeout=7)
    page.goto(base + "/demo/szukaj")
    expect(page.get_by_role("heading", name="Немає з’єднання")).to_be_visible()
    page.goto(base + "/demo/szukaj?lang=pl")
    expect(page.get_by_role("heading", name="Brak połączenia")).to_be_visible()
    print("PWA service worker offline screen after disconnecting the local server")
    context.close()
    assert not errors, errors
    print("No JavaScript or console errors in the verified flows")


def main():
    if OUTPUT:
        Path(OUTPUT).mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="var-test-", dir=ROOT) as database:
        env = {**os.environ, "APP_MODE":"development", "APP_ORIGIN":"", "PORT":"0", "HOST":"127.0.0.1",
               "DATA_DIR":database, "MAIL_API_KEY":"", "OWNER_SETUP_TOKEN":""}
        server = subprocess.Popen(["node","server.mjs"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            line = server.stdout.readline()
            assert "http://" in line, line
            base = line.strip().split(" · ")[-1]
            with urllib.request.urlopen(base + "/healthz", timeout=5) as response:
                assert response.status == 200
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=CHROME, headless=True)
                try:
                    run(browser, base, database, server)
                finally:
                    browser.close()
        finally:
            if server.poll() is None:
                server.terminate()
            _, stderr = server.communicate(timeout=7)
            if stderr:
                print(stderr)


if __name__ == "__main__":
    main()
