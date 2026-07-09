import { TestProject } from "@ttsc/testing";

import { goPath, spawn, ttscBin } from "../../internal/plugin-corpus";
import {
  assert,
  buildSourcePlugin,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies ttsc e2e: reclaims stale legacy source-plugin locks.
 *
 * The hang report reached the CLI through package plugin discovery and then
 * stalled in the shared source-plugin cache. The lower-level lock test pins the
 * helper branch; this e2e keeps the launcher/loadProjectPlugins path honest by
 * running `ttsc -p tsconfig.json --noEmit` against the same abandoned lock.
 *
 * 1. Seed the exact source-plugin cache entry with a binary, then replace it with
 *    an old metadata-less `.lock` directory.
 * 2. Run the real local `ttsc` launcher with that cache directory.
 * 3. Assert the CLI exits successfully and reports reclaiming the abandoned lock
 *    instead of waiting for the legacy timeout.
 */
export const test_ttsc_reclaims_stale_legacy_source_plugin_lock_e2e = () => {
  const root = TestProject.copyProject("go-source-plugin");
  const plugin = path.join(root, "go-plugin");
  const cacheDir = path.join(root, "cache");
  const savedPath = process.env.PATH;
  process.env.PATH = goPath();
  try {
    const binary = buildSourcePlugin({
      baseDir: root,
      cacheDir,
      pluginName: "go-source-plugin",
      source: plugin,
      quiet: true,
      ttscVersion: readWorkspaceTtscVersion(),
      tsgoVersion: "unknown",
    });
    const lockDir = `${path.dirname(binary)}.lock`;
    fs.rmSync(binary, { force: true });
    fs.mkdirSync(lockDir, { recursive: true });
    const old = new Date(Date.now() - 120_000);
    fs.utimesSync(lockDir, old, old);

    const result = spawn(ttscBin, ["-p", "tsconfig.json", "--noEmit"], {
      cwd: root,
      env: {
        TTSC_CACHE_DIR: cacheDir,
        PATH: process.env.PATH,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /reclaiming abandoned source plugin/);
    assert.match(result.stderr, /building source plugin "go-source-plugin"/);
  } finally {
    if (savedPath === undefined) delete process.env.PATH;
    else process.env.PATH = savedPath;
  }
};

function readWorkspaceTtscVersion(): string {
  const file = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "package.json",
  );
  const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
    version?: string;
  };
  return pkg.version ?? "0.0.0";
}
