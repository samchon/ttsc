/**
 * The clip surface: one editor pane, one rule, and the assistance that rule
 * publishes into it.
 *
 * Every string drawn here comes from the repository — the rule id and summary
 * from the checked rule catalog, the code and the reported line from that
 * rule's documented example, the diagnostic message captured from a real `ttsc
 * check` run. The pane is our own drawing rather than an imitation of another
 * editor's chrome, so no frame can be mistaken for a screen recording of
 * something that already shipped elsewhere.
 *
 * The scene is a pure function of time. The renderer seeks it frame by frame,
 * so a re-render is reproducible instead of racing wall-clock animation.
 */
/** Drawable width and height of the code area, measured against the render. */
const CODE_WIDTH = 846;
const CODE_HEIGHT = 600;
/** Monospace advance as a fraction of the font size, for the same face. */
const ADVANCE = 0.6;

/**
 * Fit the snippet to the pane instead of trimming it. A documented example is a
 * compiling unit, so dropping a line to make it fit would put code on screen
 * that does not reproduce the report.
 */
function metrics(code) {
  const lines = code.split("\n");
  const columns = Math.max(...lines.map((line) => line.length)) + 3;
  return Math.max(
    15,
    Math.floor(
      Math.min(
        26,
        CODE_WIDTH / (ADVANCE * columns),
        CODE_HEIGHT / (1.7 * lines.length),
      ),
    ),
  );
}

export function scene(spec) {
  const FONT = metrics(spec.code);
  const LINE_HEIGHT = Math.round(FONT * 1.7);
  const GUTTER = Math.round(FONT * 1.8);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1080px; height: 1080px; overflow: hidden; background: #06070d;
    font-family: "Segoe UI", "Malgun Gothic", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  #stage {
    position: relative; width: 1080px; height: 1080px;
    padding: 60px 62px 62px; display: flex; flex-direction: column;
    background:
      radial-gradient(1100px 640px at 16% -10%, #16214a 0%, rgba(6,7,13,0) 62%),
      radial-gradient(880px 700px at 112% 114%, #1b1233 0%, rgba(6,7,13,0) 58%),
      #06070d;
    color: #e9ecf6;
  }
  .head { display: flex; align-items: center; gap: 14px; }
  .chip {
    font-size: 22px; font-weight: 700; letter-spacing: .04em;
    padding: 8px 18px; border-radius: 999px;
    background: ${spec.accentSoft}; color: ${spec.accent};
    border: 1px solid ${spec.accentLine};
  }
  .brand { font: 600 21px/1 ui-monospace, "Cascadia Mono", Consolas, monospace; color: #6f7794; }
  .rule {
    margin-top: 20px;
    font: 700 38px/1.16 ui-monospace, "Cascadia Mono", Consolas, monospace;
    color: #ffffff; letter-spacing: -.015em; word-break: break-word;
  }
  .desc code, .pop-body code { font: 600 .92em ui-monospace, Consolas, monospace; color: #cfd6ee; }
  .desc { margin-top: 12px; font-size: 23px; line-height: 1.40; color: #949cba; max-width: 880px; }

  .pane {
    position: relative; margin-top: 30px; border-radius: 20px;
    background: linear-gradient(180deg, #0f1425 0%, #0a0e1b 100%);
    border: 1px solid #1e2540; box-shadow: 0 30px 70px rgba(0,0,0,.55);
    overflow: hidden; flex: 1;
  }
  .pane-bar {
    display: flex; align-items: center; gap: 11px; padding: 14px 24px;
    border-bottom: 1px solid #1a2039;
    font: 600 20px/1 ui-monospace, "Cascadia Mono", Consolas, monospace; color: #7b839f;
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #263053; }
  .code {
    position: relative; padding: 16px 24px 0 24px;
    font: 500 ${FONT}px/${LINE_HEIGHT}px ui-monospace, "Cascadia Mono", Consolas, monospace;
    white-space: pre; color: #cfd6ee;
  }
  .ln { display: inline-block; width: ${GUTTER}px; color: #38406a; }
  .kw { color: #c792ea; }
  .str { color: #a5e075; }
  .cm { color: #57608a; }
  .squiggle {
    display: block; height: 6px; border-radius: 3px; margin: -6px 0 0 ${GUTTER}px;
    background: repeating-linear-gradient(135deg, #ff5f6d 0 5px, transparent 5px 10px);
  }

  .pop {
    position: absolute; left: 60px; top: 0;
    min-width: 540px; max-width: 660px; border-radius: 14px; overflow: hidden;
    background: #131a30; border: 1px solid #2b3564;
    box-shadow: 0 26px 54px rgba(0,0,0,.7);
  }
  .pop-head {
    display: flex; align-items: center; gap: 12px; padding: 13px 18px;
    border-bottom: 1px solid #222a4d; background: #0f1528;
    font: 600 19px/1 ui-monospace, Consolas, monospace;
  }
  .pop-src { color: ${spec.accent}; }
  .pop-code { color: #6e779c; }
  .pop-body { padding: 15px 18px; font-size: 22px; line-height: 1.40; color: #dfe4f4; }
  .pop-foot {
    display: flex; align-items: center; gap: 10px; padding: 12px 18px;
    border-top: 1px solid #222a4d; background: rgba(96,220,160,.07);
    font: 600 19px/1.3 ui-monospace, Consolas, monospace; color: #6fe0a8;
  }
  .list { padding: 7px 0; }
  .item {
    display: flex; align-items: baseline; gap: 13px; padding: 8px 18px;
    font: 500 22px/1.2 ui-monospace, Consolas, monospace; color: #cfd6ee;
  }
  .item.on { background: rgba(80,140,255,.22); }
  .item .mark { color: ${spec.accent}; font-weight: 700; }
  .item .det { margin-left: auto; color: #6e779c; font-size: 19px; }

  .foot { display: flex; align-items: flex-end; justify-content: space-between; padding-top: 22px; }
  .meta { font-size: 22px; color: #7c84a3; }
  .site { font: 700 22px/1 ui-monospace, Consolas, monospace; color: #55b9ff; }
  .fx { opacity: 0; transform: translateY(14px); }
</style>
</head>
<body>
<div id="stage">
  <div class="head fx" id="a-head">
    <span class="chip">${esc(spec.family)}</span>
    <span class="brand">@ttsc/lint</span>
  </div>
  <div class="rule fx" id="a-rule">${esc(spec.rule)}</div>
  <div class="desc fx" id="a-desc">${rich(spec.description)}</div>

  <div class="pane fx" id="a-pane">
    <div class="pane-bar"><span class="dot"></span>${esc(spec.file)}</div>
    <div class="code" id="a-code"></div>
    <div class="pop fx" id="a-pop">${popup(spec)}</div>
  </div>

  <div class="foot">
    <div class="meta fx" id="a-meta">${esc(spec.meta)}</div>
    <div class="site fx" id="a-site">ttsc.dev</div>
  </div>
</div>
<script>
  const CODE = ${JSON.stringify(spec.code)};
  const BAD = ${JSON.stringify(spec.bad)};
  /** A completion popup has no finding to underline; only a diagnostic does. */
  const UNDERLINE = ${spec.completion ? "false" : "true"};

  const KEYWORDS = new Set(("await const let var function return export declare async new of in if else " +
    "for class interface type import from default extends implements throw try catch void yield").split(" "));

  function escape(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /**
   * One pass, one token at a time. Chained replace() calls would rescan the
   * markup they just emitted and colour the class attributes of their own spans.
   */
  function paint(text) {
    const token = /(\\/\\/[^\\n]*)|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|([A-Za-z_$][\\w$]*)/g;
    let out = "", last = 0, match;
    while ((match = token.exec(text)) !== null) {
      out += escape(text.slice(last, match.index));
      last = match.index + match[0].length;
      if (match[1]) out += '<span class="cm">' + escape(match[1]) + "</span>";
      else if (match[2]) out += '<span class="str">' + escape(match[2]) + "</span>";
      else if (KEYWORDS.has(match[3])) out += '<span class="kw">' + match[3] + "</span>";
      else out += escape(match[3]);
    }
    return out + escape(text.slice(last));
  }

  /**
   * Draw the typed prefix with line numbers, and underline the reported line
   * only once the whole snippet is on screen. A squiggle sized to the pane
   * rather than to the line would claim the wrong span of code.
   */
  function drawCode(chars, squiggle) {
    const lines = CODE.slice(0, chars).split("\\n");
    const complete = chars >= CODE.length;
    // Block comments span lines, so painting each line in isolation would treat
    // prose inside a doc comment as code and colour ordinary words as syntax.
    let inBlock = false;
    document.getElementById("a-code").innerHTML = lines
      .map((line, index) => {
        const number = '<span class="ln">' + (index + 1) + "</span>";
        const opened = inBlock;
        const opens = line.indexOf("/*");
        if (!inBlock && opens >= 0) inBlock = line.indexOf("*/", opens) < 0;
        else if (inBlock && line.indexOf("*/") >= 0) inBlock = false;
        const comment = opened || opens >= 0 || line.trimStart().startsWith("*");
        const body = comment
          ? '<span class="cm">' + escape(line) + "</span>"
          : paint(line) || "&nbsp;";
        if (!complete || line !== BAD || !UNDERLINE) {
          const mark = complete && line === BAD ? ' id="a-badline"' : "";
          return "<div" + mark + ">" + number + (body || "&nbsp;") + "</div>";
        }
        const indent = line.length - line.trimStart().length;
        const width = Math.max(1, line.trim().length);
        return (
          '<div id="a-badline">' + number + body +
          '<span class="squiggle" style="margin-left:calc(${GUTTER}px + ' + indent +
          "ch);width:" + width + "ch;opacity:" + squiggle + '"></span></div>'
        );
      })
      .join("");
  }

  /**
   * Anchor the popup under the reported line, then keep it inside the pane. An
   * editor never draws a hover half off screen, and a clip that did would read
   * as a rendering mistake rather than as assistance.
   */
  function place() {
    const line = document.getElementById("a-badline");
    const pop = document.getElementById("a-pop");
    const pane = document.getElementById("a-pane");
    const code = document.getElementById("a-code");
    if (!line || !pop || !pane || !code) return;
    const indent = BAD.length - BAD.trimStart().length;
    const top = code.offsetTop + line.offsetTop + line.offsetHeight + 12;
    const left = ${GUTTER} + 24 + indent * ${(FONT * 0.6).toFixed(2)};
    pop.style.top =
      Math.max(12, Math.min(top, pane.clientHeight - pop.offsetHeight - 14)) + "px";
    pop.style.left =
      Math.max(20, Math.min(left, pane.clientWidth - pop.offsetWidth - 20)) + "px";
  }

  function ramp(t, from, dur) {
    if (t <= from) return 0;
    if (t >= from + dur) return 1;
    return 1 - Math.pow(1 - (t - from) / dur, 3);
  }

  function show(id, v, lift) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = String(v);
    el.style.transform = "translateY(" + ((1 - v) * (lift ?? 14)).toFixed(2) + "px)";
  }

  const TYPE_FROM = 0.95, TYPE_DUR = 1.55;

  window.seek = (t) => {
    show("a-head", ramp(t, 0.05, 0.42));
    show("a-rule", ramp(t, 0.16, 0.48));
    show("a-desc", ramp(t, 0.32, 0.48));
    show("a-pane", ramp(t, 0.56, 0.52));

    const progress = Math.min(1, Math.max(0, (t - TYPE_FROM) / TYPE_DUR));
    drawCode(Math.round(CODE.length * progress), ramp(t, TYPE_FROM + TYPE_DUR, 0.26));
    place();
    show("a-pop", ramp(t, TYPE_FROM + TYPE_DUR + 0.26, 0.44));
    show("a-meta", ramp(t, 4.30, 0.42));
    show("a-site", ramp(t, 4.50, 0.42));
  };
  window.seek(0);
</script>
</body>
</html>`;
}

/**
 * The completion list when the rule publishes one, the diagnostic hover
 * otherwise.
 */
function popup(spec) {
  if (spec.completion) {
    const items = spec.completion
      .map(
        (item, index) =>
          `<div class="item${index === 0 ? " on" : ""}"><span class="mark">◆</span>${esc(item.insert)}<span class="det">${esc(item.detail)}</span></div>`,
      )
      .join("");
    return `<div class="list">${items}</div>
    <div class="pop-foot">published by ${esc(spec.rule)}</div>`;
  }
  return `<div class="pop-head">
      <span class="pop-src">@ttsc/lint</span>
      <span class="pop-code">${esc(spec.rule)}</span>
    </div>
    <div class="pop-body">${rich(spec.message)}</div>
    ${spec.fix ? `<div class="pop-foot">Quick Fix · ${esc(spec.fix)}</div>` : ""}`;
}

/**
 * Catalog prose is Markdown, so a summary can carry inline code spans. Escaping
 * it without reading them leaves stray backticks on screen.
 */
function rich(text) {
  return esc(text).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
