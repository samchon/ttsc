import cp from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { isPlatformPackage, listPublishablePackages } = createRequire(
  import.meta.url,
)("../../scripts/publishable-packages.cjs") as {
  isPlatformPackage(manifest: Record<string, unknown>): boolean;
  listPublishablePackages(root: string): {
    directory: string;
    entry: string;
    error?: Error;
    manifest?: Record<string, unknown>;
  }[];
};

// Two modes:
//
//   default — used by `pnpm package:tgz` for release rehearsals. Packs every
//             publishable package under `packages/` — the same set
//             `pnpm run package:latest:publish` pushes — plus every platform
//             tarball (~15-20 min on CI).
//
//   --current / TTSC_TARBALLS_CURRENT=1 — used by PR CI (typia.yml today, plus
//             any future workflow that just needs ttsc + the local platform
//             tarball). Calls `pnpm run build:current` instead of the full
//             `pnpm run build`, and only packs the current-platform package.
//             Drops typical CI time from ~20 min to ~3 min.

const CURRENT_ONLY =
  process.argv.includes("--current") ||
  process.env.TTSC_TARBALLS_CURRENT === "1";

/**
 * The deliberately narrow current-platform set, by directory name.
 *
 * PR CI installs only ttsc, the utility plugins and the local platform tarball,
 * so everything an integration workflow never installs stays out. In particular
 * `@ttsc/wasm` is intentionally skipped — its only PR-CI consumer would be a
 * website build, and the website is not part of the typia / bun smoke flow.
 * Full mode packs everything (release).
 */
const CURRENT_PACKAGES = [
  "ttsc",
  "banner",
  "lint",
  "paths",
  "strip",
  "unplugin",
];

const root = path.resolve(import.meta.dirname, "../..");
const outputDir = import.meta.dirname;
const platformKey = `${process.platform}-${process.arch}`;

const targets = listTargets();
preparePackages();
clearOutputDirectory();
for (const target of targets) build(target);

function preparePackages() {
  const script = CURRENT_ONLY ? "build:current" : "build";
  console.log(`Preparing packages (pnpm run ${script})`);
  cp.execSync(`pnpm run ${script}`, {
    cwd: root,
    env: {
      ...process.env,
      ...(CURRENT_ONLY ? { TTSC_BUILD_SCOPE: "experimental" } : {}),
    },
    stdio: "inherit",
  });
}

function build(target: {
  dir: string;
  name: string;
  platform: boolean;
  tarballName: string;
}) {
  for (const entry of fs.readdirSync(target.dir)) {
    if (entry.endsWith(".tgz")) {
      fs.rmSync(path.join(target.dir, entry), { force: true });
    }
  }

  console.log("Building package (tgz):", target.name);
  const out = path.join(outputDir, `${target.tarballName}.tgz`);
  fs.rmSync(out, { force: true });

  const pack =
    process.platform === "win32"
      ? {
          command: process.env.ComSpec ?? "cmd.exe",
          args: ["/d", "/s", "/c", "pnpm", "pack", "--out", out],
        }
      : { command: "pnpm", args: ["pack", "--out", out] };
  const result = cp.spawnSync(pack.command, pack.args, {
    cwd: target.dir,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (result.stdout.length > 0) process.stdout.write(result.stdout);
    if (result.stderr.length > 0) process.stderr.write(result.stderr);
    const cause =
      result.signal === null
        ? `status ${result.status}`
        : `signal ${result.signal}`;
    throw new Error(`pnpm pack failed for ${target.name}: ${cause}`);
  }
  if (!fs.existsSync(out)) {
    throw new Error(`package tarball was not created: ${target.name}`);
  }
  if (target.tarballName === "vscode") {
    cp.execFileSync("node", ["scripts/assert-vscode-package.cjs", out], {
      cwd: root,
      stdio: "inherit",
    });
  }
  if (target.platform) {
    cp.execFileSync("node", ["scripts/assert-platform-package.cjs", out], {
      cwd: root,
      stdio: "inherit",
    });
  }
}

function clearOutputDirectory() {
  for (const entry of fs.readdirSync(outputDir)) {
    if (entry.endsWith(".tgz")) {
      fs.rmSync(path.join(outputDir, entry), { force: true });
    }
  }
}

/**
 * The packages this mode packs, each with its directory, name, and whether it
 * is a platform package.
 *
 * Full mode is the rehearsal for `pnpm run package:latest:publish`, so it packs
 * the set that command publishes (`listPublishablePackages`): every one of them
 * reaches a consumer through the registry, and a `files` gap, a missing
 * `exports` target, or an unbuilt `lib` only shows up in a real `pnpm pack`.
 * Platform packages are the ones whose manifest restricts an OS and a CPU, so a
 * platform added to the release is packed without a second list naming it.
 * Current mode keeps its narrow set and the platform package of this host.
 */
function listTargets() {
  const publishable = listPublishablePackages(root);
  for (const { entry, error } of publishable) {
    if (error !== undefined) {
      throw new Error(
        `packages/${entry}/package.json is not valid JSON: ${error.message}`,
      );
    }
  }
  const targets = publishable.map(({ directory, entry, manifest }) => ({
    dir: directory,
    manifest: manifest!,
    name: manifest!.name as string,
    platform: isPlatformPackage(manifest!),
    tarballName: entry,
  }));
  if (!CURRENT_ONLY) {
    return targets;
  }
  const hostPlatform = targets.filter(
    (target) =>
      target.platform &&
      (target.manifest.os as string[]).includes(process.platform) &&
      (target.manifest.cpu as string[]).includes(process.arch),
  );
  if (hostPlatform.length === 0) {
    throw new Error(
      `Unsupported current-only platform: no platform package for ${platformKey}`,
    );
  }
  const core = CURRENT_PACKAGES.map((name) => {
    const target = targets.find((candidate) => candidate.tarballName === name);
    if (target === undefined) {
      throw new Error(`package target does not exist: ${name}`);
    }
    return target;
  });
  return [...core, ...hostPlatform];
}
