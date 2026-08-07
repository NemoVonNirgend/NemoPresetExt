#!/usr/bin/env python3
"""Cross-repository post-merge audit for the Nemo prompt workstation rollout."""

from __future__ import annotations

import argparse
import html.parser
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

import tinycss2
import yaml


TEXT_SUFFIXES = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".cjs",
    ".txt",
    ".yaml",
    ".yml",
}

SKIP_DIRS = {".git", "node_modules", "__pycache__"}

MOJIBAKE_MARKERS = (
    "Ã¢",
    "Ã°",
    "Ãƒ",
    "Â ",
    "Â ",
    "â€",
    "â€“",
    "â€”",
    "â„¢",
    "ðŸ",
    "\ufffd",
)

CONFLICT_PATTERN = re.compile(r"^(?:<<<<<<<|=======|>>>>>>>)(?:\s|$)", re.MULTILINE)
C1_PATTERN = re.compile(r"[\u0080-\u009f]")
RELATIVE_IMPORT_PATTERNS = (
    re.compile(r"""(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]"""),
    re.compile(r"""import\(\s*['"](\.[^'"]+)['"]\s*\)"""),
)
CSS_IMPORT_PATTERN = re.compile(
    r"""@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?""",
    re.IGNORECASE,
)
LOCAL_CSS_URL_PATTERN = re.compile(
    r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""",
    re.IGNORECASE,
)
SEMVER_PATTERN = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")


@dataclass
class Check:
    name: str
    status: str
    detail: str = ""


@dataclass
class AuditReport:
    repositories: dict[str, dict[str, object]] = field(default_factory=dict)
    checks: list[Check] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def record(self, name: str, passed: bool, detail: str = "", *, warning: bool = False) -> None:
        if passed:
            self.checks.append(Check(name=name, status="pass", detail=detail))
            return
        if warning:
            self.checks.append(Check(name=name, status="warning", detail=detail))
            self.warnings.append(f"{name}: {detail}")
        else:
            self.checks.append(Check(name=name, status="fail", detail=detail))
            self.errors.append(f"{name}: {detail}")


class IdCollector(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for key, value in attrs:
            if key.lower() == "id" and value:
                self.ids.append(value)


def iter_files(root: Path, suffixes: set[str] | None = None) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if suffixes is not None and path.suffix.lower() not in suffixes:
            continue
        yield path


def run_command(
    report: AuditReport,
    name: str,
    args: list[str],
    cwd: Path,
    *,
    timeout: int = 180,
) -> None:
    try:
        completed = subprocess.run(
            args,
            cwd=cwd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            check=False,
        )
    except Exception as error:
        report.record(name, False, f"could not run: {error}")
        return

    output = completed.stdout.strip()
    if len(output) > 8000:
        output = output[-8000:]
    detail = f"exit={completed.returncode}"
    if output:
        detail += f"\n{output}"
    report.record(name, completed.returncode == 0, detail)


def scan_encoding_and_conflicts(report: AuditReport, repo_name: str, root: Path) -> None:
    failures: list[str] = []
    warnings: list[str] = []
    count = 0

    for path in iter_files(root, TEXT_SUFFIXES):
        count += 1
        rel = path.relative_to(root)
        raw = path.read_bytes()

        if raw.startswith(b"\xef\xbb\xbf"):
            warnings.append(f"{rel}: UTF-8 BOM")
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as error:
            failures.append(f"{rel}: invalid UTF-8 ({error})")
            continue

        if "\x00" in text:
            failures.append(f"{rel}: NUL byte in text file")
        markers = [marker for marker in MOJIBAKE_MARKERS if marker in text]
        if markers:
            failures.append(f"{rel}: mojibake markers {markers}")
        c1 = sorted(set(C1_PATTERN.findall(text)))
        if c1:
            failures.append(f"{rel}: C1 control characters {[hex(ord(ch)) for ch in c1]}")
        if CONFLICT_PATTERN.search(text):
            failures.append(f"{rel}: unresolved merge-conflict marker")

    report.record(
        f"{repo_name}: UTF-8, mojibake, controls, and conflict markers",
        not failures,
        f"scanned {count} text files" + (f"\n" + "\n".join(failures[:40]) if failures else ""),
    )
    if warnings:
        report.record(
            f"{repo_name}: text-format warnings",
            False,
            "\n".join(warnings[:40]),
            warning=True,
        )


def scan_json_and_yaml(report: AuditReport, repo_name: str, root: Path) -> None:
    failures: list[str] = []
    json_count = 0
    yaml_count = 0

    for path in iter_files(root):
        rel = path.relative_to(root)
        if path.suffix.lower() == ".json":
            json_count += 1
            try:
                json.loads(path.read_text(encoding="utf-8"))
            except Exception as error:
                failures.append(f"{rel}: JSON parse error: {error}")
        elif path.suffix.lower() in {".yml", ".yaml"}:
            yaml_count += 1
            try:
                yaml.safe_load(path.read_text(encoding="utf-8"))
            except Exception as error:
                failures.append(f"{rel}: YAML parse error: {error}")

    report.record(
        f"{repo_name}: JSON and YAML parsing",
        not failures,
        f"parsed {json_count} JSON and {yaml_count} YAML files"
        + (f"\n" + "\n".join(failures[:40]) if failures else ""),
    )


def css_parse_errors(text: str) -> list[str]:
    errors: list[str] = []

    def inspect_rules(rules: list[object], context: str) -> None:
        for rule in rules:
            rule_type = getattr(rule, "type", None)
            if rule_type == "error":
                errors.append(
                    f"{context}: {getattr(rule, 'message', 'parse error')} "
                    f"at {getattr(rule, 'source_line', '?')}:{getattr(rule, 'source_column', '?')}"
                )
                continue
            if rule_type == "qualified-rule":
                declarations = tinycss2.parse_declaration_list(
                    getattr(rule, "content", []),
                    skip_comments=False,
                    skip_whitespace=False,
                )
                for declaration in declarations:
                    if getattr(declaration, "type", None) == "error":
                        errors.append(
                            f"{context}: declaration error "
                            f"{getattr(declaration, 'message', '')} "
                            f"at {getattr(declaration, 'source_line', '?')}:"
                            f"{getattr(declaration, 'source_column', '?')}"
                        )
            if (
                rule_type == "at-rule"
                and getattr(rule, "content", None) is not None
                and getattr(rule, "lower_at_keyword", "") in {
                    "container",
                    "document",
                    "layer",
                    "media",
                    "scope",
                    "starting-style",
                    "supports",
                }
            ):
                nested = tinycss2.parse_rule_list(
                    rule.content,
                    skip_comments=False,
                    skip_whitespace=False,
                )
                inspect_rules(nested, f"{context}/@{rule.lower_at_keyword}")

    stylesheet = tinycss2.parse_stylesheet(
        text,
        skip_comments=False,
        skip_whitespace=False,
    )
    inspect_rules(stylesheet, "stylesheet")
    return errors


def scan_css(report: AuditReport, repo_name: str, root: Path) -> None:
    failures: list[str] = []
    count = 0

    for path in iter_files(root, {".css"}):
        count += 1
        rel = path.relative_to(root)
        text = path.read_text(encoding="utf-8")
        for error in css_parse_errors(text):
            failures.append(f"{rel}: {error}")

        for match in CSS_IMPORT_PATTERN.finditer(text):
            target = match.group(1).strip()
            if target.startswith(("http:", "https:", "data:")):
                continue
            candidate = (path.parent / target).resolve()
            try:
                candidate.relative_to(root.resolve())
            except ValueError:
                failures.append(f"{rel}: @import escapes repository: {target}")
                continue
            if not candidate.is_file():
                failures.append(f"{rel}: missing @import target {target}")

        for match in LOCAL_CSS_URL_PATTERN.finditer(text):
            target = match.group(1).strip()
            if (
                not target
                or target.startswith(("#", "data:", "http:", "https:", "blob:"))
                or target.startswith("var(")
            ):
                continue
            target_without_query = target.split("?", 1)[0].split("#", 1)[0]
            candidate = (path.parent / target_without_query).resolve()
            try:
                candidate.relative_to(root.resolve())
            except ValueError:
                continue
            if not candidate.exists():
                failures.append(f"{rel}: missing local url() target {target}")

    report.record(
        f"{repo_name}: CSS parsing and local references",
        not failures,
        f"parsed {count} stylesheets" + (f"\n" + "\n".join(failures[:60]) if failures else ""),
    )


def scan_html_ids(report: AuditReport, repo_name: str, root: Path) -> None:
    failures: list[str] = []
    count = 0
    for path in iter_files(root, {".html"}):
        count += 1
        parser = IdCollector()
        try:
            parser.feed(path.read_text(encoding="utf-8"))
        except Exception as error:
            failures.append(f"{path.relative_to(root)}: HTML parser error: {error}")
            continue
        duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
        if duplicates:
            failures.append(f"{path.relative_to(root)}: duplicate ids {duplicates}")

    report.record(
        f"{repo_name}: static HTML duplicate IDs",
        not failures,
        f"parsed {count} HTML files" + (f"\n" + "\n".join(failures[:40]) if failures else ""),
    )


def scan_relative_imports(report: AuditReport, repo_name: str, root: Path) -> None:
    failures: list[str] = []
    count = 0
    resolved_count = 0
    root_resolved = root.resolve()

    for source in iter_files(root, {".js", ".mjs", ".cjs"}):
        count += 1
        text = source.read_text(encoding="utf-8")
        imports = {
            match.group(1)
            for pattern in RELATIVE_IMPORT_PATTERNS
            for match in pattern.finditer(text)
        }
        for specifier in sorted(imports):
            plain = specifier.split("?", 1)[0].split("#", 1)[0]
            candidate = (source.parent / plain).resolve()
            try:
                candidate.relative_to(root_resolved)
            except ValueError:
                continue
            choices = [candidate]
            if not candidate.suffix:
                choices.extend(
                    [
                        candidate.with_suffix(".js"),
                        candidate.with_suffix(".json"),
                        candidate / "index.js",
                    ]
                )
            if not any(choice.exists() for choice in choices):
                failures.append(f"{source.relative_to(root)} -> {specifier}")
            else:
                resolved_count += 1

    report.record(
        f"{repo_name}: relative JavaScript import graph",
        not failures,
        f"scanned {count} JS files and resolved {resolved_count} local imports"
        + (f"\nMissing:\n" + "\n".join(failures[:60]) if failures else ""),
    )


def scan_manifest(report: AuditReport, repo_name: str, root: Path) -> dict[str, object]:
    path = root / "manifest.json"
    if not path.exists():
        report.record(f"{repo_name}: extension manifest", False, "manifest.json missing")
        return {}

    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except Exception as error:
        report.record(f"{repo_name}: extension manifest", False, f"cannot parse: {error}")
        return {}

    failures: list[str] = []
    for key in ("display_name", "version", "js", "loading_order"):
        if key not in manifest:
            failures.append(f"missing {key}")
    if not SEMVER_PATTERN.fullmatch(str(manifest.get("version", ""))):
        failures.append(f"invalid semantic version {manifest.get('version')!r}")
    if not isinstance(manifest.get("loading_order"), int):
        failures.append("loading_order must be an integer")
    for key in ("js", "css"):
        target = manifest.get(key)
        if target and not (root / str(target)).is_file():
            failures.append(f"{key} target does not exist: {target}")

    report.record(
        f"{repo_name}: extension manifest",
        not failures,
        f"{manifest.get('display_name')} {manifest.get('version')} "
        f"(loading_order={manifest.get('loading_order')})"
        + (f"\n" + "\n".join(failures) if failures else ""),
    )
    return manifest


def run_js_syntax(report: AuditReport, repo_name: str, root: Path) -> None:
    failures: list[str] = []
    checked = 0
    for path in iter_files(root, {".js", ".mjs", ".cjs"}):
        checked += 1
        completed = subprocess.run(
            ["node", "--check", str(path)],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        if completed.returncode != 0:
            failures.append(
                f"{path.relative_to(root)}:\n{completed.stdout.strip()[-2500:]}"
            )
    report.record(
        f"{repo_name}: JavaScript syntax",
        not failures,
        f"checked {checked} files" + (f"\n" + "\n".join(failures[:20]) if failures else ""),
    )


def run_node_tests(report: AuditReport, repo_name: str, root: Path) -> None:
    tests = sorted((root / "tests").glob("*.test.js")) if (root / "tests").exists() else []
    if not tests:
        report.record(
            f"{repo_name}: Node regression tests",
            False,
            "no tests/*.test.js found",
            warning=True,
        )
        return
    run_command(
        report,
        f"{repo_name}: Node regression tests",
        ["node", "--test", *[str(path) for path in tests]],
        root,
        timeout=240,
    )


def cross_repo_checks(
    report: AuditReport,
    repos: dict[str, Path],
    manifests: dict[str, dict[str, object]],
) -> None:
    preset = repos["NemoPresetExt"]
    ui = repos["NemoUIOverhaul"]
    bridge = repos["NemoPromptTools"]

    expected_versions = {
        "NemoPresetExt": "6.0.0",
        "NemoUIOverhaul": "1.2.0",
        "NemoPromptTools": "1.2.0",
    }
    for name, expected in expected_versions.items():
        actual = str(manifests.get(name, {}).get("version", ""))
        report.record(
            f"cross-repo: {name} release version",
            actual == expected,
            f"expected {expected}, found {actual}",
        )

    try:
        orders = {
            name: int(manifests[name]["loading_order"])
            for name in ("NemoPresetExt", "NemoPromptTools", "NemoUIOverhaul")
        }
        passed = orders["NemoPresetExt"] < orders["NemoPromptTools"] < orders["NemoUIOverhaul"]
        report.record(
            "cross-repo: deterministic loading order",
            passed,
            json.dumps(orders, sort_keys=True),
        )
    except Exception as error:
        report.record("cross-repo: deterministic loading order", False, str(error))

    bridge_manifest = manifests.get("NemoPromptTools", {})
    report.record(
        "cross-repo: bridge has no manifest-level CSS",
        "css" not in bridge_manifest,
        f"manifest keys: {sorted(bridge_manifest)}",
    )

    feature_settings = (preset / "core/feature-settings.js").read_text(encoding="utf-8")
    report.record(
        "cross-repo: fresh and invalid modes resolve to Classic 3.4",
        "promptUiMode: PROMPT_UI_MODES.CLASSIC" in feature_settings
        and re.search(
            r"normalizePromptUiMode[\s\S]+?:\s*PROMPT_UI_MODES\.CLASSIC\s*;",
            feature_settings,
        )
        is not None,
        "checked default and fallback",
    )
    report.record(
        "cross-repo: standalone users retain Modern during migration",
        "settings.promptUiMode = PROMPT_UI_MODES.MODERN" in feature_settings,
        "checked PromptTools migration assignment",
    )

    readme = (preset / "README.md").read_text(encoding="utf-8")
    report.record(
        "cross-repo: documentation matches Classic default",
        "New installations default to **Classic 3.4**" in readme
        and "`promptUiMode`: `classic`" in readme
        and "New installations default to **Classic+**" not in readme,
        "checked README mode statements",
    )

    catalog = (preset / "features/hub/catalog.js").read_text(encoding="utf-8")
    report.record(
        "cross-repo: Hub no longer offers standalone PromptTools",
        "NemoVonNirgend/NemoPromptTools" not in catalog
        and "nemo-prompt-tools" not in catalog.lower(),
        "checked features/hub/catalog.js",
    )

    content = (preset / "content.js").read_text(encoding="utf-8")
    publish_call = content.rfind("\npublishPublicApi();")
    bootstrap_if = content.find("\nif (document.querySelector('#left-nav-panel'))")
    report.record(
        "cross-repo: merged capability publishes before asynchronous initialization",
        publish_call != -1 and bootstrap_if != -1 and publish_call < bootstrap_if,
        f"publish offset={publish_call}, bootstrap offset={bootstrap_if}",
    )

    bridge_index = (bridge / "index.js").read_text(encoding="utf-8")
    report.record(
        "cross-repo: bridge gates standalone CSS and runtime behind capability detection",
        "window.NemoPresetExt?.capabilities?.promptTools === true" in bridge_index
        and "await waitForMergedCapability()" in bridge_index
        and "await loadStandaloneStyles()" in bridge_index
        and "await import('./standalone-runtime.js')" in bridge_index
        and not re.search(r"^import\s+['\"].*styles\.css", bridge_index, re.MULTILINE),
        "checked compatibility bootstrap",
    )

    ui_check_script = ui / "scripts/remove_prompt_ui_css.py"
    if ui_check_script.exists():
        run_command(
            report,
            "cross-repo: UIOverhaul prompt-selector ownership check",
            [sys.executable, str(ui_check_script), "--check"],
            ui,
            timeout=180,
        )
    else:
        report.record(
            "cross-repo: UIOverhaul prompt-selector ownership check",
            False,
            "scripts/remove_prompt_ui_css.py missing",
        )

    ui_index = (ui / "index.js").read_text(encoding="utf-8")
    forbidden_runtime_names = (
        "NemoPresetManager",
        "NemoPromptManager",
        "initPresetNavigatorForApi",
        "NemoCharacterManager",
    )
    leaked = [name for name in forbidden_runtime_names if name in ui_index]
    report.record(
        "cross-repo: UIOverhaul runtime has no prompt-workstation imports",
        not leaked,
        f"leaked symbols: {leaked}" if leaked else "no prompt runtime symbols found",
    )

    stale_default_hits: list[str] = []
    for path in iter_files(preset, TEXT_SUFFIXES):
        rel = path.relative_to(preset)
        text = path.read_text(encoding="utf-8")
        if "default to **Classic+**" in text or "receive Classic+ and prompt workstation defaults" in text:
            stale_default_hits.append(str(rel))
    report.record(
        "cross-repo: no stale Classic+ default statements",
        not stale_default_hits,
        f"hits: {stale_default_hits}" if stale_default_hits else "none",
    )

    timeout_match = re.search(r"waitForMergedCapability\(timeout\s*=\s*(\d+)\)", bridge_index)
    timeout_value = int(timeout_match.group(1)) if timeout_match else 0
    report.record(
        "cross-repo: bridge capability wait is non-trivial",
        timeout_value >= 500,
        f"timeout={timeout_value}ms",
        warning=timeout_value < 500,
    )


def write_report(report: AuditReport, output: Path) -> None:
    payload = {
        "summary": {
            "status": "failed" if report.errors else ("warning" if report.warnings else "passed"),
            "passed": sum(check.status == "pass" for check in report.checks),
            "warnings": len(report.warnings),
            "failures": len(report.errors),
        },
        "repositories": report.repositories,
        "checks": [asdict(check) for check in report.checks],
        "errors": report.errors,
        "warnings": report.warnings,
    }
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    markdown = output.with_suffix(".md")
    lines = [
        "# Nemo post-merge audit",
        "",
        f"**Status:** {payload['summary']['status'].upper()}",
        "",
        f"- Passed checks: {payload['summary']['passed']}",
        f"- Warnings: {payload['summary']['warnings']}",
        f"- Failures: {payload['summary']['failures']}",
        "",
        "## Checks",
        "",
    ]
    for check in report.checks:
        icon = {"pass": "✅", "warning": "⚠️", "fail": "❌"}[check.status]
        detail = check.detail.replace("\n", "<br>") if check.detail else ""
        lines.append(f"- {icon} **{check.name}**" + (f": {detail}" if detail else ""))
    markdown.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    repos = {
        "NemoPresetExt": args.workspace / "NemoPresetExt",
        "NemoUIOverhaul": args.workspace / "NemoUIOverhaul",
        "NemoPromptTools": args.workspace / "NemoPromptTools",
    }

    report = AuditReport()
    manifests: dict[str, dict[str, object]] = {}

    for name, root in repos.items():
        if not root.is_dir():
            report.record(f"{name}: checkout exists", False, str(root))
            continue
        report.repositories[name] = {
            "path": str(root),
            "commit": subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=root,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                check=False,
            ).stdout.strip(),
        }
        scan_encoding_and_conflicts(report, name, root)
        scan_json_and_yaml(report, name, root)
        scan_css(report, name, root)
        scan_html_ids(report, name, root)
        scan_relative_imports(report, name, root)
        manifests[name] = scan_manifest(report, name, root)
        run_js_syntax(report, name, root)
        run_node_tests(report, name, root)

    if all(name in manifests for name in repos):
        cross_repo_checks(report, repos, manifests)

    write_report(report, args.output)
    print(args.output.read_text(encoding="utf-8"))
    return 1 if report.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
