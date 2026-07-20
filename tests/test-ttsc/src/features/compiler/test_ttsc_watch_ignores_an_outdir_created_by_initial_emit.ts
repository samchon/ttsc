import { createProject } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies `ttsc --watch` ignores an output directory created by its first
 * emit.
 *
 * The output directory does not exist while the watch topology is resolved, so
 * this covers the creation event that used to turn an otherwise idle compiler
 * into a rebuild loop.
 *
 * 1. Materialize an emit project whose configured `build` directory is absent.
 * 2. Start the real watch launcher and wait for its initial emit.
 * 3. Require a quiet period after `build` is created by that emit.
 */
export const test_ttsc_watch_ignores_an_outdir_created_by_initial_emit =
  async (): Promise<void> => {
    const root = createProject({
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
