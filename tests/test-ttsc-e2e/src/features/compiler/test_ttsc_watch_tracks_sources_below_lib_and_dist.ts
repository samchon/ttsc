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
 *
 * @evidence contracts/testing.md#behavioral-verification Runs noEmit WatchSession including src/lib/dist, edits lib then waits for second completion/quiet, edits dist and requires a third completion.
 * @evidence contracts/testing.md#independent-expectations Explicitly included sources remain inputs regardless of common output directory names. Authored include declarations and distinct edits establish expected relevance independently of string filtering.
 * @evidence contracts/testing.md#distinguishing-cases Owns lib and dist as source roots with separately observed transitions. Configured output exclusion cases provide negative neighboring behavior; no emitted content or exact cycle count is asserted.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_tracks_sources_below_lib_and_dist is discovered under src/features/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary The live topology must retain real native-resolved input subscriptions under both names and route their later filesystem events, beyond static path classification.
 * @evidence contracts/e2e.md#shared-execution One watch process/load covers both roots and edits, sharing native compiler/launcher installation without a plugin producer or per-root host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique noEmit project avoids generated-output events; quiet separates lib and dist mutations. finally closes the watcher and TestProject removes all fixture files at worker exit.
 * @evidence contracts/e2e.md#preserved-coverage Both source changes, three build waits and intermediate quiet remain in the named entry. Completion counts certify scheduling rather than output semantics.
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
