const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const platformKey = `${process.platform}-${process.arch}`;
const platformDir = path.join(root, "packages", `ttsc-${platformKey}`);

if (!fs.existsSync(path.join(platformDir, "package.json"))) {
  throw new Error(`Unsupported current platform package: ttsc-${platformKey}`);
}

// The platform package carries the native ttsc compiler binary; it is marked
// PLATFORM and always built before any package whose own build runs `ttsc`
// (e.g. @ttsc/graph, lint-contributor-demo).
const PLATFORM = Symbol("platform");

// `TTSC_BUILD_SCOPE` trims the build to what a given test lane actually
// exercises. The heavy cost in a full build is @ttsc/graph (its build runs
// `ttsc` with the typia plugin) plus the native binary; the test suites below
// reference neither graph, vscode, metro, nor unplugin, so skipping them cuts
// the per-lane build roughly in half.
const SCOPES = {
  // Everything, in dependency-safe order (native binary before graph/demo).
  full: [
    "ttsc",
    "@ttsc/banner",
    "@ttsc/lint",
    "@ttsc/unplugin",
    "@ttsc/metro",
    "@ttsc/vscode",
    PLATFORM,
    "@ttsc/graph",
    "lint-contributor-demo",
  ],
  // test-ttsc drives ttsc + the banner/lint native plugins and asserts on the
  // @ttsc/vscode install artifact (its .vsix); it never touches graph/metro/
  // unplugin.
  "test-ttsc": ["ttsc", "@ttsc/banner", "@ttsc/lint", "@ttsc/vscode", PLATFORM],
  // test-lint drives ttsc + the lint engine, references @ttsc/banner, and builds
  // the contributor demo plugin.
  "test-lint": [
    "ttsc",
    "@ttsc/banner",
    "@ttsc/lint",
    PLATFORM,
    "lint-contributor-demo",
  ],
};

const scope = process.env.TTSC_BUILD_SCOPE || "full";
const plan = SCOPES[scope];
if (plan === undefined) {
  throw new Error(
    `Unknown TTSC_BUILD_SCOPE "${scope}"; expected one of ${Object.keys(SCOPES).join(", ")}`,
  );
}

for (const target of plan) {
  if (target === PLATFORM) run(["--dir", platformDir, "build"]);
  else run(["--filter", target, "build"]);
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
