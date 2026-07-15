const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createTypiaDependencyGraph,
} = require("../build/typia-dependency-graph.cjs");

test("Typia browser packs derive one fail-fast dependency graph", async (t) => {
  await t.test("the real install owns Go, source, runtime, and types", () => {
    const websiteRoot = path.resolve(__dirname, "..");
    const graph = createTypiaDependencyGraph({ websiteRoot });
    assert.equal(
      path.relative(graph.typiaRoot, graph.goAdapterRoot),
      path.join("native", "adapter"),
    );
    for (const kind of ["source", "runtime", "types"]) {
      const closure = graph.collect(kind);
      assert.equal(closure.version, graph.version);
      assert.equal(closure.packages.get("typia").root, graph.typiaRoot);
      for (const pkg of closure.packages.values()) {
        if (pkg.name.startsWith("@typia/")) {
          assert.equal(pkg.manifest.version, graph.version);
        }
      }
    }
  });

  await t.test("a missing imported package fails generation", () => {
    const fixture = createFixture();
    try {
      writePackage(fixture, "typia", {
        source: 'import value from "missing-transitive"; export default value;\n',
      });
      const graph = fixtureGraph(fixture);
      assert.throws(
        () => graph.collect("source"),
        /imports missing package "missing-transitive"/,
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  await t.test("a newly imported transitive package is discovered", () => {
    const fixture = createFixture();
    try {
      writePackage(fixture, "typia", {
        source: 'export { value } from "first-dependency";\n',
      });
      writePackage(fixture, "first-dependency", {
        source: 'export { value } from "new-transitive";\n',
      });
      writePackage(fixture, "new-transitive", {
        source: "export const value = 1;\n",
      });
      const closure = fixtureGraph(fixture).collect("source");
      assert.deepEqual(
        [...closure.packages.keys()].sort(),
        ["first-dependency", "new-transitive", "typia"],
      );
      assert.ok(closure.files.has("new-transitive/src/index.ts"));
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  await t.test("a mismatched Typia-family package fails generation", () => {
    const fixture = createFixture();
    try {
      writePackage(fixture, "typia", {
        source: 'export { value } from "@typia/interface";\n',
      });
      writePackage(fixture, "@typia/interface", {
        source: "export const value = 1;\n",
        version: "9.9.9",
      });
      assert.throws(
        () => fixtureGraph(fixture).collect("source"),
        /@typia\/interface@9\.9\.9 does not match typia@1\.2\.3/,
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
});

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-typia-graph-"));
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  return root;
}

function fixtureGraph(fixture) {
  return createTypiaDependencyGraph({
    websiteRoot: fixture,
    typiaRoot: path.join(fixture, "node_modules", "typia"),
    expectedVersion: "1.2.3",
  });
}

function writePackage(fixture, name, { source, version = "1.2.3" }) {
  const root = path.join(fixture, "node_modules", ...name.split("/"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "lib"), { recursive: true });
  if (name === "typia") fs.mkdirSync(path.join(root, "native", "adapter"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name,
      version,
      main: "lib/index.js",
      types: "lib/index.d.ts",
      exports: {
        ".": {
          types: "./lib/index.d.ts",
          default: "./lib/index.js",
        },
      },
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), source);
  fs.writeFileSync(path.join(root, "lib", "index.d.ts"), "export {};\n");
  fs.writeFileSync(path.join(root, "lib", "index.js"), "module.exports = {};\n");
}
