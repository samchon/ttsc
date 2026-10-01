import { fs, os, path } from "../../../internal/ttsc/internal/toolchain";
import { WatchSession } from "../../../internal/ttsc/internal/watch";

/**
 * Verifies `ttsc --watch` follows a resolved source dependency outside its
 * root.
 *
 * The compiler's list-files result can contain a source loaded through a
 * relative import beyond the selected config directory. Its direct file watch
 * must remain active after the first build.
 *
 * 1. Create a project importing a TypeScript file from a sibling directory.
 * 2. Start the real watch launcher and wait for its initial build.
 * 3. Edit that external loaded source and require a rebuild.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs WatchSession on a source importing sibling dependency/value.ts, changes its value from 1 to 2 after startup and requires a second completion.
 * @evidence contracts/testing.md#independent-expectations The authored relative import makes this external source a compiler input. Its explicit changed bytes establish relevance independently of native list-files enumeration.
 * @evidence contracts/testing.md#distinguishing-cases Owns an external loaded source rather than extends configuration or references. It measures scheduling, not emitted-value fidelity, exact cycle count or successful completion.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_rebuilds_for_an_external_loaded_source is discovered under src/features/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary Actual native program discovery must become a persistent external file watch whose later callback reaches the running host.
 * @evidence contracts/e2e.md#shared-execution One process retains resolved program/subscriptions for the dependency edit. Shared built native compiler/launcher need no additional producer or plugin build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The unique container isolates project/dependency siblings and write follows startup. finally closes WatchSession then removes the exact container; close rejection can leave the directory.
 * @evidence contracts/e2e.md#preserved-coverage Both build waits and dependency rewrite remain. No output assertion or exact-one-cycle requirement is implied by completion counting.
 */
export const test_ttsc_watch_rebuilds_for_an_external_loaded_source =
  async (): Promise<void> => {
    const container = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-watch-"));
    const root = path.join(container, "project");
    const dependency = path.join(container, "dependency", "value.ts");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(path.dirname(dependency), { recursive: true });
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          moduleResolution: "node",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `import { value } from "../../dependency/value";\nexport { value };\n`,
      "utf8",
    );
    fs.writeFileSync(dependency, `export const value = 1;\n`, "utf8");
    const session = new WatchSession(root);
    try {
      await session.waitForBuilds(1);
      fs.writeFileSync(dependency, `export const value = 2;\n`, "utf8");
      await session.waitForBuilds(2);
    } finally {
      await session.close();
      fs.rmSync(container, { force: true, recursive: true });
    }
  };
