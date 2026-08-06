// Publish the evidence benchmark's tracked aggregate to the site's public tree.
//
// The site is a static export, so a component cannot read `benchmarks/` at
// request time; the data has to be a real file under `public/`. Committing a
// second copy there would make two sources for one measurement, and the one the
// page draws would drift from the one the charts are rendered from. This copies
// instead, and the copy is ignored.
//
// The charts need no copying at all. `@ttsc/benchmark-evidence` owns the
// renderer and writes them straight into `public/benchmark/evidence`, so this
// step only rasterizes what is already there. Drawing a second set here would
// be a second thing to keep in agreement with the aggregate.
const fs = require("node:fs");
const path = require("node:path");

const { renderPng } = require("./svg-to-png.cjs");

const ROOT = path.resolve(__dirname, "..");
const AGGREGATE = path.resolve(
  ROOT,
  "..",
  "benchmarks",
  "evidence",
  "aggregate",
);
const OUT_DIR = path.join(ROOT, "public", "benchmark");
/** Written by `pnpm --filter @ttsc/benchmark-evidence charts`, and tracked. */
const SVG_DIR = path.join(OUT_DIR, "evidence");
const PNG_DIR = path.join(OUT_DIR, "png");

/** `summary.json` plus whatever optional artifacts a cohort has published. */
const DATA = [
  { from: "summary.json", to: "evidence.json", required: true },
  { from: "coverage.json", to: "evidence-coverage.json", required: false },
];

function main() {
  const png = process.argv.includes("--png");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const artifact of DATA) publishData(artifact);
  publishCharts(png);
}

function publishData(artifact) {
  const source = path.join(AGGREGATE, artifact.from);
  const target = path.join(OUT_DIR, artifact.to);
  if (fs.existsSync(source) === false) {
    if (artifact.required)
      throw new Error(
        `No evidence benchmark aggregate at ${source}. It is tracked, so a checkout missing it is incomplete rather than unpublished.`,
      );
    // Coverage is counted by hand from a completed workspace, so a cohort can
    // be published before one exists. Remove a stale copy rather than leaving
    // the page drawing a block the aggregate no longer carries.
    fs.rmSync(target, { force: true });
    return;
  }
  // Parsed and re-serialized rather than copied, so a malformed aggregate fails
  // the build here instead of at the fetch in a reader's browser.
  fs.writeFileSync(
    target,
    `${JSON.stringify(JSON.parse(fs.readFileSync(source, "utf8")))}\n`,
  );
  process.stdout.write(
    `[evidence-benchmark] ${artifact.from} -> public/benchmark/${artifact.to}\n`,
  );
}

/** Rasterize each tracked chart at 2x, for a reader who needs a PNG. */
function publishCharts(png) {
  const charts = fs.existsSync(SVG_DIR)
    ? fs.readdirSync(SVG_DIR).filter((name) => name.endsWith(".svg"))
    : [];
  if (charts.length === 0)
    throw new Error(
      `No charts under ${SVG_DIR}. They are tracked; redraw them with \`pnpm --filter @ttsc/benchmark-evidence charts\`.`,
    );
  if (png === false) return;
  fs.mkdirSync(PNG_DIR, { recursive: true });
  // A chart dropped from a cohort leaves its raster behind otherwise, and a
  // stale export is worse than a missing one: it is a measurement the site
  // still serves under a name the aggregate no longer carries.
  const expected = new Set(
    charts.map((name) => `evidence-${name.replace(/\.svg$/u, ".png")}`),
  );
  for (const name of fs.readdirSync(PNG_DIR))
    if (name.startsWith("evidence-") && expected.has(name) === false)
      fs.rmSync(path.join(PNG_DIR, name), { force: true });
  for (const name of charts) {
    const out = renderPng(path.join(SVG_DIR, name), {
      outDir: PNG_DIR,
      name: `evidence-${path.basename(name, ".svg")}`,
    });
    process.stdout.write(
      `[evidence-benchmark] evidence/${name} -> public/benchmark/png/${path.basename(out.file)} (${out.width}x${out.height})
`,
    );
  }
}

main();
