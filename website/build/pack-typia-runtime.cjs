// Packs the CommonJS graph reachable from Typia's exported runtime surface.
// Transitive packages are discovered from actual require/import statements.

const fs = require("fs");
const path = require("path");

const { createTypiaDependencyGraph } = require("./typia-dependency-graph.cjs");

const websiteRoot = path.resolve(__dirname, "..");
const outFile = path.join(
  websiteRoot,
  "public",
  "compiler",
  "typia-runtime-pack.json",
);

function main() {
  const graph = createTypiaDependencyGraph({ websiteRoot });
  const closure = graph.collect("runtime");
  const pack = {};
  for (const [key, file] of [...closure.files].sort(([left], [right]) => left.localeCompare(right))) {
    if (file.endsWith(".mjs")) continue;
    pack[key] = fs.readFileSync(file, "utf8");
  }
  for (const [name, pkg] of [...closure.packages].sort(([left], [right]) => left.localeCompare(right))) {
    pack[`${name}/package.json`] = JSON.stringify(pkg.manifest, null, 2);
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(pack));
  console.log(
    `[pack-typia-runtime] typia@${graph.version}: ${closure.packages.size} packages, ${Object.keys(pack).length} files (${(fs.statSync(outFile).size / 1024).toFixed(1)} KB)`,
  );
}

main();
