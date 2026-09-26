import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
} from "../../internal/plugin-corpus";
import { loadProjectPlugins } from "../../internal/project";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies a watch session rebuilds a plugin binary the cache removed while the
 * session still used it.
 *
 * A `ttsc --watch` session resolves its check plugins once and keeps their
 * binary paths across cycles. When the cache's collector removed an entry the
 * session still used, the session went on naming the removed path, and the
 * sidecar respawn or one-shot fallback that needed it could not start the
 * plugin (samchon/ttsc#1556). A cycle that finds a binary gone now sends the
 * session back through plugin resolution, which builds it again.
 *
 * The binary is moved aside rather than deleted: a running executable cannot be
 * deleted on Windows but can be renamed, and either way the session's path
 * names nothing. The session builds into a cache of its own, since the test
 * removes an entry's binary.
 *
 * 1. Start `ttsc --noEmit --watch` on a lint project, wait for it to settle, and
 *    look up the lint binary the session resolved.
 * 2. Move the binary aside and edit a source.
 * 3. Assert the cycle built the binary again at its path and still checks.
 */
export const test_plugin_corpus_check_watch_rebuilds_a_plugin_binary_the_cache_removed =
  async (): Promise<void> => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({ rules: { "no-var": "error" } }),
    );
    const source = path.join(root, "src", "main.ts");
    fs.writeFileSync(source, "var legacy = 1;\nJSON.stringify(legacy);\n");
    const cacheDir = TestProject.tmpdir("ttsc-watch-plugin-removed-");
    const env = { PATH: goPath(), TTSC_CACHE_DIR: cacheDir };
    const session = new WatchSession(root, {
      args: ["--noEmit", "--diagnostics"],
      env,
    });
    try {
      await session.waitForBuilds(1, 300_000);
      await session.waitForSettled();
      const binary = loadProjectPlugins({
        binary: "",
        cacheDir,
        cwd: root,
        env: { ...process.env, ...env },
        tsconfig: path.join(root, "tsconfig.json"),
      }).nativePlugins.find((plugin) => plugin.name === "@ttsc/lint")!.binary;
      fs.renameSync(binary, `${binary}.removed`);

      // A cycle queued before the move may still run on the old binary; the
      // edit's own cycle is the one that must find it gone.
      fs.writeFileSync(source, "var legacy = 2;\nJSON.stringify(legacy);\n");
      await waitFor(
        () => fs.existsSync(binary),
        `the removed binary is built again:\n${session.transcript()}`,
      );
      await waitFor(
        () => session.transcript().includes("var legacy = 2"),
        `the session checks the edit:\n${session.transcript()}`,
      );
    } finally {
      await session.close();
    }
  };

async function waitFor(
  condition: () => boolean,
  message: string,
): Promise<void> {
  const deadline = Date.now() + 300_000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, message);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
