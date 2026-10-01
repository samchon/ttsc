import {
  assert,
  child_process,
  fs,
  path,
  workspaceRoot,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies the release command connects coherent and incoherent workspaces to success and failure exits.
 *
 * @evidence contracts/testing.md#behavioral-verification The real release-preflight CLI accepts a coherent fixture with an off-version private package and rejects a different tag with exit 1 and the original mismatch reason.
 * @evidence contracts/testing.md#independent-expectations Authored public versions 0.19.0 require success for v0.19.0 and rejection for v0.20.0; the private package remains intentionally 0.0.0.
 * @evidence contracts/testing.md#distinguishing-cases Positive and negative command exits remain observable; all eight parsing, selection and package-coherence scenarios are exercised in the same-named direct source unit.
 * @evidence contracts/testing.md#execution-ownership This named features/platform entry invokes the real script command twice; portable workspace decisions are owned separately by src/features/platform.
 * @evidence contracts/e2e.md#necessary-boundary The command must map operation success to exit 0 and failure to exit 1 plus stderr; direct runPreflight calls cannot verify require.main dispatch or exit wiring.
 * @evidence contracts/e2e.md#shared-execution Both command requests share one immutable workspace and no installation or native producer; separate process lifetimes are required to observe both actual exit states.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The private fixture is immutable after creation, synchronous completion owns both command lifetimes and finally removes the workspace on normal return or assertion failure.
 * @evidence contracts/e2e.md#preserved-coverage Original canonical exit and mismatch exit/diagnostic survive here; all original prerelease, malformed, missing-v, public package, VSIX and absent-extension distinctions survive in the direct source unit.
 */
export function test_release_preflight_rejects_incoherent_tag_and_versions() {
    const script = path.join(workspaceRoot, "scripts", "release-preflight.cjs");
    const root = fs.mkdtempSync(
      path.join(process.cwd(), ".tmp-release-preflight-"),
    );
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
        private: {
          name: "@ttsc/internal-tool",
          version: "0.0.0",
          private: true,
        },
      });
      const okCanonical = run(canonical, "v0.19.0");
      assert.equal(okCanonical.status, 0, okCanonical.stderr);

      // Well-formed tag whose version differs from every manifest.
      const wrongVersion = run(canonical, "v0.20.0");
      assert.equal(wrongVersion.status, 1, wrongVersion.stdout);
      assert.match(
        wrongVersion.stderr,
        /does not match tag version "0\.20\.0"/,
      );

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
