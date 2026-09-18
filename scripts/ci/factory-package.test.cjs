const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const {
  PACKAGE_BUILDS_AFTER_PLATFORMS,
  PACKAGE_BUILDS_BEFORE_PLATFORMS,
} = require("../build-platforms.cjs");
const { PLATFORM, SCOPES } = require("../build-current.cjs");
const { runStripTypes } = require("../node-strip-types.cjs");

const root = path.resolve(__dirname, "..", "..");
const factoryRoot = path.join(root, "packages", "factory");
const tarballScript = path.join(root, "experimental", "tarballs", "index.ts");
const typescriptManifestPath = require.resolve("typescript/package.json");
const typescriptTscPath = path.resolve(
  path.dirname(typescriptManifestPath),
  JSON.parse(fs.readFileSync(typescriptManifestPath, "utf8")).bin.tsc,
);

test("the canonical full plans cover every publishable package build", () => {
  const expected = publishablePackages()
    .filter((entry) => typeof entry.manifest.scripts?.build === "string")
    .map((entry) => entry.name)
    .sort();
  const crossPlatform = new Set([
    ...PACKAGE_BUILDS_BEFORE_PLATFORMS,
    ...PACKAGE_BUILDS_AFTER_PLATFORMS,
  ]);
  const current = new Set(
    SCOPES.full.flatMap((target) => {
      if (target === PLATFORM) return [];
      return [typeof target === "object" ? target.filter : target];
    }),
  );

  assert.deepEqual(
    expected.filter((name) => !crossPlatform.has(name)),
    [],
    "scripts/build-platforms.cjs omits a publishable package build",
  );
  assert.deepEqual(
    expected.filter((name) => !current.has(name)),
    [],
    "scripts/build-current.cjs full scope omits a publishable package build",
  );
});

/**
 * `pnpm package:tgz` is the release rehearsal for
 * `pnpm run package:latest:publish`, so a published package missing from its
 * plan reaches the registry with its `files`, `exports`, and `prepack` never
 * exercised by a real `pnpm pack`. The plan is a hand-written list, so it can
 * only stay complete if a check compares it with the packages that actually
 * publish.
 */
test("the release rehearsal plans every publishable package it does not exclude", () => {
  const publishable = publishablePackages();
  const plan = readTarballPlan();
  const audit = auditPackPlan(publishable, plan.full);

  assert.deepEqual(
    audit.unrehearsed,
    [],
    "experimental/tarballs full mode neither packs nor excludes a published package",
  );
  assert.deepEqual(
    audit.stale,
    [],
    "experimental/tarballs full mode names a package that does not publish",
  );
  assert.deepEqual(
    audit.contradictory,
    [],
    "experimental/tarballs full mode both packs and excludes a package",
  );
  assert.deepEqual(
    plan.full.packages.filter((directory) =>
      /^ttsc-(linux|darwin|win32)-/.test(directory),
    ),
    [],
    "listTargets discovers the platform packages; the pack list must not repeat one",
  );

  const future = { directory: "future", name: "@ttsc/future" };
  const packed = publishable.find((entry) =>
    plan.full.packages.includes(entry.directory),
  );
  assert.deepEqual(
    auditPackPlan([...publishable, future], plan.full).unrehearsed,
    [future.name],
    "a newly published package with no plan entry must fail the gate",
  );
  assert.deepEqual(
    auditPackPlan([...publishable, future], {
      packages: plan.full.packages,
      exclusions: { ...plan.full.exclusions, [future.name]: "   " },
    }).unrehearsed,
    [future.name],
    "a blank exclusion reason must not excuse a published package",
  );
  assert.deepEqual(
    auditPackPlan([...publishable, future], {
      packages: plan.full.packages,
      exclusions: { ...plan.full.exclusions, [future.name]: null },
    }).unrehearsed,
    [future.name],
    "an exclusion with no written reason must not excuse a published package",
  );
  assert.deepEqual(
    auditPackPlan([...publishable, future], {
      packages: plan.full.packages,
      exclusions: {
        ...plan.full.exclusions,
        [future.name]: "no registry consumer installs it",
      },
    }).unrehearsed,
    [],
    "a reasoned exclusion must satisfy the gate",
  );
  assert.deepEqual(
    auditPackPlan(publishable, {
      packages: plan.full.packages.filter(
        (directory) => directory !== packed.directory,
      ),
      exclusions: plan.full.exclusions,
    }).unrehearsed,
    [packed.name],
    "dropping a package from the pack list must fail the gate",
  );
  assert.deepEqual(
    auditPackPlan(publishable, {
      packages: [...plan.full.packages, "ghost"],
      exclusions: { ...plan.full.exclusions, "@ttsc/ghost": "gone" },
    }).stale,
    ["@ttsc/ghost", "packages/ghost"],
    "a plan entry naming no publishable package must fail the gate",
  );
  assert.deepEqual(
    auditPackPlan(publishable, {
      packages: plan.full.packages,
      exclusions: { ...plan.full.exclusions, [packed.name]: "unused" },
    }).contradictory,
    [packed.name],
    "excluding a packed package must fail the gate",
  );

  assert.deepEqual(
    plan.current.packages.filter(
      (directory) => !plan.full.packages.includes(directory),
    ),
    [],
    "current mode packs a package the full rehearsal does not",
  );
  assert.equal(
    plan.current.packages.includes("wasm"),
    false,
    "current mode must keep its stated @ttsc/wasm exclusion",
  );
});

test("the factory publication entry points load from built artifacts", async () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(factoryRoot, "package.json"), "utf8"),
  );
  const published = { ...manifest, ...manifest.publishConfig };
  delete published.publishConfig;

  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-factory-pack-"),
  );
  try {
    const packageRoot = path.join(
      workspace,
      "node_modules",
      "@ttsc",
      "factory",
    );
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.cpSync(path.join(factoryRoot, "lib"), path.join(packageRoot, "lib"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify(published, null, 2),
    );

    const requireFromConsumer = createRequire(
      path.join(workspace, "consumer.cjs"),
    );
    const commonjs = requireFromConsumer("@ttsc/factory");
    assertFactorySurface(commonjs, "CommonJS published entry");
    const module = await import(
      pathToFileURL(path.join(packageRoot, "lib", "index.mjs")).href
    );
    assertCrossCopyComments(commonjs, module, "CommonJS/ESM format split");

    const duplicateRoot = path.join(workspace, "duplicate-factory");
    fs.cpSync(packageRoot, duplicateRoot, { recursive: true });
    const duplicate = requireFromConsumer(
      path.join(duplicateRoot, "lib", "index.js"),
    );
    assertCrossCopyComments(commonjs, duplicate, "physical package split");

    const hardenedConsumer = [
      '"use strict";',
      "Object.preventExtensions(globalThis);",
      `const mod = require(${JSON.stringify(path.join(packageRoot, "lib", "index.js"))});`,
      "const node = Object.freeze(mod.default.createIdentifier('hardened'));",
      "mod.addSyntheticLeadingComment(node, mod.SyntaxKind.SingleLineCommentTrivia, ' retained ', true);",
      "if (mod.getSyntheticLeadingComments(node)?.[0]?.text !== ' retained ') throw new Error('comment was not retained');",
      "if (new mod.TsPrinter().print(node) !== '// retained\\nhardened') throw new Error('printer lost the comment');",
    ].join("\n");
    assertSucceeded(
      childProcess.spawnSync(process.execPath, ["-e", hardenedConsumer], {
        cwd: workspace,
        encoding: "utf8",
        windowsHide: true,
      }),
      "non-extensible global fallback",
    );

    const esmConsumer = path.join(workspace, "consumer.mjs");
    fs.writeFileSync(
      esmConsumer,
      [
        'import factory, { SyntaxKind, TsPrinter } from "@ttsc/factory";',
        'if (typeof factory.createIdentifier !== "function") throw new Error("missing default factory");',
        'if (SyntaxKind.StringKeyword !== "string") throw new Error("missing SyntaxKind");',
        'if (typeof TsPrinter !== "function") throw new Error("missing TsPrinter");',
      ].join("\n"),
    );
    assertSucceeded(
      childProcess.spawnSync(process.execPath, [esmConsumer], {
        cwd: workspace,
        encoding: "utf8",
        windowsHide: true,
      }),
      "ES module published entry",
    );

    const typeConsumer = path.join(workspace, "consumer.ts");
    fs.writeFileSync(
      typeConsumer,
      [
        'import factory, { SyntaxKind, TsPrinter } from "@ttsc/factory";',
        'const identifier = factory.createIdentifier("value");',
        'if (identifier.kind !== "Identifier") throw new Error("missing identifier discriminant");',
        "const kind: SyntaxKind = SyntaxKind.StringKeyword;",
        "const printer: TsPrinter = new TsPrinter();",
        "void kind;",
        "void printer;",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(workspace, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            module: "nodenext",
            moduleResolution: "nodenext",
            noEmit: true,
            strict: true,
            target: "es2022",
          },
          files: ["consumer.ts"],
        },
        null,
        2,
      ),
    );
    assertSucceeded(
      childProcess.spawnSync(
        process.execPath,
        [typescriptTscPath, "-p", "tsconfig.json"],
        {
          cwd: workspace,
          encoding: "utf8",
          windowsHide: true,
        },
      ),
      "TypeScript published declaration entry",
    );
  } finally {
    fs.rmSync(workspace, { force: true, recursive: true });
  }
});

/**
 * Every non-private, non-platform `packages/*` manifest: exactly the set
 * `pnpm run package:latest:publish` pushes to the registry. Platform packages
 * are discovered from disk by their own plans and asserted by
 * `scripts/assert-platform-package.cjs`, so they never enter these gates.
 */
function publishablePackages() {
  return fs
    .readdirSync(path.join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      if (/^ttsc-(linux|darwin|win32)-/.test(entry.name)) return [];
      const manifestPath = path.join(
        root,
        "packages",
        entry.name,
        "package.json",
      );
      if (!fs.existsSync(manifestPath)) return [];
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      return manifest.private
        ? []
        : [{ directory: entry.name, manifest, name: manifest.name }];
    });
}

/** Read the pack plans out of the rehearsal script itself. */
function readTarballPlan() {
  const result = runStripTypes([tarballScript, "--print-plan"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  assertSucceeded(result, "experimental/tarballs/index.ts --print-plan");
  return JSON.parse(result.stdout);
}

/**
 * Compare one pack plan with the publishable packages in both directions.
 *
 * A package is rehearsed when the plan packs it, and excused when the plan
 * excludes it with a non-empty reason; anything else is a silent omission.
 */
function auditPackPlan(publishable, plan) {
  const packed = new Set(plan.packages);
  const exclusions = new Map(Object.entries(plan.exclusions ?? {}));
  const directories = new Set(publishable.map((entry) => entry.directory));
  const names = new Set(publishable.map((entry) => entry.name));
  const excused = (entry) => {
    const reason = exclusions.get(entry.name);
    return typeof reason === "string" && reason.trim() !== "";
  };
  return {
    unrehearsed: publishable
      .filter((entry) => !packed.has(entry.directory) && !excused(entry))
      .map((entry) => entry.name)
      .sort(),
    contradictory: publishable
      .filter((entry) => packed.has(entry.directory) && excused(entry))
      .map((entry) => entry.name)
      .sort(),
    stale: [
      ...plan.packages
        .filter((directory) => !directories.has(directory))
        .map((directory) => `packages/${directory}`),
      ...[...exclusions.keys()].filter((name) => !names.has(name)),
    ].sort(),
  };
}

function assertFactorySurface(exports, label) {
  assert.equal(
    typeof exports.default.createIdentifier,
    "function",
    `${label} omits the default factory`,
  );
  assert.equal(
    exports.SyntaxKind.StringKeyword,
    "string",
    `${label} omits SyntaxKind`,
  );
  assert.equal(
    typeof exports.TsPrinter,
    "function",
    `${label} omits TsPrinter`,
  );
}

function assertCrossCopyComments(writer, reader, label) {
  assert.notEqual(
    writer.addSyntheticLeadingComment,
    reader.addSyntheticLeadingComment,
    `${label} did not load independent modules`,
  );

  const leading = Object.freeze(
    writer.default.createTypeAliasDeclaration(
      undefined,
      "Leading",
      undefined,
      writer.default.createKeywordTypeNode(writer.SyntaxKind.StringKeyword),
    ),
  );
  writer.addSyntheticLeadingComment(
    leading,
    writer.SyntaxKind.MultiLineCommentTrivia,
    " shared leading ",
    true,
  );
  assert.equal(
    reader.getSyntheticLeadingComments(leading)?.[0]?.text,
    " shared leading ",
    `${label} lost a leading comment`,
  );
  assert.match(
    new reader.TsPrinter().print(leading),
    /\/\* shared leading \*\/\ntype Leading = string;/,
    `${label} printer lost a leading comment`,
  );
  reader.setSyntheticLeadingComments(leading, undefined);
  assert.equal(
    writer.getSyntheticLeadingComments(leading),
    undefined,
    `${label} clear did not reach the writer`,
  );

  const trailing = Object.freeze(
    reader.default.createTypeAliasDeclaration(
      undefined,
      "Trailing",
      undefined,
      reader.default.createKeywordTypeNode(reader.SyntaxKind.NumberKeyword),
    ),
  );
  reader.addSyntheticTrailingComment(
    trailing,
    reader.SyntaxKind.MultiLineCommentTrivia,
    " shared trailing ",
  );
  assert.equal(
    writer.getSyntheticTrailingComments(trailing)?.[0]?.text,
    " shared trailing ",
    `${label} lost a reverse-direction trailing comment`,
  );
  assert.match(
    new writer.TsPrinter().print(trailing),
    /type Trailing = number; \/\* shared trailing \*\//,
    `${label} printer lost a reverse-direction trailing comment`,
  );
  writer.setSyntheticTrailingComments(trailing, []);
  assert.equal(
    reader.getSyntheticTrailingComments(trailing),
    undefined,
    `${label} reverse-direction clear did not reach the writer`,
  );
}

function assertSucceeded(result, label) {
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}
