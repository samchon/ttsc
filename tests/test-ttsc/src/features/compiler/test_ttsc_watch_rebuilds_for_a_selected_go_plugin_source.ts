import { goPath } from "../../internal/plugin-corpus";
import { fs, os, path, workspaceRoot } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies `ttsc --watch` follows the selected Go plugin source tree.
 *
 * Native plugins are compiler inputs after their descriptor resolves, not a
 * project-directory convention. Their source edit must rebuild the running
 * session so the content-addressed plugin binary is selected again.
 *
 * 1. Copy the real source-plugin fixture and wait for the initial watch build.
 * 2. Edit the selected plugin's Go implementation.
 * 3. Require one more real watch build without restarting the process.
 */
export const test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source =
  async (): Promise<void> => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-watch-"));
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-watch-cache-"));
    fs.cpSync(
      path.join(workspaceRoot, "tests", "projects", "go-source-plugin"),
      root,
      { recursive: true },
    );
    const source = path.join(root, "go-plugin", "main.go");
    const localGo = goPath();
    const session = new WatchSession(root, {
      env: {
        ...(localGo === undefined ? {} : { PATH: localGo }),
        TTSC_CACHE_DIR: cache,
      },
    });
    try {
      await session.waitForBuilds(1);
      fs.appendFileSync(source, "\n// watch topology regression\n", "utf8");
      await session.waitForBuilds(2);
    } finally {
      await session.close();
      fs.rmSync(root, { force: true, recursive: true });
      fs.rmSync(cache, { force: true, recursive: true });
    }
  };
