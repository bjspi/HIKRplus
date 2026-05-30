#!/usr/bin/env python3
# Dependencies: pip install rich-click questionary
"""HikrPlus release push tool.

Reads the extension version from public/manifest.json, guards against
double-releases via a _used marker in package.json, then pushes the
current branch, optionally creates a git tag and GitHub release, and
finally commits the burn marker so the same version cannot be pushed again.
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

MANIFEST_PATH = Path("public/manifest.json")
PACKAGE_PATH  = Path("package.json")

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
    """Display a summary panel with version, tag, and burn-marker info."""
    console.print(Panel(
        f"  [dim]Version:[/dim]    [bold green]{version}[/bold green]\n"
        f"  [dim]Tag:[/dim]        [bold cyan]{tag}[/bold cyan]\n"
        f"  [dim]Nach Push:[/dim]  package.json → [yellow]{version}_used[/yellow]",
        title="[cyan]HikrPlus Release[/cyan]",
        border_style="cyan",
    ))


def show_summary(tag: str, version: str, created_tag: bool) -> None:
    """Print the final success panel listing everything that was done."""
    lines = [f"[bold green]Release {tag} abgeschlossen![/bold green]\n"]
    if created_tag:
        lines.append(f"  [dim]Tag:[/dim]           [cyan]{tag}[/cyan]")
        lines.append(f"  [dim]GitHub Release:[/dim] [green]wird von GitHub Actions gebaut[/green]")
    lines.append(f"  [dim]package.json:[/dim]   [yellow]{version}_used[/yellow]")
    if created_tag:
        lines.append(f"\n  [dim]Release-Seite: github.com/bjspi/HIKRplus/releases[/dim]")
    lines.append(f"  [dim]Nächster Push erfordert neue Version in public/manifest.json[/dim]")
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


def ensure_not_released(version: str) -> None:
    """Abort if package.json carries a _used marker, meaning this version was already pushed."""
    pkg_version = read_json(PACKAGE_PATH).get("version", "")
    if "_used" in pkg_version:
        abort(
            "Bereits released",
            f"[bold yellow]Version [white]{version}[/white] wurde bereits gepushed.\n\n"
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
        console.print("[dim]--no-tag: Tag wird übersprungen (kein Release-Build).[/dim]")
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


def do_burn(version: str) -> None:
    """Write *version*_used into package.json and push the burn-marker commit.

    manifest.json is intentionally left untouched so Chrome can still load the extension.
    """
    pkg = read_json(PACKAGE_PATH)
    pkg["version"] = f"{version}_used"
    write_json(PACKAGE_PATH, pkg)
    console.print(f"[yellow]  package.json → [bold]{version}_used[/bold][/yellow]")
    with console.status("[cyan]Burn-Commit...[/cyan]"):
        git("add", str(PACKAGE_PATH))
        git("commit", "-m", f"chore: mark v{version} as released [skip ci]")
        git("push")
    console.print("[green]  Burn-Commit gepushed[/green]")


# ── CLI ───────────────────────────────────────────────────────────────────────

@click.command()
@click.option("--no-tag", is_flag=True, default=False, help="Git-Tag überspringen (kein Release-Build)")
def main(no_tag: bool) -> None:
    """HikrPlus release push — Version aus manifest.json, Burn-Marker in package.json.

    Das offizielle GitHub Release (mit Chrome- und Firefox-ZIP) wird vom
    Workflow .github/workflows/release.yml gebaut, sobald der Tag gepusht wird.
    """
    show_header()

    version = read_extension_version()
    ensure_not_released(version)
    ensure_clean_worktree()

    tag = f"v{version}"
    show_release_info(version, tag)

    if not confirm(f"Version {tag} jetzt pushen?"):
        sys.exit(0)

    create_tag = ask_create_tag(no_tag)

    console.print()
    do_push()
    if create_tag:
        do_tag(tag)
    do_burn(version)

    show_summary(tag, version, create_tag)


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
