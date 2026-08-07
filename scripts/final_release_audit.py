#!/usr/bin/env python3
"""Final cross-repository audit for the Nemo prompt workstation rollout."""

from __future__ import annotations

import html.parser
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import tinycss2


WORKSPACE = Path(sys.argv[1]).resolve()
OUTPUT = Path(sys.argv[2]).resolve()

REPOS = {
    "NemoPresetExt": WORKSPACE / "NemoPresetExt",
    "NemoPromptTools": WORKSPACE / "NemoPromptTools",
    "NemoUIOverhaul": WORKSPACE / "NemoUIOverhaul",
}

RUNTIME_ROOTS = {
    "NemoPresetExt": [
        "content.js", "manifest.json", "settings.html", "styles.css", "README.md",
        "archive", "core", "features", "reasoning", "styles", "ui", "lib",
    ],
    "NemoPromptTools": [
        "index.js", "standalone-runtime.js", "manifest.json", "styles.css", "README.md",
        "archive", "core", "features", "reasoning", "lib",
    ],
    "NemoUIOverhaul": [
        "index.js", "manifest.json", "styles.css", "README.md",
        "core", "features", "themes", "ui", "lib",
    ],
}

TEXT_SUFFIXES = {".css", ".html", ".js", ".json", ".md", ".mjs", ".cjs", ".txt"}
JS_SUFFIXES = {".js", ".mjs", ".cjs"}
MOJIBAKE = ("Ã¢", "Ã°", "Ãƒ", "Â ", "Â ", "â€", "â€“", "â€”", "â„¢", "ðŸ", "\ufffd")
C1 = re.compile(r"[\u0080-\u009f]")
CONFLICT = re.compile(r"^(?:<<<<<<<|=======|>>>>>>>)(?:\s|$)", re.MULTILINE)
IMPORT_PATTERNS = (
    re.compile(r"(?:import|export)\s+(?:[^'\"]*?\s+from\s+)?['\"](\.[^'\"]+)['\"]"),
    re.compile(r"import\(\s*['\"](\.[^'\"]+)['\"]\s*\)"),
)
GROUPING_AT_RULES = {"container", "document", "layer", "media", "scope", "starting-style", "supports"}


@dataclass
class Result:
    name: str
    passed: bool
    detail: str = ""


RESULTS: list[Result] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    RESULTS.append(Result(name, bool(condition), detail))


def run(name: str, command: list[str], cwd: Path, timeout: int = 240) -> None:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            check=False,
        )
        output = completed.stdout.strip()
        if len(output) > 6000:
            output = output[-6000:]
        check(name, completed.returncode == 0, f"exit={completed.returncode}" + (f"\n{output}" if output else ""))
    except Exception as error:
        check(name, False, f"could not execute: {error}")


def iter_runtime_files(repo_name: str, suffixes: set[str] | None = None) -> Iterable[Path]:
    root = REPOS[repo_name]
    seen: set[Path] = set()
    for entry in RUNTIME_ROOTS[repo_name]:
        target = root / entry
        candidates = [target] if target.is_file() else (target.rglob("*") if target.is_dir() else [])
        for path in candidates:
            if not path.is_file() or path in seen:
                continue
            if suffixes is not None and path.suffix.lower() not in suffixes:
                continue
            if any(part in {"node_modules", ".git", "tests", "scripts", ".github"} for part in path.relative_to(root).parts):
                continue
            seen.add(path)
            yield path


def read(repo_name: str, path: str) -> str:
    return (REPOS[repo_name] / path).read_text(encoding="utf-8")


class IdCollector(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for key, value in attrs:
            if key.lower() == "id" and value:
                self.ids.append(value)


def check_encoding(repo_name: str) -> None:
    failures: list[str] = []
    count = 0
    for path in iter_runtime_files(repo_name, TEXT_SUFFIXES):
        count += 1
        relative = path.relative_to(REPOS[repo_name])
        raw = path.read_bytes()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as error:
            failures.append(f"{relative}: invalid UTF-8: {error}")
            continue
        markers = [marker for marker in MOJIBAKE if marker in text]
        if markers:
            failures.append(f"{relative}: mojibake {markers}")
        controls = sorted({hex(ord(char)) for char in C1.findall(text)})
        if controls:
            failures.append(f"{relative}: C1 controls {controls}")
        if CONFLICT.search(text):
            failures.append(f"{relative}: merge conflict marker")
        if "\x00" in text:
            failures.append(f"{relative}: NUL byte")
    check(f"{repo_name}: source encoding and merge markers", not failures,
          f"scanned {count} runtime text files" + ("\n" + "\n".join(failures[:50]) if failures else ""))


def inspect_css_rules(rules: list[object], errors: list[str], context: str) -> None:
    for rule in rules:
        rule_type = getattr(rule, "type", None)
        if rule_type == "error":
            errors.append(f"{context}: {getattr(rule, 'message', 'parse error')} at {getattr(rule, 'source_line', '?')}:{getattr(rule, 'source_column', '?')}")
            continue
        if rule_type == "qualified-rule":
            declarations = tinycss2.parse_declaration_list(rule.content, skip_comments=False, skip_whitespace=False)
            for declaration in declarations:
                if getattr(declaration, "type", None) == "error":
                    errors.append(f"{context}: declaration error {getattr(declaration, 'message', '')} at {getattr(declaration, 'source_line', '?')}:{getattr(declaration, 'source_column', '?')}")
        if rule_type == "at-rule" and getattr(rule, "content", None) is not None and getattr(rule, "lower_at_keyword", "") in GROUPING_AT_RULES:
            nested = tinycss2.parse_rule_list(rule.content, skip_comments=False, skip_whitespace=False)
            inspect_css_rules(nested, errors, f"{context}/@{rule.lower_at_keyword}")


def check_css(repo_name: str) -> None:
    failures: list[str] = []
    count = 0
    for path in iter_runtime_files(repo_name, {".css"}):
        count += 1
        errors: list[str] = []
        rules = tinycss2.parse_stylesheet(path.read_text(encoding="utf-8"), skip_comments=False, skip_whitespace=False)
        inspect_css_rules(rules, errors, str(path.relative_to(REPOS[repo_name])))
        failures.extend(errors)
    check(f"{repo_name}: CSS parser validation", not failures,
          f"parsed {count} stylesheets" + ("\n" + "\n".join(failures[:50]) if failures else ""))


def check_json(repo_name: str) -> None:
    failures: list[str] = []
    count = 0
    for path in iter_runtime_files(repo_name, {".json"}):
        count += 1
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as error:
            failures.append(f"{path.relative_to(REPOS[repo_name])}: {error}")
    check(f"{repo_name}: JSON parser validation", not failures,
          f"parsed {count} JSON files" + ("\n" + "\n".join(failures[:30]) if failures else ""))


def check_html_ids(repo_name: str) -> None:
    failures: list[str] = []
    count = 0
    for path in iter_runtime_files(repo_name, {".html"}):
        count += 1
        parser = IdCollector()
        parser.feed(path.read_text(encoding="utf-8"))
        duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
        if duplicates:
            failures.append(f"{path.relative_to(REPOS[repo_name])}: duplicate ids {duplicates}")
    check(f"{repo_name}: static HTML IDs", not failures,
          f"parsed {count} HTML files" + ("\n" + "\n".join(failures[:30]) if failures else ""))


def check_imports(repo_name: str) -> None:
    failures: list[str] = []
    resolved = 0
    root = REPOS[repo_name].resolve()
    optional_missing = {
        ("NemoUIOverhaul", "../features/prosepolisher/src/default_names.js"),
    }
    for source in iter_runtime_files(repo_name, JS_SUFFIXES):
        text = source.read_text(encoding="utf-8")
        specifiers = {match.group(1) for pattern in IMPORT_PATTERNS for match in pattern.finditer(text)}
        for specifier in specifiers:
            if (repo_name, specifier) in optional_missing:
                continue
            clean = specifier.split("?", 1)[0].split("#", 1)[0]
            candidate = (source.parent / clean).resolve()
            try:
                candidate.relative_to(root)
            except ValueError:
                continue
            choices = [candidate]
            if not candidate.suffix:
                choices.extend([candidate.with_suffix(".js"), candidate.with_suffix(".json"), candidate / "index.js"])
            if any(choice.exists() for choice in choices):
                resolved += 1
            else:
                failures.append(f"{source.relative_to(root)} -> {specifier}")
    check(f"{repo_name}: relative import graph", not failures,
          f"resolved {resolved} local imports" + ("\n" + "\n".join(failures[:50]) if failures else ""))


def check_manifest(repo_name: str, expected_version: str) -> dict[str, object]:
    manifest = json.loads(read(repo_name, "manifest.json"))
    failures = []
    if manifest.get("version") != expected_version:
        failures.append(f"version={manifest.get('version')}, expected={expected_version}")
    for key in ("display_name", "js", "loading_order"):
        if key not in manifest:
            failures.append(f"missing {key}")
    for key in ("js", "css"):
        value = manifest.get(key)
        if value and not (REPOS[repo_name] / str(value)).is_file():
            failures.append(f"missing {key} target {value}")
    check(f"{repo_name}: manifest contract", not failures,
          f"{manifest.get('display_name')} {manifest.get('version')} loading_order={manifest.get('loading_order')}" + ("\n" + "\n".join(failures) if failures else ""))
    return manifest


def check_repo(repo_name: str, version: str) -> dict[str, object]:
    check_encoding(repo_name)
    check_css(repo_name)
    check_json(repo_name)
    check_html_ids(repo_name)
    check_imports(repo_name)
    manifest = check_manifest(repo_name, version)

    js_files = [str(path) for path in iter_runtime_files(repo_name, JS_SUFFIXES)]
    for path in js_files:
        completed = subprocess.run(["node", "--check", path], cwd=REPOS[repo_name], text=True,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
        if completed.returncode != 0:
            check(f"{repo_name}: JavaScript syntax", False, f"{path}\n{completed.stdout}")
            break
    else:
        check(f"{repo_name}: JavaScript syntax", True, f"checked {len(js_files)} runtime files")

    tests = sorted((REPOS[repo_name] / "tests").glob("*.test.js"))
    if tests:
        run(f"{repo_name}: regression tests", ["node", "--test", *map(str, tests)], REPOS[repo_name])
    else:
        check(f"{repo_name}: regression tests", False, "no tests/*.test.js found")
    return manifest


def check_cross_repo(manifests: dict[str, dict[str, object]]) -> None:
    orders = {name: int(manifest["loading_order"]) for name, manifest in manifests.items()}
    check("Cross-repo: deterministic loading order",
          orders["NemoPresetExt"] < orders["NemoPromptTools"] < orders["NemoUIOverhaul"],
          json.dumps(orders, sort_keys=True))

    preset_settings = read("NemoPresetExt", "core/feature-settings.js")
    check("NemoPresetExt: Classic 3.4 fresh default and fallback",
          "promptUiMode: PROMPT_UI_MODES.CLASSIC" in preset_settings
          and re.search(r"normalizePromptUiMode[\s\S]+?:\s*PROMPT_UI_MODES\.CLASSIC\s*;", preset_settings) is not None,
          "checked default schema and unknown-mode normalization")
    check("NemoPresetExt: standalone migration retains Modern",
          "settings.promptUiMode = PROMPT_UI_MODES.MODERN" in preset_settings)

    preset_catalog = read("NemoPresetExt", "features/hub/catalog.js")
    check("NemoPresetExt: Hub excludes standalone PromptTools",
          "NemoVonNirgend/NemoPromptTools" not in preset_catalog and "nemo-prompt-tools" not in preset_catalog.lower())

    preset_content = read("NemoPresetExt", "content.js")
    publish = preset_content.rfind("\npublishPublicApi();")
    bootstrap = preset_content.find("\nif (document.querySelector('#left-nav-panel'))")
    check("NemoPresetExt: capability publishes before async bootstrap",
          publish >= 0 and bootstrap >= 0 and publish < bootstrap,
          f"publish={publish}, bootstrap={bootstrap}")

    bridge_manifest = manifests["NemoPromptTools"]
    check("PromptTools: no manifest-level stylesheet", "css" not in bridge_manifest)
    bridge = read("NemoPromptTools", "index.js")
    timeout = re.search(r"waitForMergedCapability\(timeout\s*=\s*(\d+)\)", bridge)
    check("PromptTools: merged capability grace period",
          timeout is not None and int(timeout.group(1)) >= 3000,
          f"timeout={timeout.group(1) if timeout else 'missing'}ms")
    capability_pos = bridge.find("const merged = await waitForMergedCapability()")
    css_pos = bridge.find("await loadStandaloneStyles()")
    runtime_pos = bridge.find("await import('./standalone-runtime.js')")
    check("PromptTools: standalone resources remain capability-gated",
          capability_pos >= 0 and css_pos > capability_pos and runtime_pos > css_pos,
          f"capability={capability_pos}, css={css_pos}, runtime={runtime_pos}")

    for path in ("archive/navigator.js", "features/prompts/prompt-navigator.js"):
        source = read("NemoPromptTools", path)
        check(f"PromptTools: {path} ampersand escaping",
              re.search(r"\.replace\(\/&\/g, [\"']&amp;[\"']\)", source) is not None)

    reasoning = read("NemoPromptTools", "reasoning/reasoning-capture-core.js")
    check("PromptTools: reasoning handles straight and curly apostrophes",
          reasoning.count(r"[\p{L}\p{M}'’\-]*") == 2
          and r"[\p{L}\p{M}''\-]*" not in reasoning)

    prompt_styles = read("NemoPromptTools", "styles.css")
    required_glyphs = (r"content: '\2605 ';", r"content: '\2713 ';", r"content: '\25B6 ';",
                       r"content: '\1F4C1 ';", r"content: '\1F4C2 ';", r"content: '\2514 \2500 ';")
    check("PromptTools: canonical CSS glyph escapes",
          all(glyph in prompt_styles for glyph in required_glyphs)
          and r"\E2 \2013 \B6" not in prompt_styles)

    ui_index = read("NemoUIOverhaul", "index.js")
    leaked = [name for name in ("NemoPresetManager", "NemoPromptManager", "NemoCharacterManager", "initPresetNavigatorForApi") if name in ui_index]
    check("UIOverhaul: runtime excludes prompt-workstation imports", not leaked,
          "none" if not leaked else ", ".join(leaked))
    run("UIOverhaul: prompt selector ownership", [sys.executable, "scripts/remove_prompt_ui_css.py", "--check"], REPOS["NemoUIOverhaul"])

    shared_names = read("NemoUIOverhaul", "core/shared-names.js")
    check("UIOverhaul: optional name source is fallback-guarded",
          "await import('../features/prosepolisher/src/default_names.js')" in shared_names
          and "this.loadFallbackNames()" in shared_names
          and re.search(r"try\s*\{[\s\S]*await import\('../features/prosepolisher/src/default_names\.js'\)[\s\S]*\}\s*catch", shared_names) is not None)

    check("Cross-repo: permanent integrity tests shipped",
          (REPOS["NemoPromptTools"] / "tests/source-integrity.test.js").is_file()
          and (REPOS["NemoUIOverhaul"] / "tests/source-integrity.test.js").is_file())


def write_report() -> int:
    failures = [result for result in RESULTS if not result.passed]
    payload = {
        "status": "failed" if failures else "passed",
        "passed": sum(result.passed for result in RESULTS),
        "failed": len(failures),
        "results": [asdict(result) for result in RESULTS],
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    md = [
        "# Nemo final release audit",
        "",
        f"**Status:** {payload['status'].upper()}",
        "",
        f"Passed: {payload['passed']}  ",
        f"Failed: {payload['failed']}",
        "",
    ]
    for result in RESULTS:
        icon = "✅" if result.passed else "❌"
        detail = result.detail.replace("\n", "<br>")
        md.append(f"- {icon} **{result.name}**" + (f": {detail}" if detail else ""))
    OUTPUT.with_suffix(".md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 1 if failures else 0


def main() -> int:
    for name, root in REPOS.items():
        check(f"{name}: checkout exists", root.is_dir(), str(root))
    manifests = {
        "NemoPresetExt": check_repo("NemoPresetExt", "6.0.0"),
        "NemoPromptTools": check_repo("NemoPromptTools", "1.2.1"),
        "NemoUIOverhaul": check_repo("NemoUIOverhaul", "1.2.1"),
    }
    check_cross_repo(manifests)
    return write_report()


if __name__ == "__main__":
    raise SystemExit(main())
