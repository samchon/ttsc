import { createProject, fs, path } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies `ttsc --watch` does not rebuild for an unrelated README edit.
 *
 * Directory events are used only to reconcile compiler membership. A file that
 * remains outside the resolved program must not turn a repository-level edit
 * into a compiler invocation.
 *
 * 1. Start a no-emit project whose program contains only `src`.
 * 2. Wait for the initial real watch build to settle.
 * 3. Edit the root README and require that the session stays quiet.
 */
export const test_ttsc_watch_ignores_an_unrelated_readme =
  async (): Promise<void> => {
    const root = createProject({
      "README.md": "initial\n",
      "src/main.ts": `export const value = 1;\n`,
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
    });
    const session = new WatchSession(root);
    try {
      await session.waitForBuilds(1);
      fs.writeFileSync(path.join(root, "README.md"), "changed\n", "utf8");
      await session.waitForQuiet();
    } finally {
      await session.close();
    }
  };
