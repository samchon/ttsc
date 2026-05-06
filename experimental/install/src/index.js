const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const experimentRoot = path.resolve(__dirname, "..");
const root = path.resolve(experimentRoot, "../..");
const tarballs = path.join(root, "experimental", "tarballs");
const workspace = path.join(experimentRoot, ".tmp", "project");
const skipPack = process.argv.includes("--skip-pack");
const packCurrent = process.argv.includes("--pack-current");
const platformKey = `${process.platform}-${process.arch}`;
const platformPackage = `@ttsc/${platformKey}`;
const platformTarball = `ttsc-${platformKey}`;
const packageTarballs = ["banner", "lint", "paths", "strip", "unplugin"];
const registryDependencies = ["@typescript/native-preview", "vite"];

main();

function main() {
  if (packCurrent) {
    prepareCurrentTarballs();
  } else if (!skipPack) {
    run("pnpm package:tgz", root);
  }
  prepareWorkspace();
  installTarballs();
  verifyInstalledPackages();
  verifyUnpluginEntrypoints();
  verifyUnpluginViteBuild();
  verifyTtscBuild();
  verifyTtsxRun();
  console.log("Success");
}

function prepareCurrentTarballs() {
  run("pnpm run build:current", root);

  fs.mkdirSync(tarballs, { recursive: true });
  for (const name of ["ttsc", platformTarball, ...packageTarballs]) {
    fs.rmSync(path.join(tarballs, `${name}.tgz`), { force: true });
  }

  packPackage("ttsc", "ttsc");
  packPackage(platformTarball, platformTarball);
  for (const name of packageTarballs) {
    packPackage(name, name);
  }
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
  fs.mkdirSync(path.join(workspace, "src", "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    JSON.stringify(
      {
        private: true,
        name: "@ttsc/experiment-install-consumer",
        version: "0.0.0",
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(workspace, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          outDir: "dist",
          rootDir: "src",
          paths: {
            "@lib/*": ["./src/lib/*"],
          },
          plugins: [
            {
              transform: "@ttsc/paths",
            },
            {
              transform: "@ttsc/banner",
              banner: "License MIT",
            },
            {
              transform: "@ttsc/strip",
              calls: ["console.debug"],
              statements: ["debugger"],
            },
          ],
        },
        include: ["src"],
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(workspace, "src", "lib", "message.ts"),
    [
      "export interface Payload {",
      "  text: string;",
      "}",
      "",
      'export const message: Payload = { text: "installed-runner-ok" };',
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(workspace, "src", "main.ts"),
    [
      'import { message, type Payload } from "@lib/message";',
      "",
      'console.debug("strip-me");',
      "debugger;",
      "export const value: Payload = message;",
      "console.log(value.text);",
      "",
    ].join("\n"),
  );
  writeUnpluginFixture();
}

function writeUnpluginFixture() {
  fs.mkdirSync(path.join(workspace, "unplugin-src"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "tsconfig.unplugin.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          module: "ESNext",
          rootDir: ".",
          plugins: [
            {
              transform: "./unplugin-transform.cjs",
            },
          ],
        },
        include: ["unplugin-src/bundler.ts"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "unplugin-src", "bundler.ts"),
    [
      'export const bundled: string = goUpper("installed-unplugin-ok");',
      "console.log(bundled);",
      "",
    ].join("\n"),
    "utf8",
  );
  writeUnpluginTransformPlugin();
  fs.writeFileSync(
    path.join(workspace, "vite.config.mjs"),
    [
      'import path from "node:path";',
      'import ttsc from "@ttsc/unplugin/vite";',
      'import { defineConfig } from "vite";',
      "",
      "export default defineConfig({",
      "  build: {",
      "    emptyOutDir: true,",
      "    minify: false,",
      '    outDir: "dist-vite",',
      "    rollupOptions: {",
      '      input: path.resolve("unplugin-src/bundler.ts"),',
      "      output: {",
      '        entryFileNames: "bundler.js",',
      '        format: "es",',
      "      },",
      "    },",
      "  },",
      '  logLevel: "silent",',
      '  plugins: [ttsc({ project: "tsconfig.unplugin.json" })],',
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeUnpluginTransformPlugin() {
  fs.writeFileSync(
    path.join(workspace, "unplugin-transform.cjs"),
    [
      'const path = require("node:path");',
      "",
      "module.exports = function createUnpluginTransform() {",
      "  return {",
      '    name: "unplugin-transform-fixture",',
      '    source: path.resolve(__dirname, "unplugin-transform-go"),',
      "  };",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.mkdirSync(path.join(workspace, "unplugin-transform-go"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(workspace, "unplugin-transform-go", "go.mod"),
    "module example.com/ttscunplugininstall\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspace, "unplugin-transform-go", "main.go"),
    [
      "package main",
      "",
      "import (",
      '  "encoding/json"',
      '  "flag"',
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      '  "regexp"',
      '  "strings"',
      ")",
      "",
      'var goUpperCall = regexp.MustCompile(`goUpper\\("([^"]*)"\\)`)',
      "",
      "type transformResult struct {",
      '  TypeScript map[string]string `json:"typescript"`',
      "}",
      "",
      "func main() { os.Exit(run(os.Args[1:])) }",
      "",
      "func run(args []string) int {",
      "  if len(args) == 0 { return 2 }",
      "  switch args[0] {",
      '  case "transform":',
      "    return transform(args[1:])",
      '  case "check", "version", "build":',
      "    return 0",
      "  default:",
      '    fmt.Fprintf(os.Stderr, "unknown command %q\\n", args[0])',
      "    return 2",
      "  }",
      "}",
      "",
      "func transform(args []string) int {",
      '  fs := flag.NewFlagSet("transform", flag.ContinueOnError)',
      '  cwd := fs.String("cwd", "", "")',
      '  _ = fs.String("tsconfig", "", "")',
      '  _ = fs.String("plugins-json", "", "")',
      "  if err := fs.Parse(args); err != nil { return 2 }",
      "  root := *cwd",
      '  if root == "" { root, _ = os.Getwd() }',
      '  source, err := os.ReadFile(filepath.Join(root, "unplugin-src", "bundler.ts"))',
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "  code := goUpperCall.ReplaceAllStringFunc(string(source), func(call string) string {",
      "    match := goUpperCall.FindStringSubmatch(call)",
      "    if len(match) != 2 { return call }",
      '    return fmt.Sprintf("%q", strings.ToUpper(match[1]))',
      "  })",
      '  data, err := json.Marshal(transformResult{TypeScript: map[string]string{"unplugin-src/bundler.ts": code}})',
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "  fmt.Fprintln(os.Stdout, string(data))",
      "  return 0",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

function installTarballs() {
  const command = [
    "npm install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...registryDependencies,
    tarball("ttsc"),
    tarball(platformTarball),
    ...packageTarballs.map(tarball),
  ].join(" ");
  run(command, workspace);
}

function verifyInstalledPackages() {
  const platformBin = path.join(
    workspace,
    "node_modules",
    "@ttsc",
    platformKey,
    "bin",
    process.platform === "win32" ? "ttsc.exe" : "ttsc",
  );
  const platformGo = path.join(
    workspace,
    "node_modules",
    "@ttsc",
    platformKey,
    "bin",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  assert(fs.existsSync(platformBin), `${platformPackage} binary must exist`);
  assert(
    fs.existsSync(platformGo),
    `${platformPackage} bundled Go compiler must exist`,
  );
  assert(
    !fs.existsSync(path.join(workspace, "node_modules", "ttsc", "native")),
    "ttsc package must not ship a workspace-local native fallback",
  );
  const ttscPackage = JSON.parse(
    fs.readFileSync(
      path.join(workspace, "node_modules", "ttsc", "package.json"),
      "utf8",
    ),
  );
  for (const [name, version] of Object.entries(
    ttscPackage.optionalDependencies ?? {},
  )) {
    assert(
      version === ttscPackage.version,
      `ttsc optional dependency ${name} must resolve to exact package version ${ttscPackage.version}, got ${version}`,
    );
  }

  const nativeDemo = run("npx ttsc demo --type=string", workspace).stdout;
  assert(
    nativeDemo.includes("emitted by ttsc platform helper") &&
      nativeDemo.includes('"string" === typeof input'),
    "npx ttsc demo must execute the installed platform helper",
  );

  const version = run("npx ttsc --version", workspace).stdout;
  assert(/^ttsc /m.test(version), "npx ttsc --version must print ttsc banner");
  const ttsx = run("npx ttsx --version", workspace).stdout;
  assert(/^ttsx /m.test(ttsx), "npx ttsx --version must print ttsx banner");
  assertPackageFileMissing("@ttsc/lint", "tsconfig.json");
  assertPackageFileMissing("@ttsc/unplugin", "tsconfig.json");
  assertPackageFileMissing("@ttsc/unplugin", "lib/_virtual");
  assertPackageFileMissing("@ttsc/unplugin", "lib/vite.cjs");
  assertPackageFileExists("@ttsc/unplugin", "lib/vite.js");
  assertPackageFileExists("@ttsc/unplugin", "lib/vite.mjs");
  const unpluginPackage = readInstalledPackageJson("@ttsc/unplugin");
  assert(
    unpluginPackage.type === undefined,
    "@ttsc/unplugin must not set package.json type=module",
  );
  assert(
    unpluginPackage.peerDependencies === undefined,
    "@ttsc/unplugin must not publish peerDependencies",
  );
  assert(
    unpluginPackage.exports?.["./vite"]?.import === "./lib/vite.mjs" &&
      unpluginPackage.exports?.["./vite"]?.default === "./lib/vite.js",
    "@ttsc/unplugin must publish ESM through import and CJS through default",
  );
}

function verifyUnpluginEntrypoints() {
  fs.writeFileSync(
    path.join(workspace, "verify-unplugin.mjs"),
    [
      'const root = await import("@ttsc/unplugin");',
      'if (typeof root.default.vite !== "function") {',
      '  throw new Error("@ttsc/unplugin ESM default import must expose adapters");',
      "}",
      "",
      'const api = await import("@ttsc/unplugin/api");',
      'if (typeof api.resolveOptions !== "function") {',
      '  throw new Error("@ttsc/unplugin/api resolveOptions must be exported");',
      "}",
      'if (typeof api.transformTtsc !== "function") {',
      '  throw new Error("@ttsc/unplugin/api transformTtsc must be exported");',
      "}",
      "",
      "for (const entrypoint of [",
      '  "bun",',
      '  "esbuild",',
      '  "farm",',
      '  "next",',
      '  "rolldown",',
      '  "rollup",',
      '  "rspack",',
      '  "vite",',
      '  "webpack",',
      "]) {",
      "  const mod = await import(`@ttsc/unplugin/${entrypoint}`);",
      '  if (typeof mod.default !== "function") {',
      "    throw new Error(`${entrypoint} ESM default import must be a function`);",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  run("node verify-unplugin.mjs", workspace);
  fs.writeFileSync(
    path.join(workspace, "verify-unplugin.cjs"),
    [
      'const root = require("@ttsc/unplugin");',
      'if (typeof root.default.vite !== "function") {',
      '  throw new Error("@ttsc/unplugin CJS require must expose adapters");',
      "}",
      "",
      'const api = require("@ttsc/unplugin/api");',
      'if (typeof api.resolveOptions !== "function") {',
      '  throw new Error("@ttsc/unplugin/api resolveOptions must be exported through CJS");',
      "}",
      'if (typeof api.transformTtsc !== "function") {',
      '  throw new Error("@ttsc/unplugin/api transformTtsc must be exported through CJS");',
      "}",
      "",
      "for (const entrypoint of [",
      '  "bun",',
      '  "esbuild",',
      '  "farm",',
      '  "next",',
      '  "rolldown",',
      '  "rollup",',
      '  "rspack",',
      '  "vite",',
      '  "webpack",',
      "]) {",
      "  const mod = require(`@ttsc/unplugin/${entrypoint}`);",
      '  if (typeof mod.default !== "function") {',
      "    throw new Error(`${entrypoint} CJS require must expose a default function`);",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  run("node verify-unplugin.cjs", workspace);
}

function verifyUnpluginViteBuild() {
  run("npx vite build --config vite.config.mjs", workspace);
  const output = path.join(workspace, "dist-vite", "bundler.js");
  assert(fs.existsSync(output), "Vite must emit dist-vite/bundler.js");
  const emitted = fs.readFileSync(output, "utf8");
  assert(
    emitted.includes("INSTALLED-UNPLUGIN-OK"),
    "@ttsc/unplugin/vite must preserve the intended bundled source",
  );
  assert(
    !/goUpper|installed-unplugin-ok/.test(emitted),
    "@ttsc/unplugin/vite must run the configured ttsc source transform before Vite emits",
  );
}

function assertPackageFileMissing(packageName, relative) {
  const file = path.join(
    workspace,
    "node_modules",
    ...packageName.split("/"),
    relative,
  );
  assert(!fs.existsSync(file), `${packageName} must not ship ${relative}`);
}

function assertPackageFileExists(packageName, relative) {
  const file = path.join(
    workspace,
    "node_modules",
    ...packageName.split("/"),
    relative,
  );
  assert(fs.existsSync(file), `${packageName} must ship ${relative}`);
}

function readInstalledPackageJson(packageName) {
  const file = path.join(
    workspace,
    "node_modules",
    ...packageName.split("/"),
    "package.json",
  );
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function verifyTtscBuild() {
  runInstalledTtsc(["--cwd", ".", "--emit"], workspace);
  const output = path.join(workspace, "dist", "main.js");
  const messageOutput = path.join(workspace, "dist", "lib", "message.js");
  assert(fs.existsSync(output), "ttsc must emit dist/main.js");
  assert(fs.existsSync(messageOutput), "ttsc must emit dist/lib/message.js");
  const declaration = path.join(workspace, "dist", "main.d.ts");
  const jsMapFile = path.join(workspace, "dist", "main.js.map");
  const dtsMapFile = path.join(workspace, "dist", "main.d.ts.map");
  assert(fs.existsSync(declaration), "ttsc must emit dist/main.d.ts");
  assert(fs.existsSync(jsMapFile), "ttsc must emit dist/main.js.map");
  assert(fs.existsSync(dtsMapFile), "ttsc must emit dist/main.d.ts.map");
  const emitted = fs.readFileSync(output, "utf8");
  const emittedMessage = fs.readFileSync(messageOutput, "utf8");
  const emittedDeclaration = fs.readFileSync(declaration, "utf8");
  const expectedBanner = bannerPreamble("License MIT");
  assert(
    countOccurrences(emitted, expectedBanner) === 1,
    "ttsc must build and run @ttsc/banner from tarball with the bundled Go compiler",
  );
  assert(
    emittedDeclaration.startsWith(expectedBanner) &&
      countOccurrences(emittedDeclaration, expectedBanner) === 1,
    "ttsc must emit @ttsc/banner into declarations",
  );
  assert(
    /require\("\.\/lib\/message\.js"\)/.test(emitted),
    "ttsc must build and run @ttsc/paths from tarball for JavaScript output",
  );
  assert(
    /from "\.\/lib\/message\.js"/.test(emittedDeclaration),
    "ttsc must build and run @ttsc/paths from tarball for declaration output",
  );
  assert(
    !/console\.debug|strip-me|\bdebugger\b/.test(emitted),
    "ttsc must build and run @ttsc/strip from tarball before emit",
  );
  assert(
    emittedMessage.includes('"installed-runner-ok"'),
    "emitted JavaScript must contain the source string literal",
  );
  assert(
    /console\.log\(/.test(emitted),
    "emitted JavaScript must preserve the intended console.log call",
  );
  assert(
    JSON.parse(fs.readFileSync(jsMapFile, "utf8")).version === 3,
    "JavaScript source map must be valid version 3 JSON",
  );
  assert(
    JSON.parse(fs.readFileSync(dtsMapFile, "utf8")).version === 3,
    "declaration source map must be valid version 3 JSON",
  );
  assertConsoleOutput(
    "node dist/main.js",
    runNode([output], workspace, "node dist/main.js").stdout,
    "installed-runner-ok",
  );
}

function verifyTtsxRun() {
  assertConsoleOutput(
    "npx ttsx --cwd . src/main.ts",
    run("npx ttsx --cwd . src/main.ts", workspace).stdout,
    "installed-runner-ok",
  );
}

function assertConsoleOutput(command, stdout, expected) {
  const actual = stdout.trim();
  assert(
    actual === expected,
    `${command} must print ${JSON.stringify(expected)} to stdout, got ${JSON.stringify(actual)}`,
  );
}

function bannerPreamble(text) {
  const lines = text.split(/\r?\n/).filter((line, index, all) => {
    return index < all.length - 1 || line.trim() !== "";
  });
  const sep = "-".repeat(64);
  return [
    "/**",
    ` * ${sep}`,
    ...lines.map((line) => ` * ${line.replaceAll("*/", "* /")}`),
    " *",
    " * @packageDocumentation",
    " */",
  ]
    .join("\n")
    .concat("\n");
}

function countOccurrences(text, search) {
  return text.split(search).length - 1;
}

function tarball(name) {
  const file = path.join(tarballs, `${name}.tgz`);
  assert(fs.existsSync(file), `${name}.tgz must exist`);
  return file;
}

function run(command, cwd) {
  console.log(`$ ${command}`);
  const result = cp.execSync(command, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: path.join(os.tmpdir(), "ttsc-npm-cache"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result) process.stdout.write(result);
  return { stdout: result };
}

function runNode(args, cwd, label) {
  console.log(`$ ${label ?? [process.execPath, ...args].join(" ")}`);
  const result = cp.spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024 * 64,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert(result.status === 0, `node ${args.join(" ")} failed`);
  return result;
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
