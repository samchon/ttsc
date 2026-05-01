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
const bannerTarball = "banner";

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
  for (const name of ["ttsc", platformTarball, bannerTarball]) {
    fs.rmSync(path.join(tarballs, `${name}.tgz`), { force: true });
  }

  packPackage("ttsc", "ttsc");
  packPackage(platformTarball, platformTarball);
  packPackage("banner", bannerTarball);
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
  const packed = fs.readdirSync(packageDir).find((entry) => entry.endsWith(".tgz"));
  assert(packed, `${packageDirName} package tarball must be created`);
  fs.copyFileSync(
    path.join(packageDir, packed),
    path.join(tarballs, `${tarballName}.tgz`),
  );
}

function prepareWorkspace() {
  fs.rmSync(path.join(experimentRoot, ".tmp"), { recursive: true, force: true });
  fs.mkdirSync(path.join(workspace, "src"), { recursive: true });
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
          outDir: "dist",
          rootDir: "src",
          plugins: [
            {
              transform: "@ttsc/banner",
              banner: "/*! bundled-go-ok */",
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
    path.join(workspace, "src", "main.ts"),
    'const message: string = "installed-runner-ok";\nconsole.log(message);\n',
  );
}

function installTarballs() {
  const command = [
    "npm install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarball("ttsc"),
    tarball(platformTarball),
    tarball(bannerTarball),
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
  assert(fs.existsSync(platformGo), `${platformPackage} bundled Go compiler must exist`);
  assert(
    !fs.existsSync(path.join(workspace, "node_modules", "ttsc", "native")),
    "ttsc package must not ship a workspace-local native fallback",
  );
  const ttscPackage = JSON.parse(
    fs.readFileSync(path.join(workspace, "node_modules", "ttsc", "package.json"), "utf8"),
  );
  for (const [name, version] of Object.entries(ttscPackage.optionalDependencies ?? {})) {
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
}

function verifyTtscBuild() {
  runInstalledTtsc(["--cwd", ".", "--emit"], workspace);
  const output = path.join(workspace, "dist", "main.js");
  assert(fs.existsSync(output), "ttsc must emit dist/main.js");
  const emitted = fs.readFileSync(output, "utf8");
  assert(
    emitted.startsWith("/*! bundled-go-ok */"),
    "ttsc must build and run @ttsc/banner with the bundled Go compiler",
  );
  assert(
    emitted.includes('"installed-runner-ok"'),
    "emitted JavaScript must contain the source string literal",
  );
  assert(
    /console\.log\(\s*message\s*\)/.test(emitted),
    "emitted JavaScript must preserve the intended console.log call",
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
  assert(result.status === 0, `installed ttsc failed with status ${result.status}`);
  return result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
