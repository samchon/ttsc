import { fs, os, path } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies `ttsc --watch` follows an `extends` config outside the project root.
 *
 * A recursive snapshot of the selected tsconfig directory cannot see a shared
 * parent config. The resolved config chain is an explicit compiler input and
 * must therefore rebuild the already-running session when it changes.
 *
 * 1. Create a project whose tsconfig extends a sibling shared config directory.
 * 2. Start a real watch session and wait for its initial build.
 * 3. Edit the external base config and require one topology rebuild.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs WatchSession extending a sibling base.json, waits for startup, changes strict true to false in that external file and requires a second completion.
 * @evidence contracts/testing.md#independent-expectations The explicit extends chain is a compiler input outside the selected directory. Authored config relation/value change establishes relevance independently of the watcher computed input list.
 * @evidence contracts/testing.md#distinguishing-cases Owns an existing external base-config edit. External imported sources and reference projects have distinct owners; completion counting accepts failed builds and does not validate new strict semantics.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_rebuilds_for_an_external_extended_config is discovered under src/features/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary The running host must retain an external config subscription beyond a project-root walk and route its later filesystem event into native rebuild.
 * @evidence contracts/e2e.md#shared-execution One process shares config-chain load and subscriptions across the edit. Built native compiler/launcher installation is reused with no plugin compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One mkdtemp container owns project/config siblings; finally closes the session before deleting that exact container. A rejected close can skip the subsequent removal, an existing cleanup limitation.
 * @evidence contracts/e2e.md#preserved-coverage Both completion waits and strict edit remain. At-least-two completions establish scheduling rather than exactly one successful rebuild.
 */
export const test_ttsc_watch_rebuilds_for_an_external_extended_config =
  async (): Promise<void> => {
    const container = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-watch-"));
    const root = path.join(container, "project");
    const config = path.join(container, "config", "base.json");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        extends: "../config/base.json",
        include: ["src"],
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `export const value = 1;\n`,
      "utf8",
    );
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
      }),
      "utf8",
    );
    const session = new WatchSession(root);
    try {
      await session.waitForBuilds(1);
      fs.writeFileSync(
        config,
        JSON.stringify({
          compilerOptions: {
            module: "commonjs",
            noEmit: true,
            strict: false,
            target: "ES2022",
          },
        }),
        "utf8",
      );
      await session.waitForBuilds(2);
    } finally {
      await session.close();
      fs.rmSync(container, { force: true, recursive: true });
    }
  };
