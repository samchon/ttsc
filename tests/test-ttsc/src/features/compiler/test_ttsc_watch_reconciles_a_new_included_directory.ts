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
