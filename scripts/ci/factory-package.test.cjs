const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const test = require("node:test");

const {
  PACKAGE_BUILDS_AFTER_PLATFORMS,
  PACKAGE_BUILDS_BEFORE_PLATFORMS,
} = require("../build-platforms.cjs");
const { PLATFORM, SCOPES } = require("../build-current.cjs");

const root = path.resolve(__dirname, "..", "..");
const factoryRoot = path.join(root, "packages", "factory");

test("the canonical full plans cover every publishable package build", () => {
  const expected = fs
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
      return manifest.private || typeof manifest.scripts?.build !== "string"
        ? []
        : [manifest.name];
    })
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

test("the factory publication entry points load from built artifacts", () => {
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
    assertFactorySurface(
      requireFromConsumer("@ttsc/factory"),
      "CommonJS published entry",
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
        [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.json"],
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

function assertSucceeded(result, label) {
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}
