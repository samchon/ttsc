// Keep the project skill's package map aligned with the published workspace.

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const delegatedPackages = new Map([["graph", "[graph.md](graph.md)"]]);

function listPublishedPackages(packagesDir) {
  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const manifest = path.join(packagesDir, entry.name, "package.json");
      if (!fs.existsSync(manifest)) return [];
      return JSON.parse(fs.readFileSync(manifest, "utf8")).private
        ? []
        : [entry.name];
    })
    .sort();
}

function layoutSection(document) {
  const heading = /^## Layout\r?$/m.exec(document);
  if (!heading) throw new Error("project skill has no Layout section");
  const rest = document
    .slice(heading.index + heading[0].length)
    .replace(/^\r?\n/, "");
  const nextHeading = rest.search(/^## /m);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
}

function layoutCoverage(layout, packages) {
  const entries = [...layout.matchAll(/`(packages\/[^`]+)`/g)].map(
    (match) => match[1],
  );
  const covered = new Set();
  for (const entry of entries) {
    const brace = /^packages\/\{([^}]+)\}$/.exec(entry);
    if (brace) {
      for (const name of brace[1].split(",")) covered.add(name);
      continue;
    }
    const wildcard = /^packages\/([^*]+)\*$/.exec(entry);
    if (wildcard) {
      for (const name of packages) {
        if (name.startsWith(wildcard[1])) covered.add(name);
      }
      continue;
    }
    covered.add(entry.slice("packages/".length));
  }
  return covered;
}

function assertProjectLayout({ document, packages }) {
  if (packages.length === 0) {
    throw new Error("project Layout check found no published packages");
  }
  const layout = layoutSection(document);
  const covered = layoutCoverage(layout, packages);
  if (covered.size === 0) {
    throw new Error("project Layout check found no package coverage");
  }
  const missing = packages.filter((name) => {
    const delegation = delegatedPackages.get(name);
    return (
      !covered.has(name) && (!delegation || !document.includes(delegation))
    );
  });
  if (missing.length !== 0) {
    throw new Error(
      `project Layout omits published package(s): ${missing.join(", ")}`,
    );
  }
}

function main() {
  const document = fs.readFileSync(
    path.join(root, ".agents", "skills", "project", "SKILL.md"),
    "utf8",
  );
  const packages = listPublishedPackages(path.join(root, "packages"));
  assertProjectLayout({ document, packages });
  process.stdout.write(
    "project Layout accounts for every published package.\n",
  );
}

if (require.main === module) main();

module.exports = { assertProjectLayout, layoutCoverage, listPublishedPackages };
