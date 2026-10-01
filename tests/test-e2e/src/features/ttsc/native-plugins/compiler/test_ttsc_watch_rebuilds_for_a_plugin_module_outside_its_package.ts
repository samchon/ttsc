import { TestProject } from "@ttsc/testing";

import { goPath } from "../../../../internal/ttsc/internal/plugin-corpus";
import { assert, fs, path, workspaceRoot } from "../../../../internal/ttsc/internal/toolchain";
import { WatchSession } from "../../../../internal/ttsc/internal/watch";

/**
 * Verifies `ttsc --watch` rebuilds when a plugin's Go module changes outside
 * the plugin's own package directory, and not when a directory the build passes
 * over does (samchon/ttsc#1492).
 *
 * A plugin's `source` may name a package anywhere below its module, and the
 * build copies and keys the whole module. The session watched the package
 * directory alone, so an edit to a sibling package the plugin imports, or to
 * the module's `go.mod`, changed the binary the next run would build while no
 * run started, and the session kept serving the old binary's output.
 *
 * 1. Copy the real source-plugin fixture with its `main` package moved to
 *    `cmd/plugin`, importing a sibling package `internal/mark` whose suffix it
 *    appends, and wait for the first build.
 * 2. Edit the sibling package, and require a rebuild whose output carries the new
 *    suffix, which only the new binary writes.
 * 3. Edit the module's `go.mod`, and require another rebuild.
 * 4. Write below the module's `node_modules`, and require no rebuild.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs relocated cmd/plugin importing internal/mark; asserts PLUGIN initially, PLUGIN-SIBLING after sibling edit, another rebuild on go.mod edit and quiet after node_modules change.
 * @evidence contracts/testing.md#independent-expectations The Go module files copied into a native plugin determine its identity while skipped dependency trees do not. Authored suffix literals independently expose which rebuilt transform binary executes.
 * @evidence contracts/testing.md#distinguishing-cases Owns package-below-module, sibling Go code, go.mod and ignored node_modules. patch assertions establish deliberate fixture inputs before the real transformed-output assertions.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_rebuilds_for_a_plugin_module_outside_its_package is discovered under src/features/native-plugins/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary The module-root watch must invalidate/build/select a real Go plugin and deliver changed output, which source-hash or watch-classifier units cannot establish.
 * @evidence contracts/e2e.md#shared-execution One watch session/private artifact cache batches initial and changed binaries plus an ignored edit. Changed module bytes require a new artifact; suite Go object cache and built host are reusable preparations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Owned root/cache and child-only PATH/TTSC_CACHE_DIR isolate artifacts. finally closes WatchSession; TestProject cleans directories at worker exit after Windows descendants release them. Ignored edit uses a 3000ms quiet observation.
 * @evidence contracts/e2e.md#preserved-coverage Both literal outputs, go.mod rebuild and ignored-directory quiet remain unchanged at src/features/native-plugins/compiler. patch/writeMark remain owned by the named entry and CI must include the native compiler lane.
 */
export const test_ttsc_watch_rebuilds_for_a_plugin_module_outside_its_package =
  async (): Promise<void> => {
    // Removed when the suite exits: ending the session ends its descendants,
    // which on Windows go a moment later and hold the directory until then.
    const root = TestProject.tmpdir("ttsc-watch-module-");
    const cache = TestProject.tmpdir("ttsc-watch-cache-");
    fs.cpSync(
      path.join(workspaceRoot, "packages", "ttsc", "test", "go-source-plugin"),
      root,
      { recursive: true },
    );
    const module = path.join(root, "go-plugin");
    const main = path.join(module, "cmd", "plugin", "main.go");
    const mark = path.join(module, "internal", "mark", "mark.go");
    const output = path.join(root, "dist", "main.js");
    fs.mkdirSync(path.dirname(main), { recursive: true });
    fs.writeFileSync(
      main,
      patch(fs.readFileSync(path.join(module, "main.go"), "utf8")),
      "utf8",
    );
    fs.rmSync(path.join(module, "main.go"));
    writeMark(mark, "");
    fs.mkdirSync(path.join(module, "node_modules", "pkg"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      [
        'const path = require("node:path");',
        "",
        "module.exports = (context) => ({",
        '  name: "go-source-plugin",',
        '  source: path.resolve(context.dirname, "go-plugin", "cmd", "plugin"),',
        "});",
        "",
      ].join("\n"),
      "utf8",
    );
    const localGo = goPath();
    const session = new WatchSession(root, {
      env: {
        ...(localGo === undefined ? {} : { PATH: localGo }),
        TTSC_CACHE_DIR: cache,
      },
    });
    try {
      // 1. The first build, through the moved package.
      await session.waitForBuilds(1);
      assert.match(fs.readFileSync(output, "utf8"), /"PLUGIN"/);

      // 2. A sibling package of the module.
      writeMark(mark, "-SIBLING");
      await session.waitForBuilds(2);
      assert.match(fs.readFileSync(output, "utf8"), /"PLUGIN-SIBLING"/);

      // 3. The module's own go.mod.
      fs.appendFileSync(path.join(module, "go.mod"), "\n// watched\n", "utf8");
      await session.waitForBuilds(3);

      // 4. A directory the build passes over.
      fs.writeFileSync(
        path.join(module, "node_modules", "pkg", "index.js"),
        "module.exports = 1;\n",
        "utf8",
      );
      await session.waitForQuiet(3_000);
    } finally {
      await session.close();
    }
  };

/** Make the fixture's `main` package append the sibling package's suffix. */
function patch(source: string): string {
  const imported = source.replace(
    "import (\n",
    'import (\n  "go-source-plugin/internal/mark"\n',
  );
  const appended = imported.replace(
    "value = strings.ToUpper(value)",
    "value = strings.ToUpper(value) + mark.Suffix()",
  );
  assert.notEqual(appended, imported, "the fixture's uppercase step moved");
  assert.notEqual(imported, source, "the fixture's import block moved");
  return appended;
}

function writeMark(file: string, suffix: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    [
      "package mark",
      "",
      "// Suffix is what the plugin appends to every value it uppercases.",
      "func Suffix() string {",
      `  return ${JSON.stringify(suffix)}`,
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}
