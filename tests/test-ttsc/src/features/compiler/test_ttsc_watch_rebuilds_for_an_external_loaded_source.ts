import { fs, os, path } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

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
