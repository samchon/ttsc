import {
  assert,
  child_process,
  fs,
  path,
  workspaceRoot,
} from "../../internal/toolchain";

/**
 * Verifies the release preflight rejects incoherent tags and package versions.
 *
 * Locks `scripts/release-preflight.cjs::runPreflight`, the gate that must fail a
 * release before the workflow reaches Marketplace or npm publication. The
 * workflow triggers on every pushed tag, so a malformed tag or a tag whose
 * version disagrees with the workspace manifests could otherwise publish
 * irreversible releases and only then fail a post-publish smoke test. Each case
 * has a negative twin so an over-permissive check cannot hide.
 *
 * 1. Materialize synthetic workspaces (canonical, prerelease, per-package
 *    mismatch, missing vscode) under a temp root.
 * 2. Spawn the preflight script with a tag against each root.
 * 3. Assert exit 0 only for the coherent canonical and prerelease releases, and
 *    exit 1 with the offending reason for every malformed or mismatched input,
 *    proving the private package is skipped and no case mutates state.
 */
export const test_release_preflight_rejects_incoherent_tag_and_versions = () => {
  const script = path.join(workspaceRoot, "scripts", "release-preflight.cjs");
  const root = fs.mkdtempSync(path.join(process.cwd(), ".tmp-release-preflight-"));
  try {
    const run = (dir: string, tag: string) =>
      child_process.spawnSync(
        process.execPath,
        [script, "--root", dir, "--tag", tag],
        { cwd: workspaceRoot, encoding: "utf8", windowsHide: true },
      );

    // Canonical: every public package plus @ttsc/vscode at the tagged version,
    // with a private package deliberately off-version to prove it is skipped.
    const canonical = writeWorkspace(root, "canonical", "0.19.0", {
      private: { name: "@ttsc/internal-tool", version: "0.0.0", private: true },
    });
    const okCanonical = run(canonical, "v0.19.0");
    assert.equal(okCanonical.status, 0, okCanonical.stderr);

    // Positive twin: a valid semver prerelease tag matching prerelease manifests.
    const prerelease = writeWorkspace(root, "prerelease", "0.19.0-rc.1");
    const okPrerelease = run(prerelease, "v0.19.0-rc.1");
    assert.equal(okPrerelease.status, 0, okPrerelease.stderr);

    // Malformed tag matching the workflow's `*` trigger but not `v${semver}`.
    const malformed = run(canonical, "release-test");
    assert.equal(malformed.status, 1, malformed.stdout);
    assert.match(malformed.stderr, /must be exactly v\$\{version\}/);

    // Missing leading `v`.
    const noV = run(canonical, "0.19.0");
    assert.equal(noV.status, 1, noV.stdout);
    assert.match(noV.stderr, /missing leading 'v'/);

    // Well-formed tag whose version differs from every manifest.
    const wrongVersion = run(canonical, "v0.20.0");
    assert.equal(wrongVersion.status, 1, wrongVersion.stdout);
    assert.match(wrongVersion.stderr, /does not match tag version "0\.20\.0"/);

    // Cross-artifact npm mismatch: a single package off the release version.
    const npmSkew = writeWorkspace(root, "npm-skew", "0.19.0", {
      lint: { name: "@ttsc/lint", version: "0.19.1" },
    });
    const npmSkewResult = run(npmSkew, "v0.19.0");
    assert.equal(npmSkewResult.status, 1, npmSkewResult.stdout);
    assert.match(
      npmSkewResult.stderr,
      /@ttsc\/lint version "0\.19\.1" does not match tag version "0\.19\.0"/,
    );

    // VSIX/Marketplace mismatch: the extension manifest naming the VSIX is skewed.
    const vsixSkew = writeWorkspace(root, "vsix-skew", "0.19.0", {
      vscode: { name: "@ttsc/vscode", version: "0.19.2" },
    });
    const vsixSkewResult = run(vsixSkew, "v0.19.0");
    assert.equal(vsixSkewResult.status, 1, vsixSkewResult.stdout);
    assert.match(
      vsixSkewResult.stderr,
      /@ttsc\/vscode version "0\.19\.2" does not match tag version "0\.19\.0"/,
    );

    // The VSIX artifact source must exist for the cross-artifact check to mean
    // anything; a workspace without @ttsc/vscode must fail rather than pass.
    const noVscode = writeWorkspace(root, "no-vscode", "0.19.0", {
      dropVscode: true,
    });
    const noVscodeResult = run(noVscode, "v0.19.0");
    assert.equal(noVscodeResult.status, 1, noVscodeResult.stdout);
    assert.match(noVscodeResult.stderr, /@ttsc\/vscode manifest not found/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

interface Override {
  name: string;
  version: string;
  private?: boolean;
}

function writeWorkspace(
  root: string,
  label: string,
  version: string,
  options: {
    lint?: Override;
    vscode?: Override;
    private?: Override;
    dropVscode?: boolean;
  } = {},
): string {
  const dir = path.join(root, label);
  const packages: Array<{ dir: string; manifest: Override }> = [
    { dir: "ttsc", manifest: { name: "ttsc", version } },
    {
      dir: "lint",
      manifest: options.lint ?? { name: "@ttsc/lint", version },
    },
    { dir: "wasm", manifest: { name: "@ttsc/wasm", version } },
  ];
  if (!options.dropVscode) {
    packages.push({
      dir: "vscode",
      manifest: options.vscode ?? { name: "@ttsc/vscode", version },
    });
  }
  if (options.private) {
    packages.push({ dir: "internal-tool", manifest: options.private });
  }
  for (const pkg of packages) {
    const manifestPath = path.join(dir, "packages", pkg.dir, "package.json");
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(pkg.manifest), "utf8");
  }
  return dir;
}
