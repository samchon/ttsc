// Packs the source graph reachable from the exact Typia installation used by
// the playground wasm. Package membership is derived from real imports and
// export maps by typia-dependency-graph.cjs.

const fs = require("fs");
const path = require("path");

const {
  createTypiaDependencyGraph,
  rewriteSourceManifest,
} = require("./typia-dependency-graph.cjs");

const websiteRoot = path.resolve(__dirname, "..");
const outFile = path.join(websiteRoot, "public", "compiler", "typia-pack.json");

function main() {
  const graph = createTypiaDependencyGraph({ websiteRoot });
  const closure = graph.collect("source");
  const pack = {};
  for (const [key, file] of [...closure.files].sort(([left], [right]) => left.localeCompare(right))) {
    pack[key] = fs.readFileSync(file, "utf8");
  }
  for (const [name, pkg] of [...closure.packages].sort(([left], [right]) => left.localeCompare(right))) {
    pack[`${name}/package.json`] = JSON.stringify(
      rewriteSourceManifest(pkg.manifest, pkg.root),
      null,
      2,
    );
  }
  writePack(outFile, pack);
  console.log(
    `[pack-typia-sources] typia@${graph.version}: ${closure.packages.size} packages, ${Object.keys(pack).length} files (${kilobytes(outFile)} KB)`,
  );
}

function writePack(file, pack) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(pack));
}

function kilobytes(file) {
  return (fs.statSync(file).size / 1024).toFixed(1);
}

main();
