// Release preflight gate: validate the pushed tag and every published package
// version as one coherent release BEFORE any external publication command runs.
//
// The release workflow triggers on every pushed tag (`on.push.tags: ["*"]`) and
// publishes to the VS Code Marketplace and npm before any tag-derived smoke test
// runs. A malformed tag, or a tag whose version disagrees with the workspace
// manifests, could therefore create irreversible external releases and only then
// fail. This script encodes the repository's lockstep release shape and fails
// with a non-zero exit and zero side effects when the release is incoherent:
//
//   - the tag must be exactly `v${version}` for a valid semver version
//     (prerelease identifiers allowed);
//   - every public workspace package selected by `package:latest:publish`
//     (non-private `packages/*`) must carry that same version; and
//   - the VS Code extension manifest (`packages/vscode`), whose version names
//     the generated VSIX/Marketplace artifact, must agree as well.
//
// The script only reads files and writes to stdout/stderr; it never mutates a
// registry, so it is safe to run as the first release step and to unit-test with
// a synthetic `--root`.
//
// Usage:
//   node scripts/release-preflight.cjs                 # tag from GITHUB_REF_NAME
//   node scripts/release-preflight.cjs --tag v1.2.3    # explicit tag
//   node scripts/release-preflight.cjs --tag v1.2.3 --root /path/to/workspace

const fs = require("node:fs");
const path = require("node:path");

// Official SemVer 2.0.0 grammar (https://semver.org). Captures the core version
// and optional prerelease/build-metadata; anchored so garbage tags are rejected.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Validate a release without any side effects.
 *
 * @param {{ tag?: string, root?: string }} options
 * @returns {{ ok: boolean, errors: string[], version: string|null, packages: string[] }}
 */
function runPreflight(options) {
  const root = options.root ?? path.resolve(__dirname, "..");
  const tag = options.tag;
  const errors = [];

  if (!tag) {
    errors.push(
      "release-preflight: no release tag provided (set GITHUB_REF_NAME or pass --tag)",
    );
    return { ok: false, errors, version: null, packages: [] };
  }

  const versionMatch = /^v(.+)$/.exec(tag);
  if (!versionMatch) {
    errors.push(
      `release-preflight: tag ${JSON.stringify(tag)} must be exactly v\${version} (missing leading 'v')`,
    );
    return { ok: false, errors, version: null, packages: [] };
  }
  const version = versionMatch[1];
  if (!SEMVER.test(version)) {
    errors.push(
      `release-preflight: tag ${JSON.stringify(tag)} does not encode a valid semver version (${JSON.stringify(version)})`,
    );
    return { ok: false, errors, version, packages: [] };
  }

  const packagesDir = path.join(root, "packages");
  if (!fs.existsSync(packagesDir)) {
    errors.push(`release-preflight: no packages directory at ${packagesDir}`);
    return { ok: false, errors, version, packages: [] };
  }

  const published = [];
  let vscodeChecked = false;
  for (const entry of fs.readdirSync(packagesDir).sort()) {
    const manifestPath = path.join(packagesDir, entry, "package.json");
    if (!fs.existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (cause) {
      errors.push(
        `release-preflight: packages/${entry}/package.json is not valid JSON: ${cause.message}`,
      );
      continue;
    }
    // `package:latest:publish` runs `pnpm -r publish`, which skips private
    // packages; the preflight must mirror that selection exactly.
    if (manifest.private === true) continue;
    if (typeof manifest.name !== "string") continue;

    published.push(manifest.name);
    if (typeof manifest.version !== "string") {
      errors.push(
        `release-preflight: ${manifest.name} has no version to publish`,
      );
      continue;
    }
    if (manifest.version !== version) {
      errors.push(
        `release-preflight: ${manifest.name} version ${JSON.stringify(manifest.version)} does not match tag version ${JSON.stringify(version)}`,
      );
    }
    if (manifest.name === "@ttsc/vscode") vscodeChecked = true;
  }

  if (published.length === 0) {
    errors.push(
      `release-preflight: no publishable packages found under ${packagesDir}`,
    );
  }
  // The VSIX/Marketplace artifact name is derived from packages/vscode's
  // version; if that package is absent the cross-artifact check silently passes,
  // so require its presence explicitly.
  if (published.length > 0 && !vscodeChecked) {
    errors.push(
      "release-preflight: @ttsc/vscode manifest not found; cannot validate the VSIX/Marketplace artifact version",
    );
  }

  return { ok: errors.length === 0, errors, version, packages: published };
}

function parseArgs(argv) {
  const options = { tag: process.env.GITHUB_REF_NAME, root: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--tag") {
      options.tag = argv[++i];
    } else if (arg.startsWith("--tag=")) {
      options.tag = arg.slice("--tag=".length);
    } else if (arg === "--root") {
      options.root = argv[++i];
    } else if (arg.startsWith("--root=")) {
      options.root = arg.slice("--root=".length);
    } else {
      throw new Error(`release-preflight: unknown argument ${JSON.stringify(arg)}`);
    }
  }
  return options;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const result = runPreflight(options);
  if (!result.ok) {
    for (const error of result.errors) console.error(error);
    process.exit(1);
  }
  console.log(
    `release-preflight: OK — tag v${result.version} matches ${result.packages.length} publishable package(s)`,
  );
}

module.exports = { runPreflight, parseArgs, SEMVER };
