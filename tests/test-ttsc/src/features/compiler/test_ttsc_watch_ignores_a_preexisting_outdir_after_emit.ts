import { createProject } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies `ttsc --watch` ignores emits into a pre-existing output directory.
 *
 * The former directory walk watched arbitrary output names, so the initial
 * build wrote to `build` and immediately scheduled another build forever. The
 * resolved-program watch set must exclude compiler-owned output regardless of
 * whether that directory existed before watch startup.
 *
 * 1. Materialize an emit project with a pre-existing `build` directory.
 * 2. Start the real watch launcher and wait for its initial build.
 * 3. Require a quiet period with no self-triggered rebuild.
 */
export const test_ttsc_watch_ignores_a_preexisting_outdir_after_emit =
  async (): Promise<void> => {
    const root = createProject({
      "build/.keep": "",
      "src/main.ts": `export const value = 1;\n`,
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "build",
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
    });
    const session = new WatchSession(root);
    try {
      await session.waitForBuilds(1);
      await session.waitForQuiet();
    } finally {
      await session.close();
    }
  };
