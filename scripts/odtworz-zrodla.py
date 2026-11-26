#!/usr/bin/env python3
"""Weryfikacja lub odtworzenie oryginalnych plików z przenośnej kopii BRUMBRUM.VIN."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import sys
import warnings


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / ".backup" / "ZRODLA.json"
MANIFEST_HASH = "c5aaefc78eead2a11572963b1d74f68312a1d343a07082d44755cc2ce35df4b1"
TEMPLATES = {".env.example", ".gitignore", "README.md", "src/accounts.js", "src/views-account.js"}
MARKER = b"{{BRUMBRUM_SOURCE_RESTORE_OWNER_EMAIL_776E2D9C}}"


def inventory():
    raw = MANIFEST.read_bytes()
    if hashlib.sha256(raw).hexdigest() != MANIFEST_HASH:
        raise ValueError("Zmieniony manifest źródeł.")
    return json.loads(raw)


def verified_data(record, owner):
    relative = record["path"]
    base = ROOT / ".backup" / "oryginal" if relative in TEMPLATES else ROOT
    source = base / relative
    if source.resolve(strict=True) != source or not source.is_file():
        raise ValueError("Brak zwykłego pliku źródłowego: " + relative)
    data = source.read_bytes()
    if relative in TEMPLATES:
        data = data.replace(MARKER, owner)
    if hashlib.sha256(data).hexdigest() != record["sha256"]:
        raise ValueError("Niezgodna suma pliku " + relative + ". Sprawdź adres właściciela i kompletność kopii.")
    return data


def restore(owner, target=None):
    manifest = inventory()
    if target is not None:
        target = Path(target).expanduser().absolute()
        parent = target.parent.resolve(strict=True)
        target = parent / target.name
        if target in ROOT.parents or target == ROOT or ROOT in target.parents:
            raise ValueError("Wybierz nowy katalog poza rozpakowaną kopią.")
        if os.path.lexists(target):
            raise FileExistsError("Katalog docelowy już istnieje.")
    for record in manifest["files"]:
        verified_data(record, owner)

    if target is not None:
        # mkdir without exist_ok reserves a new directory even if another run chose the same name.
        target.mkdir(mode=0o700)
        written = []
        made_dirs = [target]
        try:
            for record in manifest["files"]:
                data = verified_data(record, owner)
                path = target / record["path"]
                for parent in reversed(path.parents):
                    if target in parent.parents and not parent.exists():
                        parent.mkdir(mode=0o700)
                        made_dirs.append(parent)
                with path.open("xb") as stream:
                    written.append(path)
                    stream.write(data)
                if os.name == "posix":
                    path.chmod(int(record["mode"][-3:], 8))
        except BaseException:
            for path in reversed(written):
                if path.exists():
                    path.unlink()
            for directory in reversed(made_dirs):
                directory.rmdir()
            raise
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--sprawdz", action="store_true", help="sprawdź wszystkie oryginalne bajty w pamięci")
    mode.add_argument("--do", metavar="NOWY_KATALOG", help="odtwórz pliki w nowym katalogu poza kopią")
    args = parser.parse_args()
    try:
        with warnings.catch_warnings():
            # Never allow a fallback to echoing or reading a piped secret.
            warnings.simplefilter("error", getpass.GetPassWarning)
            owner = getpass.getpass("Pierwotny adres e-mail właściciela (ukryty): ").encode("utf-8")
        manifest = restore(owner, args.do)
    except getpass.GetPassWarning:
        parser.exit(2, "Uruchom skrypt w interaktywnym terminalu z obsługą ukrytego wpisywania.\n")
    except (OSError, ValueError) as error:
        parser.exit(1, str(error) + "\n")
    except (EOFError, KeyboardInterrupt):
        parser.exit(1, "\nPrzerwano.\n")
    action = "Odtworzono" if args.do else "Zweryfikowano"
    print(f"{action} {len(manifest['files'])} plików. Commit {manifest['commit']}, drzewo {manifest['tree']}.")


if __name__ == "__main__":
    main()
