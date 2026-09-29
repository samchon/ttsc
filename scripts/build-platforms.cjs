const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runIndependent } = require("./ci/run-independent.cjs");

const root = path.resolve(__dirname, "..");
const packagesDir = path.join(root, "packages");

const PACKAGE_BUILDS_BEFORE_PLATFORMS = [
  "ttsc",
  "@ttsc/factory",
  "@ttsc/banner",
  "@ttsc/lint",
  "@ttsc/evidence",
  "@ttsc/unplugin",
  "@ttsc/metro",
  "@ttsc/wasm",
  "@ttsc/playground",
  "@ttsc/vscode",
];
const PACKAGE_BUILDS_AFTER_PLATFORMS = ["@ttsc/graph"];

/** Complete every native target before deciding whether graph can execute. */
async function finishPlatformBuilds(
  directories,
  execute,
  current,
  finish,
  workers = 1,
) {
  const failed = await runIndependent(directories, execute, workers);
  // A foreign target's failure must not hide the graph verdict. Only failure
  // of the compiler the graph actually executes blocks that dependent build.
  if (!failed.includes(current)) await finish();
  return failed;
}

async function main() {
  const workers = Number(process.env.TTSC_PLATFORM_BUILD_WORKERS ?? 1);
  if (!Number.isSafeInteger(workers) || workers < 1)
    throw new Error("TTSC_PLATFORM_BUILD_WORKERS must be a positive integer");
  for (const packageName of PACKAGE_BUILDS_BEFORE_PLATFORMS) {
    run(["--filter", packageName, "build"]);
  }

  const failed = await finishPlatformBuilds(
    listPlatformPackageDirs(),
    (platformDir) =>
      new Promise((resolve) => {
        console.log(`Building platform package: ${path.basename(platformDir)}`);
        const child = cp.spawn(
          process.execPath,
          [path.join(root, "scripts", "build-platform-package.cjs")],
          {
            cwd: platformDir,
            stdio: "inherit",
            windowsHide: true,
            env: {
              ...process.env,
              GOMAXPROCS:
                process.env.GOMAXPROCS ??
                String(Math.max(1, Math.floor(os.availableParallelism() / workers))),
            },
          },
        );
        child.on("error", (error) => console.error(error));
        child.on("close", (code) => resolve(code ?? 1));
      }),
    path.join(packagesDir, `ttsc-${process.platform}-${process.arch}`),
    () => {
      for (const packageName of PACKAGE_BUILDS_AFTER_PLATFORMS)
        run(["--filter", packageName, "build"]);
    },
    workers,
  );
  if (failed.length) {
    console.error(
      `Failed platform builds: ${failed.map((directory) => path.basename(directory)).join(", ")}`,
    );
    process.exitCode = 1;
  }
}

function run(args) {
  const result = cp.spawnSync(...pnpmCommand(args), {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function pnpmCommand(args) {
  if (process.platform !== "win32") {
    return ["pnpm", args];
  }
  return ["cmd.exe", ["/d", "/s", "/c", "pnpm", ...args]];
}

function listPlatformPackageDirs() {
  return fs
    .readdirSync(packagesDir)
    .filter((entry) =>
      /^ttsc-(linux|darwin|win32)-(x64|arm|arm64)$/.test(entry),
    )
    .sort()
    .map((entry) => path.join(packagesDir, entry));
}

if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

module.exports = {
  PACKAGE_BUILDS_AFTER_PLATFORMS,
  PACKAGE_BUILDS_BEFORE_PLATFORMS,
  finishPlatformBuilds,
};
