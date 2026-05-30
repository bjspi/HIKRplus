#!/usr/bin/env python3
# Dependencies: pip install rich-click questionary
"""HikrPlus release push tool.

Reads the extension version from public/manifest.json (the single source of
truth), keeps package.json's version in sync, and guards against double-
releases via a dedicated .released marker file. Pushing the git tag triggers
the GitHub Actions workflow that builds the official release with ZIPs.

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
    lines.append(f"  [dim]Nächster Release erfordert neue Version in public/manifest.json[/dim]")
    console.print(Panel("\n".join(lines), title="[green]  Done[/green]", border_style="green"))


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


def ensure_not_released(version: str) -> None:
    """Abort if .released already records this exact version.

    Bumping the version in public/manifest.json clears the block automatically,
    since the marker then no longer matches.
    """
    if read_released_version() == version:
        abort(
            "Bereits released",
            f"[bold yellow]Version [white]{version}[/white] wurde bereits released.\n\n"
            "[white]Bitte neue Version in [cyan]public/manifest.json[/cyan] vergeben.[/white]",
        )


def ensure_clean_worktree() -> None:
    """Abort if there are any uncommitted changes in the working tree."""
    dirty = git("status", "--porcelain", check=False).stdout.strip()
    if dirty:
        abort(
            "Uncommitted Changes",
            f"[bold yellow]Bitte zuerst alles committen:\n\n[white]{dirty}[/white]",
        )


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
    """Create *tag* locally and push it to origin. Skips silently if the tag already exists.

    Pushing the tag triggers the GitHub Actions release workflow.
    """
    if git("tag", "-l", tag, check=False).stdout.strip():
        console.print(f"[yellow]  Tag [cyan]{tag}[/cyan] existiert bereits – übersprungen.[/yellow]")
        return
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
    """Record *version* in .released and push the marker commit.

    This is the burn step: it blocks re-releasing the same version. Both
    manifest.json and package.json keep their clean semver — only .released
    carries the released-state. package.json is synced into the same commit.
    """
    RELEASED_MARKER.write_text(f"{version}\n", encoding="utf-8")
    package_changed = sync_package_version(version)
    console.print(f"[yellow]  .released → [bold]{version}[/bold][/yellow]")
    with console.status("[cyan]Release-Marker committen...[/cyan]"):
        git("add", str(RELEASED_MARKER))
        if package_changed:
            git("add", str(PACKAGE_PATH))
        git("commit", "-m", f"chore: mark v{version} as released [skip ci]")
        git("push")
    console.print("[green]  Release-Marker gepushed[/green]")


# ── CLI ───────────────────────────────────────────────────────────────────────

@click.command()
@click.option("--no-tag", is_flag=True, default=False, help="Nur pushen, kein Tag/Release (z. B. für README-Änderungen)")
def main(no_tag: bool) -> None:
    """HikrPlus release push — Version aus manifest.json, Sperre via .released.

    Zwei Modi:
      • Release: Tag wird gepusht → GitHub Actions baut Chrome- + Firefox-ZIP,
        danach wird die Version via .released gesperrt.
      • Nur Push (--no-tag oder Tag-Frage verneinen): pusht den Branch ohne Tag,
        Release-Build oder .released-Änderung — ideal für README/Docs.
    """
    show_header()

    ensure_clean_worktree()

    version = read_extension_version()
    tag = f"v{version}"

    create_tag = ask_create_tag(no_tag)

    if create_tag:
        ensure_not_released(version)
        show_release_info(version, tag)
        if not confirm(f"Release {tag} jetzt pushen?"):
            sys.exit(0)
        console.print()
        do_push()
        do_tag(tag)
        finalize_release(version)
        show_summary(tag, version, True)
    else:
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
