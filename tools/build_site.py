#!/usr/bin/env python3
"""Build the Agentic AI site: content/ (Markdown + TOML front matter) -> dist/ (plain static files).

Run from the repo root:
  macOS:   .venv/bin/python tools/build_site.py [--serve] [--port 8000] [--no-search] [--out dist-11]
  Windows: .venv\\Scripts\\python tools\\build_site.py [--serve] [--port 8000] [--no-search] [--out dist-11]

Pages link to each other with relative URLs, so dist/ also opens straight from disk.
Parallel sessions build into their own folder (--out dist-<module>) and serve it on their own port.
Search needs the site served over http (--serve, or any static host such as Vercel).

Content: content/modules.toml lists the modules; content/<module>/index.md is a module's landing text and
content/<module>/NN-name.md are its lessons (TOML front matter between +++ lines). Lessons have no fixed outline:
short and to the point, with only the sections the topic needs (see content/00-project-setup).
A built visual is content/<module>/visuals/<id>.html (+ optional .js and .css), placed with `::: visual <id>`.
Pages never mention the course, the instructor or how the site works: course mapping stays in course/ and in
each lesson's `source` front matter.
Markdown extensions:
  ::: in-short | note [Title] | tip | key | warn | windows | check | visual id | Kind | Title
  ::: practice                                   first paragraph = the task (always shown); the rest = the solution,
                                                 collapsed until the reader opens it
  ```lang title="file.py" hl="2-4" compact     code cell; a trailing `# (1)` becomes annotation marker 1
  ::: annots                                     ordered list explaining the markers of the code cell above
  :::: tabs  +  ::: tab Gemini  ...  :::  +  ::::  one panel per alternative (providers, loaders); readers click a
                                                 title, every group on the page with that title follows, and the
                                                 choice is remembered; a tab can't hold
                                                 other ::: blocks (same-length markers don't nest)
  ::: explain Title                              a collapsed box holding a longer explanation, opened on click
  ```python title="app.py" explain  +  ::: walkthrough  the cell gets an Explain button; the walkthrough right after
                                                 it (code chunks, each followed by its explanation) replaces the
                                                 code while the button is on
  ```output real|saved|illustrative note="..." output panel attached to the code cell above
  ```output real image="plots/a.svg" alt="..."  also shows that image (plots saved by tools/run_outputs.py) under the text
  [text](lesson:0.3), [text](module:05)          links resolved to the right page
  **VERIFY**                                     rendered as a VERIFY badge
content/<module>/plots/ and content/<module>/data/ (downloads such as CSV files) are copied next to the pages.
"""
from __future__ import annotations

import argparse
import functools
import hashlib
import html
import http.server
import importlib.util
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

if sys.version_info < (3, 11):
    sys.exit("Python 3.11+ is required (the build reads TOML with tomllib).")
import tomllib

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape
from markdown_it import MarkdownIt
from markupsafe import Markup
from mdit_py_plugins.container import container_plugin
from pygments import lex
from pygments.lexers import get_lexer_by_name
from pygments.token import Comment, Keyword, Name, Number, Operator, String
from pygments.util import ClassNotFound

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
SITE = ROOT / "site"
DESIGN = ROOT / "design"
DIST = ROOT / "dist"
SITE_NAME = "Agentic AI"

LESSON_TYPES = {"concept", "build", "project"}
LESSON_STATUS = {"planned", "draft", "published"}


# --------------------------------------------------------------------------- reporting

class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, where: object, msg: str) -> None:
        self.errors.append(f"{where}: {msg}")

    def warn(self, where: object, msg: str) -> None:
        self.warnings.append(f"{where}: {msg}")


REPORT = Report()


# --------------------------------------------------------------------------- content model

FRONT_MATTER = re.compile(r"\A\+\+\+\r?\n(.*?)\r?\n\+\+\+[ \t]*(?:\r?\n|\Z)(.*)\Z", re.S)


def read_doc(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    match = FRONT_MATTER.match(text)
    if not match:
        return {}, text
    try:
        return tomllib.loads(match.group(1)), match.group(2)
    except tomllib.TOMLDecodeError as exc:
        REPORT.error(path.relative_to(ROOT), f"front matter is not valid TOML: {exc}")
        return {}, match.group(2)


@dataclass
class Lesson:
    module: "Module"
    path: Path
    meta: dict
    body: str

    @property
    def number(self) -> str:
        return str(self.meta.get("number", ""))

    @property
    def title(self) -> str:
        return self.meta.get("title", self.path.stem)

    @property
    def planned(self) -> bool:
        return self.meta.get("status") == "planned"

    @property
    def url(self) -> str:
        return f"{self.module.slug}/{self.path.stem}.html"

    @property
    def label(self) -> str:
        return self.title


@dataclass
class Module:
    number: str
    slug: str
    title: str
    summary: str
    part: str
    lessons: list[Lesson] = field(default_factory=list)
    intro: str = ""

    @property
    def url(self) -> str:
        return f"{self.slug}/index.html"

    @property
    def label(self) -> str:
        return self.title

    @property
    def pages(self) -> list[Lesson]:
        return [lesson for lesson in self.lessons if not lesson.planned]


def load_site() -> tuple[list[Module], dict, str]:
    data = tomllib.loads((CONTENT / "modules.toml").read_text(encoding="utf-8"))
    modules: list[Module] = []
    for entry in data.get("module", []):
        module = Module(
            number=entry["number"], slug=entry["slug"], title=entry["title"],
            summary=entry.get("summary", ""), part=entry.get("part", ""),
        )
        folder = CONTENT / module.slug
        if folder.is_dir():
            index = folder / "index.md"
            if index.exists():
                _, module.intro = read_doc(index)
            for path in sorted(folder.glob("[0-9][0-9]-*.md")):
                meta, body = read_doc(path)
                lesson = Lesson(module, path, meta, body)
                validate_lesson(lesson)
                module.lessons.append(lesson)
        modules.append(module)

    known = {m.slug for m in modules}
    for folder in CONTENT.iterdir():
        if folder.is_dir() and folder.name not in known:
            REPORT.error(folder.relative_to(ROOT), "folder is not listed in content/modules.toml")

    home_meta, home_body = read_doc(CONTENT / "index.md")
    return modules, home_meta, home_body


def validate_lesson(lesson: Lesson) -> None:
    where = lesson.path.relative_to(ROOT)
    meta = lesson.meta
    for key in ("number", "title", "summary", "type", "status"):
        if not meta.get(key):
            REPORT.error(where, f"front matter needs `{key}`")
    if meta.get("type") and meta["type"] not in LESSON_TYPES:
        REPORT.error(where, f"type must be one of {sorted(LESSON_TYPES)}")
    if meta.get("status") and meta["status"] not in LESSON_STATUS:
        REPORT.error(where, f"status must be one of {sorted(LESSON_STATUS)}")
    number = str(meta.get("number", ""))
    if number and number.split(".")[0] != str(int(lesson.module.number)):
        REPORT.error(where, f"lesson number {number} does not belong to module {lesson.module.number}")
    if lesson.planned:
        return
    for key in ("lede", "source"):
        if not meta.get(key):
            REPORT.error(where, f"front matter needs `{key}`")


# --------------------------------------------------------------------------- code highlighting

LANG_LABELS = {
    "python": "Python", "py": "Python", "zsh": "zsh", "bash": "bash", "sh": "Shell", "shell": "Shell",
    "console": "Shell", "toml": "TOML", "json": "JSON", "ini": "INI", "yaml": "YAML",
    "powershell": "PowerShell", "pwsh": "PowerShell", "html": "HTML", "text": "", "": "",
}
LEXER_ALIASES = {"zsh": "bash", "shell": "bash", "sh": "bash", "console": "bash", "pwsh": "powershell"}
MARKER = re.compile(r"\s*#\s*\((\d+)\)\s*$")
INFO_ATTR = re.compile(r'(\w+)="([^"]*)"')


def parse_info(info: str) -> tuple[str, dict[str, str], set[str]]:
    lang, _, rest = info.strip().partition(" ")
    return lang.lower(), dict(INFO_ATTR.findall(rest)), set(INFO_ATTR.sub(" ", rest).split())


def token_class(ttype, shell: bool = False) -> str:
    """Map Pygments tokens onto the six code classes in theme.css."""
    if ttype in Comment:
        return "c"
    if ttype in String.Interpol:
        return ""
    if ttype in String:
        return "s"
    if ttype in Number:
        return "" if shell else "n"  # shell lexers split versions like 3.12 into a number and text
    if ttype in Name.Variable:
        return "n"
    if ttype in Keyword.Type or ttype in Name.Builtin or ttype in Name.Exception:
        return "b"
    if ttype in Keyword or ttype in Operator.Word:
        return "k"
    if ttype in Name.Function or ttype in Name.Class or ttype in Name.Decorator:
        return "f"
    return ""


def highlight(code: str, lang: str) -> tuple[list[str], dict[int, str]]:
    """Return one HTML string per source line, plus {line number: annotation marker}."""
    markers: dict[int, str] = {}
    lines = code.split("\n")
    for number, line in enumerate(lines, 1):
        match = MARKER.search(line)
        if match:
            markers[number] = match.group(1)
            lines[number - 1] = line[:match.start()]
    name = LEXER_ALIASES.get(lang, lang)
    try:
        lexer = get_lexer_by_name(name, stripnl=False, ensurenl=False) if name not in ("", "text") else None
    except ClassNotFound:
        lexer = None
    if lexer is None:
        return [html.escape(line, quote=False) for line in lines], markers
    shell = name in ("bash", "powershell")
    out: list[list[list[str]]] = [[]]  # per line: [css class, text] runs
    for ttype, value in lex("\n".join(lines), lexer):
        css = token_class(ttype, shell)
        for i, part in enumerate(value.split("\n")):
            if i:
                out.append([])
            if not part:
                continue
            if out[-1] and out[-1][-1][0] == css:
                out[-1][-1][1] += part
            else:
                out[-1].append([css, part])
    rendered = []
    for runs in out[:len(lines)]:
        rendered.append("".join(
            f'<span class="{css}">{html.escape(text, quote=False)}</span>' if css else html.escape(text, quote=False)
            for css, text in runs))
    return rendered, markers


def parse_ranges(spec: str) -> set[int]:
    result: set[int] = set()
    for part in filter(None, (p.strip() for p in spec.split(","))):
        start, _, end = part.partition("-")
        result.update(range(int(start), int(end or start) + 1))
    return result


EXPLAIN_BUTTON = ('<button class="explain-toggle" type="button" data-explain-toggle aria-pressed="false">'
                  '<svg class="icon"><use href="#i-bulb"/></svg><span>Explain</span></button>')
COPY_BUTTON = ('<button class="copy" type="button" data-copy><svg class="icon"><use href="#i-copy"/></svg>'
               '<span>Copy</span></button>')


def render_output(token, where: str) -> str:
    _, attrs, flags = parse_info(token.info)
    kind = next((k for k in ("real", "saved", "illustrative") if k in flags), None)
    if kind is None:
        REPORT.warn(where, "output block needs `real`, `saved` or `illustrative`; treated as illustrative")
        kind = "illustrative"
    css, text = {"real": ("badge--real", "Real output"), "saved": ("badge--real", "Saved output"),
                 "illustrative": ("badge--illus", "Illustrative")}[kind]
    if attrs.get("note"):
        text += " · " + attrs["note"]
    is_open = "" if "collapsed" in flags else " open"
    body = html.escape(token.content.rstrip("\n"), quote=False)
    images = [src for src in attrs.get("image", "").split("|") if src]
    if images and not attrs.get("alt"):
        REPORT.warn(where, "output block with an image needs alt=\"...\"")
    parts = [f"<pre>{body}</pre>"] if body or not images else []
    parts += [f'<div class="out-img"><img src="{html.escape(src)}" alt="{html.escape(attrs.get("alt", ""))}" '
              'loading="lazy"></div>' for src in images]
    return (f'<details class="out"{is_open}><summary><span class="label">Output</span>'
            f'<span class="badge {css}">{html.escape(text)}</span></summary>\n' + "\n".join(parts) + '\n</details>\n')


# --------------------------------------------------------------------------- markdown

CALLOUTS = {"note": ("i-info", "Note"), "tip": ("i-bulb", "Tip"), "key": ("i-star", "Key idea"),
            "warn": ("i-alert", "Watch out")}


def slugify(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "section"


def attach_code_parts(state) -> None:
    """Move an `::: annots` list and an ```output block into the code fence they belong to."""
    tokens, out, i = state.tokens, [], 0
    while i < len(tokens):
        token = tokens[i]
        if token.type == "fence" and not token.info.strip().startswith("output"):
            j = i + 1
            if j < len(tokens) and tokens[j].type == "container_annots_open":
                depth, k = 0, j
                while k < len(tokens):
                    depth += {"container_annots_open": 1, "container_annots_close": -1}.get(tokens[k].type, 0)
                    if depth == 0:
                        break
                    k += 1
                token.meta["annots"] = tokens[j + 1:k]
                j = k + 1
            if j < len(tokens) and tokens[j].type == "fence" and tokens[j].info.strip().startswith("output"):
                token.meta["output"] = tokens[j]
                j += 1
            out.append(token)
            i = j
            continue
        out.append(token)
        i += 1
    state.tokens = out


def lift_check_questions(state) -> None:
    """The first paragraph inside `::: check` or `::: practice` becomes the text shown in the summary."""
    tokens, out, i = state.tokens, [], 0
    while i < len(tokens):
        token = tokens[i]
        out.append(token)
        if (token.type in ("container_check_open", "container_practice_open") and i + 3 < len(tokens)
                and [t.type for t in tokens[i + 1:i + 4]] == ["paragraph_open", "inline", "paragraph_close"]):
            token.meta["question"] = tokens[i + 2]
            i += 4
            continue
        i += 1
    state.tokens = out


def resolve_visuals(state) -> None:
    """A built visual (content/<module>/visuals/<id>.html) replaces the storyboard placeholder text."""
    ctx = state.env.get("ctx")
    tokens, out, skip_to = state.tokens, [], None
    for i, token in enumerate(tokens):
        if skip_to is not None:
            if i < skip_to:
                continue
            skip_to = None
        out.append(token)
        if token.type == "container_visual_open" and ctx is not None:
            vid = token.info.strip()[len("visual"):].split("|")[0].strip()
            if ctx.visual_partial(vid) is not None:
                depth = 0
                for k in range(i, len(tokens)):
                    depth += {"container_visual_open": 1, "container_visual_close": -1}.get(tokens[k].type, 0)
                    if depth == 0:
                        skip_to = k
                        break
    state.tokens = out


def render_fence(self, tokens, idx, options, env):
    token = tokens[idx]
    ctx = env["ctx"]
    lang, attrs, flags = parse_info(token.info)
    if lang == "output":
        return f'<figure class="code-cell">{render_output(token, ctx.where)}</figure>\n'
    code = token.content[:-1] if token.content.endswith("\n") else token.content
    lines, markers = highlight(code, lang)
    marked = parse_ranges(attrs.get("hl", ""))
    rows = []
    for number, line in enumerate(lines, 1):
        css = "line is-hl" if number in marked else "line"
        marker = f'<span class="annot-ref">{markers[number]}</span>' if number in markers else ""
        rows.append(f'<span class="{css}">{line}{marker}</span>')
    label = LANG_LABELS.get(lang, lang.upper())
    explain_button = (EXPLAIN_BUTTON if "explain" in flags else "")
    head = (f'<figcaption class="code-head"><span>{html.escape(attrs.get("title", ""))}</span>'
            + (f'<span class="lang">{label}</span>' if label else '<span class="spacer"></span>')
            + explain_button + COPY_BUTTON + "</figcaption>")
    pre_class = ' class="is-compact"' if "compact" in flags else ""
    figure_attr = " data-explainable" if "explain" in flags else ""
    parts = [f'<figure class="code-cell"{figure_attr}>{head}\n<pre{pre_class}><code>' + "\n".join(rows) + "</code></pre>\n"]
    if token.meta.get("annots"):
        items, current = [], []
        for t in token.meta["annots"]:
            if t.type == "list_item_open":
                current = []
            elif t.type == "list_item_close":
                items.append(f"<li><div>{self.render(current, options, env).strip()}</div></li>")
            elif t.type not in ("ordered_list_open", "ordered_list_close", "bullet_list_open", "bullet_list_close"):
                current.append(t)
        if len(items) != len(markers):
            REPORT.warn(ctx.where, f"code cell has {len(markers)} markers but {len(items)} annotations")
        parts.append('<ol class="annots">\n' + "\n".join(items) + "\n</ol>\n")
    elif markers:
        REPORT.warn(ctx.where, "code cell has annotation markers but no `::: annots` list after it")
    if token.meta.get("output"):
        parts.append(render_output(token.meta["output"], ctx.where))
    return "".join(parts) + "</figure>\n"


def render_heading_open(self, tokens, idx, options, env):
    token = tokens[idx]
    inline = tokens[idx + 1]
    slug, n = slugify(inline.content), 2
    base = slug
    while slug in env["slugs"]:
        slug, n = f"{base}-{n}", n + 1
    env["slugs"].add(slug)
    token.attrSet("id", slug)
    if token.tag == "h2":
        env["toc"].append((slug, Markup(self.renderInline(inline.children, options, env))))
    return self.renderToken(tokens, idx, options, env)


def render_link_open(self, tokens, idx, options, env):
    token = tokens[idx]
    href = token.attrGet("href") or ""
    if href.startswith(("lesson:", "module:")):
        token.attrSet("href", env["ctx"].resolve(href))
    return self.renderToken(tokens, idx, options, env)


def render_callout(self, tokens, idx, options, env):
    token = tokens[idx]
    if token.nesting != 1:
        return "</div></div>\n"
    kind, _, title = token.info.strip().partition(" ")
    icon, default = CALLOUTS[kind]
    title_html = MD.renderInline(title.strip()) if title.strip() else default
    return (f'<div class="callout callout--{kind}"><svg class="icon"><use href="#{icon}"/></svg>'
            f'<div class="callout-body"><b class="title">{title_html}</b>\n')


def render_in_short(self, tokens, idx, options, env):
    if tokens[idx].nesting != 1:
        return "</section>\n"
    env["has_in_short"] = True
    return ('<section class="card tldr" id="in-short" aria-labelledby="in-short-label">\n'
            '<span class="label" id="in-short-label">In short</span>\n')


def render_windows(self, tokens, idx, options, env):
    if tokens[idx].nesting != 1:
        return "</div></div>\n"
    return '<div class="os-note"><span class="os-tag">Windows</span><div class="os-body">\n'


def render_check(self, tokens, idx, options, env):
    token = tokens[idx]
    if token.nesting != 1:
        return "</div></details>\n"
    env["checks"] += 1
    question = token.meta.get("question")
    q_html = self.renderInline(question.children, options, env) if question else ""
    return (f'<details class="card check"><summary><span class="label">Question {env["checks"]}</span>'
            f'<span class="q">{q_html}</span><span class="reveal">Show answer</span></summary>\n'
            '<div class="check-answer">\n')


def render_practice(self, tokens, idx, options, env):
    token = tokens[idx]
    if token.nesting != 1:
        return "</div></details>\n"
    env["practices"] += 1
    task = token.meta.get("question")
    if task is None:
        REPORT.warn(env["ctx"].where, "`::: practice` must start with a one-paragraph task")
    task_html = self.renderInline(task.children, options, env) if task else ""
    return (f'<details class="card check practice"><summary><span class="label">Practice {env["practices"]}</span>'
            f'<span class="q">{task_html}</span><span class="reveal">Show solution</span></summary>\n'
            '<div class="check-answer">\n')


def render_visual(self, tokens, idx, options, env):
    token = tokens[idx]
    if token.nesting != 1:
        return env["visual_close"].pop()
    parts = [p.strip() for p in token.info.strip()[len("visual"):].split("|")]
    vid = parts[0]
    kind = parts[1] if len(parts) > 1 else "Visual"
    title = parts[2] if len(parts) > 2 else ""
    partial = env["ctx"].visual_partial(vid)
    if partial is not None:
        env["visual_close"].append("</div>\n")
        return f'<div class="visual" data-visual="{html.escape(vid)}">\n{partial}\n'
    env["visual_close"].append("</div></figure>\n")
    return (f'<figure class="card visual-pending" data-visual="{html.escape(vid)}">'
            f'<div class="vp-head"><span class="label">{html.escape(kind)}</span>'
            '<span class="badge badge--illus">Storyboard awaiting approval</span></div>'
            f'<b class="vp-title">{MD.renderInline(title)}</b><div class="vp-body">\n')


def render_annots_stray(self, tokens, idx, options, env):
    if tokens[idx].nesting == 1:
        REPORT.warn(env["ctx"].where, "`::: annots` must directly follow a code block")
    return ""


def render_explain(self, tokens, idx, options, env):
    """`::: explain Title`: a collapsed box with the longer explanation of a step (title shown, body on click)."""
    token = tokens[idx]
    if token.nesting != 1:
        return "</div></details>\n"
    title = token.info.strip()[len("explain"):].strip() or "Explain"
    return (f'<details class="card check explain"><summary><span class="label">Explain</span>'
            f'<span class="q">{MD.renderInline(title)}</span><span class="reveal">Show</span></summary>\n'
            '<div class="check-answer">\n')


def render_walkthrough(self, tokens, idx, options, env):
    """`::: walkthrough` after a code cell marked `explain`: hidden until that cell's Explain button is pressed."""
    if tokens[idx].nesting != 1:
        return "</div>\n"
    return '<div class="walkthrough" data-walkthrough hidden>\n'


def render_tabs(self, tokens, idx, options, env):
    """`:::: tabs` holds `::: tab Title` panels; the tab bar is built from the panels' titles."""
    stack = env.setdefault("tabs_stack", [])
    if tokens[idx].nesting != 1:
        stack.pop()
        return "</div>\n"
    env["tab_groups"] = group = env.get("tab_groups", 0) + 1
    titles, depth = [], 0
    for k in range(idx + 1, len(tokens)):
        kind = tokens[k].type
        if kind == "container_tabs_open":
            depth += 1
        elif kind == "container_tabs_close":
            if depth == 0:
                break
            depth -= 1
        elif kind == "container_tab_open" and depth == 0:
            titles.append(tokens[k].info.strip()[len("tab"):].strip() or f"Option {len(titles) + 1}")
    if not titles:
        REPORT.warn(env["ctx"].where, "`:::: tabs` needs `::: tab Title` panels inside")
    stack.append([group, 0])
    buttons = "".join(
        f'<button type="button" role="tab" id="tab-{group}-{i}" aria-controls="panel-{group}-{i}" '
        f'aria-selected="{"true" if i == 0 else "false"}" tabindex="{0 if i == 0 else -1}" '
        f'data-tab-title="{html.escape(title)}">{MD.renderInline(title)}</button>'
        for i, title in enumerate(titles))
    return f'<div class="tabs" data-tabs><div class="tab-list" role="tablist">{buttons}</div>\n'


def render_tab(self, tokens, idx, options, env):
    stack = env.setdefault("tabs_stack", [])
    if tokens[idx].nesting != 1:
        return "</div>\n"
    if not stack:
        REPORT.warn(env["ctx"].where, "`::: tab` must sit inside `:::: tabs`")
        return '<div class="tab-panel">\n'
    group, i = stack[-1]
    stack[-1][1] += 1
    hidden = " hidden" if i else ""
    return (f'<div class="tab-panel" role="tabpanel" id="panel-{group}-{i}" '
            f'aria-labelledby="tab-{group}-{i}"{hidden}>\n')


def make_markdown() -> MarkdownIt:
    md = MarkdownIt("commonmark", {"html": True}).enable(["table", "strikethrough"])
    for name in CALLOUTS:
        container_plugin(md, name, render=render_callout)
    container_plugin(md, "in-short", render=render_in_short)
    container_plugin(md, "windows", render=render_windows)
    container_plugin(md, "check", render=render_check)
    container_plugin(md, "practice", render=render_practice)
    container_plugin(md, "visual", render=render_visual)
    container_plugin(md, "annots", render=render_annots_stray)
    container_plugin(md, "tabs", render=render_tabs)
    container_plugin(md, "tab", render=render_tab)
    container_plugin(md, "explain", render=render_explain)
    container_plugin(md, "walkthrough", render=render_walkthrough)
    md.core.ruler.push("attach_code_parts", attach_code_parts)
    md.core.ruler.push("lift_check_questions", lift_check_questions)
    md.core.ruler.push("resolve_visuals", resolve_visuals)
    md.add_render_rule("fence", render_fence)
    md.add_render_rule("heading_open", render_heading_open)
    md.add_render_rule("link_open", render_link_open)
    return md


MD = make_markdown()


class PageContext:
    """What the Markdown renderer needs to know about the page being built."""

    def __init__(self, site: "SiteBuild", where: Path, root: str, module: Module | None) -> None:
        self.site, self.where, self.root, self.module = site, where, root, module
        self.scripts: list[str] = []
        self.styles: list[str] = []

    def resolve(self, ref: str) -> str:
        kind, _, key = ref.partition(":")
        if kind == "module":
            module = self.site.module_by_number.get(key)
            if module:
                return self.root + module.url
        else:
            lesson = self.site.lesson_by_number.get(key)
            if lesson:
                return self.root + (lesson.module.url if lesson.planned else lesson.url)
        REPORT.warn(self.where, f"unknown reference `{ref}`")
        return "#"

    def visual_partial(self, vid: str) -> str | None:
        if self.module is None:
            return None
        partial = CONTENT / self.module.slug / "visuals" / f"{vid}.html"
        if not partial.exists():
            return None
        base = f"{self.root}assets/visuals/{self.module.slug}/{vid}"
        for suffix, urls in ((".js", self.scripts), (".css", self.styles)):
            source = partial.with_suffix(suffix)
            if source.exists() and (url := f"{base}{suffix}?v={version(source)}") not in urls:
                urls.append(url)
        return partial.read_text(encoding="utf-8")


def render_markdown(text: str, ctx: PageContext) -> tuple[Markup, list]:
    env = {"ctx": ctx, "toc": [], "slugs": {"in-short"}, "checks": 0, "practices": 0, "visual_close": [],
           "has_in_short": False}
    body = MD.render(text, env)
    body = body.replace("<strong>VERIFY</strong>", '<span class="badge badge--verify">VERIFY</span>')
    body = body.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
    toc = ([("in-short", "In short")] if env["has_in_short"] else []) + env["toc"]
    return Markup(body), toc


def inline(text: str) -> Markup:
    return Markup(MD.renderInline(text or ""))


def plain(text: str) -> str:
    return re.sub(r"[`*_]", "", text or "")


def version(path: Path) -> str:
    """A short hash of a CSS or JS file, added to its URL so browsers fetch it again whenever it changes."""
    return hashlib.sha1(path.read_bytes()).hexdigest()[:10]


# --------------------------------------------------------------------------- site build

class SiteBuild:
    def __init__(self) -> None:
        self.modules, self.home_meta, self.home_body = load_site()
        self.module_by_number = {m.number: m for m in self.modules}
        self.lesson_by_number = {l.number: l for m in self.modules for l in m.lessons}
        self.reading_order: list[Module | Lesson] = []
        for module in self.modules:
            self.reading_order.append(module)
            self.reading_order.extend(module.pages)
        self.jinja = Environment(
            loader=FileSystemLoader(SITE / "templates"),
            autoescape=select_autoescape(["html"]),
            undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True,
        )
        self.sprite = Markup(load_sprite())
        self.asset_v = {"theme.css": version(DESIGN / "theme.css"),
                        "site.css": version(SITE / "static" / "site.css"),
                        "site.js": version(SITE / "static" / "site.js")}

    def nav(self, open_module: Module | None, current: Lesson | None) -> list[dict]:
        items, part = [], None
        for module in self.modules:
            is_open = module is open_module
            items.append({
                "number": module.number, "title": module.title, "url": module.url,
                "count": len(module.pages), "open": is_open,
                "part": module.part if module.part != part else "",
                "lessons": [{"title": l.title, "url": l.url, "planned": l.planned, "current": l is current}
                            for l in module.lessons] if is_open else [],
            })
            part = module.part
        return items

    def neighbours(self, page: Module | Lesson) -> tuple[dict | None, dict | None]:
        i = self.reading_order.index(page)
        prev = self.reading_order[i - 1] if i > 0 else None
        nxt = self.reading_order[i + 1] if i + 1 < len(self.reading_order) else None
        as_link = lambda p: {"url": p.url, "label": p.label} if p else None  # noqa: E731
        return as_link(prev), as_link(nxt)

    def write(self, rel: str, template: str, **context) -> None:
        target = DIST / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        page = self.jinja.get_template(template).render(site_name=SITE_NAME, sprite=self.sprite,
                                                        asset_v=self.asset_v, **context)
        target.write_text(page, encoding="utf-8")

    def build_home(self) -> None:
        ctx = PageContext(self, Path("content/index.md"), "", None)
        body, _ = render_markdown(self.home_body, ctx)
        parts: list[dict] = []
        for m in self.modules:
            if not parts or parts[-1]["name"] != m.part:
                parts.append({"name": m.part, "modules": []})
            parts[-1]["modules"].append({"number": m.number, "title": m.title, "url": m.url,
                                         "summary": inline(m.summary), "count": len(m.pages)})
        self.write("index.html", "home.html", root="", title=self.home_meta.get("title", SITE_NAME),
                   description=plain(self.home_meta.get("lede", "")), lede=inline(self.home_meta.get("lede", "")),
                   body=body, parts=parts, nav=self.nav(None, None), toc=[], scripts=ctx.scripts,
                   styles=ctx.styles, section="home")

    def build_module(self, module: Module) -> None:
        ctx = PageContext(self, Path(f"content/{module.slug}/index.md"), "../", module)
        body, _ = render_markdown(module.intro, ctx)
        prev, nxt = self.neighbours(module)
        lessons = [{"title": l.title, "url": l.url, "planned": l.planned,
                    "summary": inline(l.meta.get("summary", ""))}
                   for l in module.lessons]
        self.write(module.url, "module.html", root="../", title=module.title, description=plain(module.summary),
                   module=module, lede=inline(module.summary), chips=[], body=body, lessons=lessons,
                   prev=prev, next=nxt, nav=self.nav(module, None), toc=[], scripts=ctx.scripts,
                   styles=ctx.styles, section="module")

    def build_lesson(self, lesson: Lesson) -> None:
        meta = lesson.meta
        ctx = PageContext(self, lesson.path.relative_to(ROOT), "../", lesson.module)
        body, toc = render_markdown(lesson.body, ctx)
        chips = [{"icon": icon, "text": text} for icon, text in meta.get("chips", [])]
        chips += [{"icon": "i-key", "text": f"Needs {key}"} for key in meta.get("keys", [])]
        prev, nxt = self.neighbours(lesson)
        self.write(lesson.url, "lesson.html", root="../", title=lesson.title, description=plain(meta.get("summary", "")),
                   module=lesson.module, lesson=lesson, lede=inline(meta.get("lede", "")), chips=chips, body=body,
                   toc=toc, prev=prev, next=nxt, nav=self.nav(lesson.module, lesson), scripts=ctx.scripts,
                   styles=ctx.styles, section="lesson")

    def copy_assets(self) -> None:
        assets = DIST / "assets"
        assets.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DESIGN / "theme.css", assets / "theme.css")
        for item in (SITE / "static").iterdir():
            if item.is_file():
                shutil.copy2(item, assets / item.name)
        for module in self.modules:
            for asset in (CONTENT / module.slug / "visuals").glob("*"):
                if asset.suffix in (".js", ".css"):
                    target = assets / "visuals" / module.slug / asset.name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(asset, target)
            for folder in ("plots", "data"):  # plot images and downloads sit next to the lesson pages
                if (CONTENT / module.slug / folder).is_dir():
                    shutil.copytree(CONTENT / module.slug / folder, DIST / module.slug / folder, dirs_exist_ok=True)

    def build(self) -> None:
        if DIST.exists():
            shutil.rmtree(DIST)
        DIST.mkdir()
        self.copy_assets()
        self.build_home()
        for module in self.modules:
            self.build_module(module)
            for lesson in module.pages:
                self.build_lesson(lesson)


def load_sprite() -> str:
    """Icons: the approved set from the style board, plus site-only icons in site/icons.svg (same stroke style)."""
    board = (DESIGN / "style-board.html").read_text(encoding="utf-8")
    match = re.search(r'<svg class="sprite".*?</svg>', board, re.S)
    if not match:
        REPORT.error("design/style-board.html", "icon sprite not found")
        return ""
    extra = (SITE / "icons.svg").read_text(encoding="utf-8") if (SITE / "icons.svg").exists() else ""
    symbols = "\n".join(re.findall(r"<symbol .*?</symbol>", extra, re.S))
    return match.group(0).replace("</svg>", f"{symbols}\n</svg>")


# --------------------------------------------------------------------------- checks, search, serve

LINK = re.compile(r'(?:href|src)="([^"]+)"')


def check_links() -> None:
    for page in DIST.rglob("*.html"):
        if "pagefind" in page.relative_to(DIST).parts:
            continue
        for url in LINK.findall(page.read_text(encoding="utf-8")):
            if url.startswith(("http://", "https://", "mailto:", "#", "data:", "//")):
                continue
            target = url.split("#", 1)[0].split("?", 1)[0]
            if target and not (page.parent / target).exists():
                REPORT.warn(f"dist/{page.relative_to(DIST).as_posix()}", f"broken link: {url}")


def build_search() -> None:
    if importlib.util.find_spec("pagefind") is None:
        REPORT.warn("search", "pagefind is not installed, so the search index was skipped "
                    "(pip install -r tools/requirements.txt)")
        return
    result = subprocess.run([sys.executable, "-m", "pagefind", "--site", str(DIST)],
                            capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        REPORT.warn("search", "pagefind failed:\n" + (result.stdout + result.stderr)[-1500:])
        return
    indexed = re.search(r"Indexed (\d+) pages?", result.stdout)
    print(f"Search: indexed {indexed.group(1) if indexed else '?'} pages")


class Handler(http.server.SimpleHTTPRequestHandler):
    # Some Windows registries map .js to text/plain, which breaks module imports (search).
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
                      ".json": "application/json", ".wasm": "application/wasm", ".csv": "text/csv"}

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")  # revalidate every file, so a rebuild shows on the next load
        super().end_headers()


def serve(port: int) -> None:
    handler = functools.partial(Handler, directory=str(DIST))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"Serving {DIST.name}/ at http://localhost:{port}/  (Ctrl+C to stop)")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


def main() -> int:
    global DIST
    parser = argparse.ArgumentParser(description="Build the static site into dist/.")
    parser.add_argument("--serve", action="store_true", help="serve dist/ after building")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-search", action="store_true", help="skip the Pagefind search index")
    parser.add_argument("--out", default="dist", help="output folder in the repo: dist, or dist-<name> for a "
                        "parallel session (it is deleted and rebuilt)")
    args = parser.parse_args()
    if not re.fullmatch(r"dist(-[A-Za-z0-9_]+)?", args.out):
        print(f"error: --out must be dist or dist-<name>, not {args.out!r}")
        return 1
    DIST = ROOT / args.out

    site = SiteBuild()
    if not REPORT.errors:
        site.build()
        check_links()
        if not args.no_search:
            build_search()
    lessons = sum(len(m.pages) for m in site.modules)
    for line in REPORT.warnings:
        print(f"warning: {line}")
    for line in REPORT.errors:
        print(f"error: {line}")
    if REPORT.errors:
        return 1
    print(f"Built {len(site.modules)} modules and {lessons} lesson pages into {DIST.name}/")
    if args.serve:
        serve(args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
