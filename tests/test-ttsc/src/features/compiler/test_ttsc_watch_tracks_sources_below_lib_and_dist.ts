import { createProject, fs, path } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies `ttsc --watch` follows included source roots named `lib` and `dist`.
 *
 * Those names were output guesses, not a compiler boundary. An authored source
 * in either directory must invalidate the program exactly like the ordinary
 * `src` input, without granting those names a permanent exclusion.
 *
 * 1. Start a no-emit project that includes `src`, `lib`, and `dist`.
 * 2. Edit the `lib` input and wait for the next build.
 * 3. After the session settles, edit the `dist` input and require another build.
 */
export const test_ttsc_watch_tracks_sources_below_lib_and_dist =
  async (): Promise<void> => {
    const root = createProject({
      "dist/value.ts": `export const distValue = 1;\n`,
      "lib/value.ts": `export const libValue = 1;\n`,
      "src/main.ts": `export const sourceValue = 1;\n`,
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
        include: ["src", "lib", "dist"],
      }),
    });
    const session = new WatchSession(root);
    try {
      await session.waitForBuilds(1);
      fs.writeFileSync(
        path.join(root, "lib", "value.ts"),
        `export const libValue = 2;\n`,
        "utf8",
      );
      await session.waitForBuilds(2);
      await session.waitForQuiet();
      fs.writeFileSync(
        path.join(root, "dist", "value.ts"),
        `export const distValue = 2;\n`,
        "utf8",
      );
      await session.waitForBuilds(3);
    } finally {
      await session.close();
    }
  };
