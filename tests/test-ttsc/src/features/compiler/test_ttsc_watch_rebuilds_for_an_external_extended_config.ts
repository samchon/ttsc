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
