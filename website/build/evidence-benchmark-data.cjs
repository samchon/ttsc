// Copy the evidence benchmark's tracked aggregate into the site's public tree.
//
// The site is a static export, so a component cannot read `benchmarks/` at
// request time; the data has to be a real file under `public/`. Committing a
// second copy there would make two sources for one measurement, and the one the
// page draws would drift from the one the charts are rendered from. This copies
// instead, and the copy is ignored.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const AGGREGATE = path.resolve(ROOT, "..", "benchmarks", "evidence", "aggregate");
const OUT_DIR = path.join(ROOT, "public", "benchmark");

/** `summary.json` plus whatever optional artifacts a cohort has published. */
const ARTIFACTS = [
  { from: "summary.json", to: "evidence.json", required: true },
  { from: "coverage.json", to: "evidence-coverage.json", required: false },
];

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const artifact of ARTIFACTS) {
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
      continue;
    }
    // Parsed and re-serialized rather than copied, so a malformed aggregate
    // fails the build here instead of at the fetch in a reader's browser.
    fs.writeFileSync(
      target,
      `${JSON.stringify(JSON.parse(fs.readFileSync(source, "utf8")))}\n`,
    );
    process.stdout.write(
      `evidence benchmark: ${artifact.from} -> public/benchmark/${artifact.to}\n`,
    );
  }
}

main();
