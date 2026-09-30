import {
  assert,
  fs,
  path,
  workspaceRoot,
  requireFromTest,
} from "../../internal/script-unit";

/**
 * Verifies the release preflight rejects incoherent tags and package versions.
 *
 * Locks `scripts/release-preflight.cjs::runPreflight`, the gate that must fail
 * a release before the workflow reaches Marketplace or npm publication. The
 * workflow triggers on every pushed tag, so a malformed tag or a tag whose
 * version disagrees with the workspace manifests could otherwise publish
 * irreversible releases and only then fail a post-publish smoke test. Each case
 * has a negative twin so an over-permissive check cannot hide.
 *
 * 1. Materialize synthetic workspaces (canonical, prerelease, per-package
 *    mismatch, missing vscode) under a temp root.
 * 2. Call the authored runPreflight operation with a tag against each root.
 * 3. Assert ok only for the coherent canonical and prerelease releases, and
 *    failure with the offending reason for every malformed or mismatched input,
 *    proving the private package is skipped and no case mutates state.
 *
 * @evidence contracts/testing.md#behavioral-verification runPreflight admits canonical and prerelease releases and rejects malformed, missing-v, wrong-version, npm-skew, VSIX-skew and absent-VSCode inputs with the original literal diagnostic reasons.
 * @evidence contracts/testing.md#independent-expectations Independently authored fixture manifests and literal semver tags define the public-package coherence contract, including the deliberately off-version private package.
 * @evidence contracts/testing.md#distinguishing-cases Preserves both positive roots and six distinct rejection causes; the private off-version package contrasts with the public skew cases.
 * @evidence contracts/testing.md#execution-ownership The named src/unit/platform entry calls the actual exported script operation directly on private manifest fixtures without installs, native builds or child hosts; CLI success/failure wiring remains in the surviving boundary case.
 */
export function test_release_preflight_rejects_incoherent_tag_and_versions() {
    const { runPreflight } = requireFromTest(path.join(workspaceRoot, "scripts", "release-preflight.cjs"));
    const root = fs.mkdtempSync(
      path.join(process.cwd(), ".tmp-release-preflight-"),
    );
    try {
      const run = (dir: string, tag: string) => runPreflight({ root: dir, tag }) as { ok: boolean; errors: string[] };

      // Canonical: every public package plus @ttsc/vscode at the tagged version,
      // with a private package deliberately off-version to prove it is skipped.
      const canonical = writeWorkspace(root, "canonical", "0.19.0", {
        private: {
          name: "@ttsc/internal-tool",
          version: "0.0.0",
          private: true,
        },
      });
      const okCanonical = run(canonical, "v0.19.0");
      assert.equal(okCanonical.ok, true, okCanonical.errors.join("\n"));

      // Positive twin: a valid semver prerelease tag matching prerelease manifests.
      const prerelease = writeWorkspace(root, "prerelease", "0.19.0-rc.1");
      const okPrerelease = run(prerelease, "v0.19.0-rc.1");
      assert.equal(okPrerelease.ok, true, okPrerelease.errors.join("\n"));

      // Malformed tag matching the workflow's `*` trigger but not `v${semver}`.
      const malformed = run(canonical, "release-test");
      assert.equal(malformed.ok, false, malformed.errors.join("\n"));
      assert.match(malformed.errors.join("\n"), /must be exactly v\$\{version\}/);

      // Missing leading `v`.
      const noV = run(canonical, "0.19.0");
      assert.equal(noV.ok, false, noV.errors.join("\n"));
      assert.match(noV.errors.join("\n"), /missing leading 'v'/);

      // Well-formed tag whose version differs from every manifest.
      const wrongVersion = run(canonical, "v0.20.0");
      assert.equal(wrongVersion.ok, false, wrongVersion.errors.join("\n"));
      assert.match(
        wrongVersion.errors.join("\n"),
        /does not match tag version "0\.20\.0"/,
      );

      // Cross-artifact npm mismatch: a single package off the release version.
      const npmSkew = writeWorkspace(root, "npm-skew", "0.19.0", {
        lint: { name: "@ttsc/lint", version: "0.19.1" },
      });
      const npmSkewResult = run(npmSkew, "v0.19.0");
      assert.equal(npmSkewResult.ok, false, npmSkewResult.errors.join("\n"));
      assert.match(
        npmSkewResult.errors.join("\n"),
        /@ttsc\/lint version "0\.19\.1" does not match tag version "0\.19\.0"/,
      );

      // VSIX/Marketplace mismatch: the extension manifest naming the VSIX is skewed.
      const vsixSkew = writeWorkspace(root, "vsix-skew", "0.19.0", {
        vscode: { name: "@ttsc/vscode", version: "0.19.2" },
      });
      const vsixSkewResult = run(vsixSkew, "v0.19.0");
      assert.equal(vsixSkewResult.ok, false, vsixSkewResult.errors.join("\n"));
      assert.match(
        vsixSkewResult.errors.join("\n"),
        /@ttsc\/vscode version "0\.19\.2" does not match tag version "0\.19\.0"/,
      );

      // The VSIX artifact source must exist for the cross-artifact check to mean
      // anything; a workspace without @ttsc/vscode must fail rather than pass.
      const noVscode = writeWorkspace(root, "no-vscode", "0.19.0", {
        dropVscode: true,
      });
      const noVscodeResult = run(noVscode, "v0.19.0");
      assert.equal(noVscodeResult.ok, false, noVscodeResult.errors.join("\n"));
      assert.match(noVscodeResult.errors.join("\n"), /@ttsc\/vscode manifest not found/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

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
