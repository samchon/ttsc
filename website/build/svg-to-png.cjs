const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUT_DIR = path.join(__dirname, "png-out");
const DEFAULT_SCALE = 2;

// The two charts embedded in the dev.to blog post. dev.to only accepts PNG
// uploads, so these occasionally need re-exporting from the published SVGs.
const DEFAULT_SVGS = [
  "public/benchmark/svg/graph-common-codex-gpt-5.5.svg",
  "public/benchmark/svg/graph-zod-common-codex-gpt-5.5.svg",
].map((rel) => path.join(ROOT, rel));

if (require.main === module) {
  const inputs = process.argv.slice(2);
  const svgPaths = (inputs.length > 0 ? inputs : DEFAULT_SVGS).map((p) =>
    path.resolve(p),
  );
  for (const svgPath of svgPaths) {
    const out = renderPng(svgPath);
    console.log(`[svg-to-png] wrote ${out.file} (${out.width}x${out.height})`);
  }
}

// resvg rasterizes in-process (no browser); `scale` zooms the intrinsic
// width/height for a crisp 2x export. Text uses whatever system font resolves
// from the chart's font-family stack (DejaVu Sans on Linux, Arial on Windows).
function renderPng(svgPath, options = {}) {
  const outDir = options.outDir ?? DEFAULT_OUT_DIR;
  const scale = options.scale ?? DEFAULT_SCALE;
  if (!fs.existsSync(svgPath)) throw new Error(`SVG not found: ${svgPath}`);

  const svg = fs.readFileSync(svgPath, "utf8");
  const { width, height } = readSvgSize(svg);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${path.basename(svgPath, ".svg")}.png`);

  const rendered = new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
    background: "#ffffff",
  }).render();
  fs.writeFileSync(outFile, rendered.asPng());

  const size = readPngSize(outFile);
  const expected = { width: width * scale, height: height * scale };
  if (size.width !== expected.width || size.height !== expected.height)
    throw new Error(
      `${outFile}: expected ${expected.width}x${expected.height}, got ${size.width}x${size.height}`,
    );
  return { file: outFile, ...size };
}

// Intrinsic size from the root <svg> width/height attributes, falling back to
// the viewBox so the PNG never guesses at dimensions.
function readSvgSize(svg) {
  const open = svg.match(/<svg\b[^>]*>/i);
  if (!open) throw new Error("no <svg> root element found");
  const tag = open[0];
  const w = numAttr(tag, "width");
  const h = numAttr(tag, "height");
  if (w > 0 && h > 0) return { width: w, height: h };
  const viewBox = tag.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (viewBox) {
    const parts = viewBox[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0)
      return { width: parts[2], height: parts[3] };
  }
  throw new Error("could not determine SVG width/height");
}

function numAttr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*"([\\d.]+)`, "i"));
  return match ? Math.round(Number(match[1])) : 0;
}

// PNG dimensions live in the IHDR chunk: bytes 16-19 width, 20-23 height, both
// big-endian. Reading them proves the export came out at the exact 2x size.
function readPngSize(file) {
  const buf = fs.readFileSync(file);
  const signature = "89504e470d0a1a0a";
  if (buf.subarray(0, 8).toString("hex") !== signature)
    throw new Error(`${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

module.exports = { renderPng };
