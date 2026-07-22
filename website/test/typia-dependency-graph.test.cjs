const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createTypiaDependencyGraph,
  rewriteSourceManifest,
} = require("../build/typia-dependency-graph.cjs");

test("Typia browser packs derive one fail-fast dependency graph", async (t) => {
  await t.test("workspace aliases use the exact lockfile resolution", () => {
    const fixture = createRepositoryFixture();
    try {
      const graph = createTypiaDependencyGraph({
        websiteRoot: fixture.websiteRoot,
      });
      assert.equal(graph.version, "1.2.3");
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  await t.test("a stale install fails against the lockfile resolution", () => {
    const fixture = createRepositoryFixture({ installedVersion: "1.2.2" });
    try {
      assert.throws(
        () => createTypiaDependencyGraph({ websiteRoot: fixture.websiteRoot }),
        /installed typia 1\.2\.2 does not match exact lockfile resolution 1\.2\.3/,
      );
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

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
        source: 'import value from "first-dependency"; export default value;\n',
      });
      writePackage(fixture, "first-dependency", {
        source:
          'import value from "missing-transitive"; export default value;\n',
      });
      const graph = fixtureGraph(fixture);
      assert.throws(
        () => graph.collect("source"),
        /typia\/src\/index\.ts -> first-dependency\/src\/index\.ts imports missing package "missing-transitive"/,
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
      assert.deepEqual([...closure.packages.keys()].sort(), [
        "first-dependency",
        "new-transitive",
        "typia",
      ]);
      assert.ok(closure.files.has("new-transitive/src/index.ts"));
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  await t.test("a newly exported public subpath is discovered", () => {
    const fixture = createFixture();
    try {
      const root = writePackage(fixture, "typia", {
        source: "export const root = 1;\n",
      });
      const manifestFile = path.join(root, "package.json");
      const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
      manifest.exports["./feature"] = {
        types: "./lib/feature.d.ts",
        default: "./lib/feature.js",
      };
      fs.writeFileSync(manifestFile, JSON.stringify(manifest));
      fs.writeFileSync(
        path.join(root, "src", "feature.ts"),
        "export const feature = 1;\n",
      );
      fs.writeFileSync(
        path.join(root, "lib", "feature.d.ts"),
        "export declare const feature: number;\n",
      );
      fs.writeFileSync(
        path.join(root, "lib", "feature.js"),
        "exports.feature = 1;\n",
      );

      const graph = fixtureGraph(fixture);
      assert.ok(graph.collect("source").files.has("typia/src/feature.ts"));
      assert.ok(graph.collect("runtime").files.has("typia/lib/feature.js"));
      assert.ok(graph.collect("types").files.has("typia/lib/feature.d.ts"));
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  await t.test(
    "source manifests rewrite bare and relative lib fallbacks",
    () => {
      const fixture = createFixture();
      try {
        const root = writePackage(fixture, "typia", {
          source: "export const value = 1;\n",
        });
        const rewritten = rewriteSourceManifest(
          {
            main: "lib/index.js",
            types: "lib/index.d.ts",
            exports: { ".": { default: "./lib/index.js" } },
          },
          root,
        );
        assert.equal(rewritten.main, "src/index.ts");
        assert.equal(rewritten.types, "src/index.ts");
        assert.equal(rewritten.exports["."].default, "./src/index.ts");
      } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
      }
    },
  );

  await t.test(
    "an ESM-only runtime dependency fails instead of being omitted",
    () => {
      const fixture = createFixture();
      try {
        const typiaRoot = writePackage(fixture, "typia", {
          source: "export const value = 1;\n",
        });
        fs.writeFileSync(
          path.join(typiaRoot, "lib", "index.js"),
          'require("esm-only");\n',
        );
        const esmRoot = writePackage(fixture, "esm-only", {
          source: "export const value = 1;\n",
        });
        const manifestFile = path.join(esmRoot, "package.json");
        const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
        delete manifest.main;
        manifest.exports["."] = { default: "./lib/index.mjs" };
        fs.writeFileSync(manifestFile, JSON.stringify(manifest));
        fs.writeFileSync(
          path.join(esmRoot, "lib", "index.mjs"),
          "export const value = 1;\n",
        );

        assert.throws(
          () => fixtureGraph(fixture).collect("runtime"),
          /typia\/lib\/index\.js -> esm-only\/lib\/index\.mjs resolves to an ESM-only runtime module/,
        );
      } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
      }
    },
  );

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

function createRepositoryFixture({ installedVersion = "1.2.3" } = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-typia-repo-"));
  const websiteRoot = path.join(repoRoot, "website");
  fs.mkdirSync(websiteRoot, { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, "pnpm-workspace.yaml"),
    [
      "packages:",
      "  - website",
      "catalogs:",
      "  samchon:",
      "    typia: &typia ^1.2.0",
      "    '@typia/interface': *typia",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(repoRoot, "pnpm-lock.yaml"),
    [
      "lockfileVersion: '9.0'",
      "catalogs:",
      "  samchon:",
      "    typia:",
      "      specifier: ^1.2.0",
      "      version: 1.2.3",
      "",
    ].join("\n"),
  );
  writePackage(websiteRoot, "typia", {
    source: "export const value = 1;\n",
    version: installedVersion,
  });
  return { repoRoot, websiteRoot };
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
  if (name === "typia")
    fs.mkdirSync(path.join(root, "native", "adapter"), { recursive: true });
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
  fs.writeFileSync(
    path.join(root, "lib", "index.js"),
    "module.exports = {};\n",
  );
  return root;
}
