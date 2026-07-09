import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// End-to-end source-map check for ttsc + a real typia transform.
//
// What it proves: when a one-line `typia.is<T>(input)` is expanded by typia's
// transform into a large generated validator, the JavaScript that ttsc emits
// still carries a correct `.js.map` — valid `version: 3` JSON, the original
// `.ts` listed as a source, a non-empty `mappings` string, and a
// `//# sourceMappingURL=` trailer on the `.js`. This is the source-plugin
// analogue of the simpler `experimental/install` source-map assertions, but
// driven by a transform that materially rewrites the file.
//
// typia plugin wiring:
//   typia ships a `ttsc.plugin` auto-discovery marker in its package.json, so
//   ttsc picks it up the moment it appears in the consumer's dependencies — no
//   `compilerOptions.plugins[]` entry needed (see website/docs plugins/typia).
//   We rely on that auto-discovery only; an explicit `typia/lib/transform`
//   entry is the ts-patch convention and is not how ttsc resolves the transform.
//
// typia version: pinned to match website/package.json so this exercises the
// same dev build the playground and docs use.

const experimentRoot = path.resolve(import.meta.dirname, "..");
const root = path.resolve(experimentRoot, "../..");
const tarballs = path.join(root, "experimental", "tarballs");
const workspace = path.join(experimentRoot, ".tmp", "project");
const skipPack = process.argv.includes("--skip-pack");
const packCurrent = process.argv.includes("--pack-current");
const platformKey = `${process.platform}-${process.arch}`;
const platformPackage = `@ttsc/${platformKey}`;
const platformTarball = `ttsc-${platformKey}`;
// Keep this aligned with website/package.json's `typia` dependency.
const TYPIA_VERSION = "13.0.0-dev.20260605.1";
const registryDependencies = ["typescript@^7.0.2", `typia@${TYPIA_VERSION}`];

main();

function main() {
  // `--skip-pack` wins over `--pack-current` so a workflow that already ran
  // `pnpm package:tgz` can pass both flags (the root script defaults to
  // `--pack-current`) and reuse the existing tarballs instead of repacking.
  if (skipPack) {
    // Reuse tarballs already present in experimental/tarballs.
  } else if (packCurrent) {
    prepareCurrentTarballs();
  } else {
    run("pnpm package:tgz", root);
  }
  prepareWorkspace();
  installDependencies();
  compileWithTypia();
  verifySourceMap();
  console.log("Success");
}

function prepareCurrentTarballs() {
  run("pnpm run build:current", root, { TTSC_BUILD_SCOPE: "experimental" });

  fs.mkdirSync(tarballs, { recursive: true });
  for (const name of ["ttsc", platformTarball]) {
    fs.rmSync(path.join(tarballs, `${name}.tgz`), { force: true });
  }

  packPackage("ttsc", "ttsc");
  packPackage(platformTarball, platformTarball);
}

function packPackage(packageDirName, tarballName) {
  const packageDir = path.join(root, "packages", packageDirName);
  assert(fs.existsSync(packageDir), `${packageDirName} package must exist`);

  for (const entry of fs.readdirSync(packageDir)) {
    if (entry.endsWith(".tgz")) {
      fs.rmSync(path.join(packageDir, entry), { force: true });
    }
  }

  run("pnpm pack", packageDir);
  const packed = fs
    .readdirSync(packageDir)
    .find((entry) => entry.endsWith(".tgz"));
  assert(packed, `${packageDirName} package tarball must be created`);
  fs.copyFileSync(
    path.join(packageDir, packed),
    path.join(tarballs, `${tarballName}.tgz`),
  );
}

function prepareWorkspace() {
  fs.rmSync(path.join(experimentRoot, ".tmp"), {
    recursive: true,
    force: true,
  });
  fs.mkdirSync(path.join(workspace, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    JSON.stringify(
      {
        private: true,
        name: "@ttsc/experiment-source-map-consumer",
        version: "0.0.0",
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          sourceMap: true,
          outDir: "dist",
          rootDir: "src",
          // No `plugins[]` entry on purpose: typia ships a `ttsc.plugin`
          // auto-discovery marker in its package.json, so ttsc picks it up the
          // moment it appears in the consumer's dependencies (see
          // website/docs plugins/typia). This is the canonical wiring; an
          // explicit `typia/lib/transform` entry is the ts-patch convention and
          // is not how ttsc resolves the transform.
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "src", "main.ts"),
    [
      'import typia from "typia";',
      "",
      "export interface IMember {",
      '  id: string & typia.tags.Format<"uuid">;',
      '  email: string & typia.tags.Format<"email">;',
      '  age: number & typia.tags.Type<"uint32"> & typia.tags.Maximum<150>;',
      "}",
      "",
      "// One line that typia expands into a large generated validator.",
      "export const check = (input: unknown): boolean =>",
      "  typia.is<IMember>(input);",
      "",
      'console.log(check({ id: "x", email: "a@b.c", age: 1 }));',
      "",
    ].join("\n"),
    "utf8",
  );
}

function installDependencies() {
  const command = [
    "npm install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    // Match test-unplugin's retry tuning for flaky CI registry resets.
    "--fetch-retries=5",
    "--fetch-retry-mintimeout=10000",
    "--fetch-retry-maxtimeout=60000",
    ...registryDependencies,
    tarball("ttsc"),
    tarball(platformTarball),
  ].join(" ");
  run(command, workspace);

  const platformBin = path.join(
    workspace,
    "node_modules",
    "@ttsc",
    platformKey,
    "bin",
    process.platform === "win32" ? "ttsc.exe" : "ttsc",
  );
  assert(fs.existsSync(platformBin), `${platformPackage} binary must exist`);
}

function compileWithTypia() {
  runInstalledTtsc(["--cwd", ".", "--emit"], workspace);
}

function verifySourceMap() {
  const jsFile = path.join(workspace, "dist", "main.js");
  const mapFile = path.join(workspace, "dist", "main.js.map");

  assert(fs.existsSync(jsFile), "ttsc must emit dist/main.js");
  assert(fs.existsSync(mapFile), "ttsc must emit dist/main.js.map");

  const js = fs.readFileSync(jsFile, "utf8");

  // Source-map assertions run FIRST and independently of the transform-ran check
  // below, so a future change to typia's emitted helper identifiers can never
  // mask a genuine source-map regression (the whole point of this CI).
  assert(
    /\/\/#\s*sourceMappingURL=main\.js\.map\s*$/m.test(js),
    "emitted JavaScript must end with a //# sourceMappingURL= trailer",
  );

  let map;
  try {
    map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
  } catch (error) {
    throw new Error(`dist/main.js.map is not valid JSON: ${error.message}`);
  }

  assert(map.version === 3, "source map must declare version 3");
  assert(
    Array.isArray(map.sources) && map.sources.length > 0,
    "source map must list at least one source",
  );
  assert(
    map.sources.some((source) => /(?:^|[\\/])main\.ts$/.test(source)),
    `source map must reference the original main.ts source, got ${JSON.stringify(map.sources)}`,
  );
  assert(
    typeof map.mappings === "string" && map.mappings.length > 0,
    "source map must contain a non-empty mappings string",
  );
  assert(
    typeof map.file === "string" && map.file.endsWith("main.js"),
    `source map "file" must point at the emitted JavaScript, got ${JSON.stringify(map.file)}`,
  );

  // Separately confirm typia actually expanded the call (so the map is for the
  // generated validator, not an untransformed file). A miss here is reported as
  // its own failure, never as a source-map failure.
  assert(
    js.includes("typia") && /__typia_transform__|_io0|_is/.test(js),
    "emitted JavaScript must contain typia's expanded validator (transform ran)",
  );

  console.log(
    `Verified source map: ${map.sources.length} source(s), ` +
      `${map.mappings.length} mapping char(s), file=${map.file}`,
  );
}

function tarball(name) {
  const file = path.join(tarballs, `${name}.tgz`);
  assert(fs.existsSync(file), `${name}.tgz must exist`);
  return file;
}

function run(command, cwd, extraEnv = {}) {
  console.log(`$ ${command}`);
  const result = cp.execSync(command, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv,
      npm_config_cache: path.join(os.tmpdir(), "ttsc-npm-cache"),
    },
    maxBuffer: 1024 * 1024 * 64,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result) process.stdout.write(result);
  return { stdout: result };
}

function runInstalledTtsc(args, cwd) {
  const launcher = path.join(
    cwd,
    "node_modules",
    "ttsc",
    "lib",
    "launcher",
    "ttsc.js",
  );
  const embeddedGo = path.join(
    cwd,
    "node_modules",
    "@ttsc",
    platformKey,
    "bin",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  assert(fs.existsSync(launcher), "installed ttsc launcher must exist");
  assert(fs.existsSync(embeddedGo), "embedded Go compiler must exist");

  console.log(`$ node ${path.relative(cwd, launcher)} ${args.join(" ")}`);
  const result = cp.spawnSync(process.execPath, [launcher, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      TTSC_GO_BINARY: embeddedGo,
    },
    maxBuffer: 1024 * 1024 * 64,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert(
    result.status === 0,
    `installed ttsc failed with status ${result.status}`,
  );
  return result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
