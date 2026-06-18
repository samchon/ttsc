import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const experimentRoot = path.resolve(import.meta.dirname, "..");
const root = path.resolve(experimentRoot, "../..");
const tarballs = path.join(root, "experimental", "tarballs");
const workspace = path.join(experimentRoot, ".tmp", "project");
const skipPack = process.argv.includes("--skip-pack");
const packCurrent = process.argv.includes("--pack-current");
const platformKey = `${process.platform}-${process.arch}`;
const platformPackage = `@ttsc/${platformKey}`;
const platformTarball = `ttsc-${platformKey}`;
const currentPackageTarballs = ["banner", "lint", "paths", "strip", "unplugin"];
const packageTarballs = ["banner", "lint", "paths", "strip"];
const registryDependencies = ["typescript@7.0.1-rc"];

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
  verifyTtscBuild();
  verifyTtsxRun();
  console.log("Success");
}

function prepareCurrentTarballs() {
  run("pnpm run build:current", root);

  fs.mkdirSync(tarballs, { recursive: true });
  for (const name of ["ttsc", platformTarball, ...currentPackageTarballs]) {
    fs.rmSync(path.join(tarballs, `${name}.tgz`), { force: true });
  }

  packPackage("ttsc", "ttsc");
  packPackage(platformTarball, platformTarball);
  for (const name of currentPackageTarballs) {
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
            },
            {
              transform: "@ttsc/strip",
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
    path.join(workspace, "lint.config.json"),
    JSON.stringify({}, null, 2),
  );
  fs.writeFileSync(
    path.join(workspace, "banner.config.json"),
    JSON.stringify({ text: "License MIT" }, null, 2),
  );
  fs.writeFileSync(
    path.join(workspace, "strip.config.json"),
    JSON.stringify(
      { calls: ["console.debug"], statements: ["debugger"] },
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
