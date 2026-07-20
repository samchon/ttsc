import { fs, os, path } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

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
