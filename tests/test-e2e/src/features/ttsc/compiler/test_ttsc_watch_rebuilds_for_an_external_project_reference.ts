import { fs, os, path } from "../../../internal/ttsc/internal/toolchain";
import { WatchSession } from "../../../internal/ttsc/internal/watch";

/**
 * Verifies `ttsc --watch` follows sources in an external project reference.
 *
 * A referenced project's source tree is neither a child of the selected root
 * nor necessarily an import in the root program. The watch topology must walk
 * declared references and retain their compiler-resolved inputs explicitly.
 *
 * 1. Create a root project with a sibling composite project reference.
 * 2. Start the real watch launcher and wait for its initial build.
 * 3. Edit the referenced project's source and require a rebuild.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs WatchSession with a sibling composite project reference but no import to it, changes the referenced value source after startup and requires another completion.
 * @evidence contracts/testing.md#independent-expectations The independently authored references array contributes topology even without root-program imports. That declaration and changed source establish relevance independently of input discovery.
 * @evidence contracts/testing.md#distinguishing-cases Owns reference-only external inputs, contrasting with the loaded-source case. It does not inspect reference output, successful native status or exact number of cycles.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_rebuilds_for_an_external_project_reference is discovered under src/features/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary Live native-resolved reference traversal must retain sibling subscriptions after startup, which watching only the root directory cannot establish.
 * @evidence contracts/e2e.md#shared-execution One session shares reference discovery and later source edit, reusing built native compiler/launcher installation without plugin binary preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One mkdtemp container owns root/reference/config/output paths. finally closes the watcher before owned container removal; a close rejection can bypass that cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The initial/second completion waits and referenced source edit remain executable. This is topology scheduling coverage, not reference emit validation.
 */
export const test_ttsc_watch_rebuilds_for_an_external_project_reference =
  async (): Promise<void> => {
    const container = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-watch-"));
    const root = path.join(container, "root");
    const reference = path.join(container, "reference");
    const referenceSource = path.join(reference, "src", "value.ts");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(path.dirname(referenceSource), { recursive: true });
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
        references: [{ path: "../reference" }],
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `export const root = 1;\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(reference, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          composite: true,
          declaration: true,
          module: "commonjs",
          outDir: "lib",
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "utf8",
    );
    fs.writeFileSync(referenceSource, `export const value = 1;\n`, "utf8");
    const session = new WatchSession(root);
    try {
      await session.waitForBuilds(1);
      fs.writeFileSync(referenceSource, `export const value = 2;\n`, "utf8");
      await session.waitForBuilds(2);
    } finally {
      await session.close();
      fs.rmSync(container, { force: true, recursive: true });
    }
  };
