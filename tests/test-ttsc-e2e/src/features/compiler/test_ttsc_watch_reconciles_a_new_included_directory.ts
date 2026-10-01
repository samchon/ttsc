import { createProject, fs, path } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies `ttsc --watch` reconciles a newly included source directory.
 *
 * A one-time directory snapshot can notice the directory creation but cannot
 * observe the next edit inside it. The launcher must rebuild once the new
 * included file appears, then add its directory to the persistent watch set.
 *
 * 1. Start a real watch session with one existing `src` file.
 * 2. Create `src/later/value.ts` and wait for the topology rebuild.
 * 3. Edit that new file and require one more rebuild after the session is idle.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs WatchSession with a seed, creates src/later/value.ts and waits for second completion/quiet, then rewrites that new file and requires a third completion.
 * @evidence contracts/testing.md#independent-expectations New membership must be reconciled into the persistent watch set. Independent create-then-later-edit actions distinguish one-time discovery from a retained new subscription.
 * @evidence contracts/testing.md#distinguishing-cases Owns creation of a new included directory/file and a later content edit after quiet. Completion counting does not check emitted values, successful status or exact-one-cycle behavior.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_reconciles_a_new_included_directory is discovered under src/features/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary Filesystem membership events must rebuild topology and then preserve a live input connection for later native compilation, which a static membership unit cannot prove.
 * @evidence contracts/e2e.md#shared-execution One process shares initial project load across creation/reconciliation/edit, reusing built compiler/launcher preparation without plugin builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique root and intermediate quiet separate the later edit from creation callbacks. finally closes WatchSession with bounded escalation and TestProject reclaims the tree at exit.
 * @evidence contracts/e2e.md#preserved-coverage All three build waits, intermediate quiet and create/edit operations remain unchanged. The subsequent-edit distinction is not merged into creation-only coverage.
 */
export const test_ttsc_watch_reconciles_a_new_included_directory =
  async (): Promise<void> => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "src/seed.ts": `export const seed = 1;\n`,
    });
    const session = new WatchSession(root);
    try {
      await session.waitForBuilds(1);
      const later = path.join(root, "src", "later");
      fs.mkdirSync(later);
      const value = path.join(later, "value.ts");
      fs.writeFileSync(value, `export const value = 1;\n`, "utf8");
      await session.waitForBuilds(2);
      await session.waitForQuiet();
      fs.writeFileSync(value, `export const value = 2;\n`, "utf8");
      await session.waitForBuilds(3);
    } finally {
      await session.close();
    }
  };
