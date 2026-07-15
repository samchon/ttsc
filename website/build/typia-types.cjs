// Packs the declaration graph reachable from Typia's editor surface. Every
// transitive declaration is real; missing packages fail generation instead of
// being hidden behind ambient-any modules.

const fs = require("fs");
const path = require("path");

const { createTypiaDependencyGraph } = require("./typia-dependency-graph.cjs");

const websiteRoot = path.resolve(__dirname, "..");
const outFile = path.join(websiteRoot, "src", "compiler", "typia-types.json");

function main() {
  const graph = createTypiaDependencyGraph({ websiteRoot });
  const closure = graph.collect("types");
  const pack = {};
  for (const [key, file] of [...closure.files].sort(([left], [right]) => left.localeCompare(right))) {
    pack[`file:///node_modules/${key}`] = fs.readFileSync(file, "utf8");
  }
  for (const [name, pkg] of [...closure.packages].sort(([left], [right]) => left.localeCompare(right))) {
    pack[`file:///node_modules/${name}/package.json`] = JSON.stringify(
      pkg.manifest,
      null,
      2,
    );
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(pack));
  console.log(
    `[build:typia-types] typia@${graph.version}: ${closure.packages.size} packages, ${Object.keys(pack).length} files (${(fs.statSync(outFile).size / 1024).toFixed(1)} KB)`,
  );
}

main();
