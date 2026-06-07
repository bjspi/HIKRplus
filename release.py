#!/usr/bin/env python3
# Dependencies: pip install rich-click questionary
"""HikrPlus release push tool.

Reads the extension version from public/manifest.json (the single source of
truth), keeps package.json's version in sync, and guards against double-
releases via a dedicated .released marker file. The git tag is pushed only at
the very end; that triggers the GitHub Actions workflow that builds the
official release with ZIPs.

Both manifest.json and package.json always keep a clean semver; the "already
released" state lives only in .released, so no version field is ever corrupted.
"""

import json
import subprocess
import sys
from pathlib import Path

import questionary
import rich_click as click
from rich.align import Align
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

console = Console()

MANIFEST_PATH   = Path("public/manifest.json")
PACKAGE_PATH    = Path("package.json")
RELEASED_MARKER = Path(".released")

LOGO = r"""
  _   _ _ _        ____  _
 | | | (_) | ___ _|  _ \| |_   _ ___
 | |_| | | |/ / '_| |_) | | | | / __|
 |  _  | |   <| | |  __/| | |_| \__ \
 |_| |_|_|_|\_\_| |_|   |_|\__,_|___/
"""

LOGO_COLORS = ["bold cyan", "bold green", "bold yellow", "bold magenta", "bold red"]


# ── UI helpers ────────────────────────────────────────────────────────────────

def show_header() -> None:
    """Render the colored ASCII-art logo centered in the terminal."""
    lines = [l for l in LOGO.splitlines() if l.strip()]
    max_len = max(len(l) for l in lines)
    block = Text()
    for i, line in enumerate(lines):
        block.append(line.ljust(max_len) + "\n", style=LOGO_COLORS[i % len(LOGO_COLORS)])
    console.print()
    console.print(Align.center(block))
    console.print(Align.center(Text("Release Tool", style="bold white")))
    console.print()


def abort(title: str, body: str) -> None:
    """Print a red error panel and exit with code 1."""
    console.print(Panel(body, title=f"[bold red]  {title}[/bold red]", border_style="red"))
    sys.exit(1)


def confirm(question: str, default: bool = True) -> bool:
    """Ask a yes/no question via questionary. Exits cleanly on Ctrl-C (None)."""
    answer = questionary.confirm(question, default=default).ask()
    if answer is None:
        console.print("[yellow]Abgebrochen.[/yellow]")
        sys.exit(0)
    return answer


def show_release_info(version: str, tag: str) -> None:
    """Display a summary panel with version and tag."""
    console.print(Panel(
        f"  [dim]Version:[/dim]    [bold green]{version}[/bold green]\n"
        f"  [dim]Tag:[/dim]        [bold cyan]{tag}[/bold cyan]\n"
        f"  [dim]Nach Push:[/dim]  [yellow].released → {version}[/yellow] (Version gesperrt)",
        title="[cyan]HikrPlus Release[/cyan]",
        border_style="cyan",
    ))


def show_push_summary() -> None:
    """Print the success panel for a plain push (no tag, no release)."""
    console.print(Panel(
        "[bold green]Branch gepushed (ohne Release).[/bold green]\n\n"
        "  [dim]Kein Tag, kein Release-Build, .released unverändert.[/dim]",
        title="[green]  Done[/green]",
        border_style="green",
    ))


def show_summary(tag: str, version: str, created_tag: bool) -> None:
    """Print the final success panel listing everything that was done."""
    lines = [f"[bold green]Release {tag} abgeschlossen![/bold green]\n"]
    if created_tag:
        lines.append(f"  [dim]Tag:[/dim]           [cyan]{tag}[/cyan]")
        lines.append(f"  [dim]GitHub Release:[/dim] [green]wird von GitHub Actions gebaut[/green]")
    lines.append(f"  [dim]Version:[/dim]       [green]{version}[/green]  [dim](manifest + package.json)[/dim]")
    lines.append(f"  [dim].released:[/dim]      [yellow]{version}[/yellow]")
    if created_tag:
        lines.append(f"\n  [dim]Release-Seite: github.com/bjspi/HIKRplus/releases[/dim]")
    lines.append(f"  [dim]Nächster Release braucht neue Version oder den angebotenen Patch-Bump[/dim]")
    console.print(Panel("\n".join(lines), title="[green]  Done[/green]", border_style="green"))


def show_dirty_status(dirty: str) -> None:
    """Display the current dirty git status."""
    console.print(Panel(
        f"[bold yellow]Uncommitted changes gefunden:[/bold yellow]\n\n[white]{dirty}[/white]",
        title="[yellow]  Working Tree[/yellow]",
        border_style="yellow",
    ))


# ── File I/O ──────────────────────────────────────────────────────────────────

def read_json(path: Path) -> dict:
    """Read and return a JSON file as a dict. Aborts if the file does not exist."""
    if not path.exists():
        abort("Datei nicht gefunden", f"[white]{path} existiert nicht.[/white]")
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict) -> None:
    """Serialize *data* to *path* with 2-space indentation and a trailing newline."""
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def write_extension_version(version: str) -> None:
    """Write *version* to public/manifest.json."""
    manifest = read_json(MANIFEST_PATH)
    manifest["version"] = version
    write_json(MANIFEST_PATH, manifest)
    console.print(f"[green]  manifest.json → [bold]{version}[/bold][/green]")


# ── Git ───────────────────────────────────────────────────────────────────────

def git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run a git sub-command. Prints the stderr and exits on non-zero return code."""
    result = subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8")
    if check and result.returncode != 0:
        console.print(f"[bold red]Git-Fehler:[/] {result.stderr.strip()}")
        sys.exit(1)
    return result


# ── Guards ────────────────────────────────────────────────────────────────────

def read_extension_version() -> str:
    """Read the version string from public/manifest.json. Aborts if missing."""
    version = read_json(MANIFEST_PATH).get("version", "")
    if not version:
        abort("Keine Version", "[white]Kein 'version'-Feld in public/manifest.json.[/white]")
    return version


def read_released_version() -> str:
    """Return the last released version recorded in .released, or '' if none."""
    if not RELEASED_MARKER.exists():
        return ""
    return RELEASED_MARKER.read_text(encoding="utf-8").strip()


def local_tag_exists(tag: str) -> bool:
    """Return True if *tag* exists locally."""
    return bool(git("tag", "-l", tag, check=False).stdout.strip())


def remote_tag_exists(tag: str) -> bool:
    """Return True if *tag* exists on origin. Network errors are warned, not fatal."""
    result = git("ls-remote", "--tags", "origin", tag, check=False)
    if result.returncode != 0:
        console.print(f"[yellow]  Remote-Tag-Prüfung fehlgeschlagen: {result.stderr.strip()}[/yellow]")
        return False
    return bool(result.stdout.strip())


def release_block_reason(version: str) -> str:
    """Return a human-readable reason why *version* is already released, or ''. """
    tag = f"v{version}"
    if read_released_version() == version:
        return f".released enthält bereits {version}"
    if local_tag_exists(tag):
        return f"lokaler Tag {tag} existiert bereits"
    if remote_tag_exists(tag):
        return f"Remote-Tag origin/{tag} existiert bereits"
    return ""


def bump_patch_version(version: str) -> str:
    """Increment the last semver component, e.g. 0.2.9 -> 0.2.10."""
    parts = version.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        abort(
            "Version nicht automatisch bumpbar",
            f"[white]Version [cyan]{version}[/cyan] ist kein x.y.z-Semver. Bitte manuell in public/manifest.json ändern.[/white]",
        )
    parts[-1] = str(int(parts[-1]) + 1)
    return ".".join(parts)


def ensure_releasable_or_offer_bump(version: str) -> str:
    """Offer to bump the patch version while the current version is already released."""
    while True:
        reason = release_block_reason(version)
        if not reason:
            return version
        next_version = bump_patch_version(version)
        console.print(Panel(
            f"[bold yellow]Version [white]{version}[/white] wurde bereits released.[/bold yellow]\n"
            f"[dim]{reason}[/dim]\n\n"
            f"[white]Patch-Version automatisch auf [cyan]{next_version}[/cyan] erhöhen?[/white]",
            title="[yellow]  Bereits released[/yellow]",
            border_style="yellow",
        ))
        if not confirm(f"Version {version} → {next_version} bumpen?", default=True):
            abort(
                "Bereits released",
                "[white]Bitte neue Version in [cyan]public/manifest.json[/cyan] vergeben oder den Release abbrechen.[/white]",
            )
        write_extension_version(next_version)
        sync_package_version(next_version)
        version = next_version


def dirty_status() -> str:
    """Return git status --porcelain output."""
    return git("status", "--porcelain", check=False).stdout.strip()


def prompt_text(question: str, default: str) -> str:
    """Ask a free-text question via questionary."""
    answer = questionary.text(question, default=default).ask()
    if answer is None:
        console.print("[yellow]Abgebrochen.[/yellow]")
        sys.exit(0)
    return answer.strip()


def handle_uncommitted_changes(version: str, create_tag: bool) -> bool:
    """Offer to commit and optionally push uncommitted changes. Returns True if pushed."""
    dirty = dirty_status()
    if not dirty:
        return False
    show_dirty_status(dirty)
    if not confirm("Uncommitted changes jetzt committen?", default=True):
        abort(
            "Uncommitted Changes",
            "[white]Ohne Commit kann der Branch nicht sauber gepusht oder released werden.[/white]",
        )
    default_message = f"chore: prepare release v{version}" if create_tag else "chore: update HikrPlus"
    message = prompt_text("Commit-Message", default_message) or default_message
    with console.status("[cyan]Änderungen committen...[/cyan]"):
        git("add", "-A")
        git("commit", "-m", message)
    console.print(f"[green]  Commit erstellt: [cyan]{message}[/cyan][/green]")
    if confirm("Diesen Commit direkt pushen?", default=True):
        do_push()
        return True
    return False


# ── Prompts ───────────────────────────────────────────────────────────────────

def ask_create_tag(no_tag: bool) -> bool:
    """Ask whether to create and push a git tag.

    Pushing the tag is what triggers the GitHub Actions release workflow
    (.github/workflows/release.yml), which builds the Chrome + Firefox ZIPs
    and publishes the official GitHub Release. Returns False if --no-tag is set.
    """
    if no_tag:
        console.print("[dim]--no-tag: nur pushen, kein Tag/Release.[/dim]")
        return False
    return confirm("Git-Tag erstellen und pushen? (löst den Release-Build via GitHub Actions aus)")


# ── Actions ───────────────────────────────────────────────────────────────────

def do_push() -> None:
    """Push the current branch to origin."""
    with console.status("[cyan]Pushing...[/cyan]"):
        git("push")
    console.print("[green]  Push erfolgreich[/green]")


def do_tag(tag: str) -> None:
    """Create *tag* locally and push it to origin.

    Pushing the tag triggers the GitHub Actions release workflow.
    """
    if local_tag_exists(tag):
        abort("Tag existiert bereits", f"[white]Lokaler Tag [cyan]{tag}[/cyan] existiert bereits.[/white]")
    if remote_tag_exists(tag):
        abort("Tag existiert bereits", f"[white]Remote-Tag [cyan]origin/{tag}[/cyan] existiert bereits.[/white]")
    with console.status(f"[cyan]Tag {tag} erstellen...[/cyan]"):
        git("tag", tag)
        git("push", "origin", tag)
    console.print(f"[green]  Tag [cyan]{tag}[/cyan] erstellt & gepushed[/green]")
    console.print("[dim]  → GitHub Actions baut jetzt das offizielle Release (Chrome + Firefox ZIP).[/dim]")


def sync_package_version(version: str) -> bool:
    """Set package.json's version to match the manifest. Returns True if it changed.

    Keeps the npm version a clean semver, in sync with the extension version,
    without touching git (the caller bundles it into the burn commit).
    """
    pkg = read_json(PACKAGE_PATH)
    if pkg.get("version") == version:
        return False
    pkg["version"] = version
    write_json(PACKAGE_PATH, pkg)
    console.print(f"[green]  package.json → [bold]{version}[/bold] (synchronisiert)[/green]")
    return True


def finalize_release(version: str) -> None:
    """Record *version* in .released and commit the marker.

    This is the burn step: it blocks re-releasing the same version. Both
    manifest.json and package.json keep their clean semver — only .released
    carries the released-state. package.json is synced into the same commit.
    The caller pushes the branch before pushing the final release tag.
    """
    RELEASED_MARKER.write_text(f"{version}\n", encoding="utf-8")
    package_changed = sync_package_version(version)
    console.print(f"[yellow]  .released → [bold]{version}[/bold][/yellow]")
    with console.status("[cyan]Release-Marker committen...[/cyan]"):
        git("add", str(RELEASED_MARKER))
        if package_changed:
            git("add", str(PACKAGE_PATH))
        git("commit", "-m", f"chore: mark v{version} as released")
    console.print("[green]  Release-Marker committed[/green]")


# ── CLI ───────────────────────────────────────────────────────────────────────

@click.command()
@click.option("--no-tag", is_flag=True, default=False, help="Nur pushen, kein Tag/Release (z. B. für README-Änderungen)")
def main(no_tag: bool) -> None:
    """HikrPlus release push — Version aus manifest.json, Sperre via .released.

    Zwei Modi:
      • Release: Tag wird gepusht → GitHub Actions baut Chrome- + Firefox-ZIP,
        davor wird die Version via .released gesperrt. Der Tag kommt zuletzt.
      • Nur Push (--no-tag oder Tag-Frage verneinen): pusht den Branch ohne Tag,
        Release-Build oder .released-Änderung — ideal für README/Docs.
    """
    show_header()

    version = read_extension_version()
    create_tag = ask_create_tag(no_tag)

    if create_tag:
        version = ensure_releasable_or_offer_bump(version)

    tag = f"v{version}"
    pushed_uncommitted_commit = handle_uncommitted_changes(version, create_tag)
    remaining_dirty = dirty_status()
    if remaining_dirty:
        show_dirty_status(remaining_dirty)
        abort(
            "Uncommitted Changes",
            "[white]Vor Push oder Release muss der Working Tree sauber sein.[/white]",
        )

    if create_tag:
        show_release_info(version, tag)
        if not confirm(f"Release {tag} vorbereiten und Tag ganz am Ende pushen?"):
            sys.exit(0)
        console.print()
        finalize_release(version)
        do_push()
        do_tag(tag)
        show_summary(tag, version, True)
    else:
        if pushed_uncommitted_commit:
            show_push_summary()
            return
        if not confirm("Aktuellen Branch jetzt pushen (ohne Release)?"):
            sys.exit(0)
        console.print()
        do_push()
        show_push_summary()


if __name__ == "__main__":
    try:
        main(standalone_mode=False)
    except SystemExit:
        pass
    except Exception:
        console.print_exception(show_locals=False)
    finally:
        console.print()
        input("[ Enter zum Schließen ]")
