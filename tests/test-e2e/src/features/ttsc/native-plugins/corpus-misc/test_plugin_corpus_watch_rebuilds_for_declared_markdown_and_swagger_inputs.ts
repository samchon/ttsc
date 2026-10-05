import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  path,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import { WatchSession } from "../../../../internal/ttsc/internal/watch";

/**
 * Verifies a real check-plugin watch follows declared Markdown and Swagger
 * inputs without widening to unrelated workspace documents.
 *
 * The sidecar publishes one exact Markdown file plus initially empty JSON and
 * emitted-JavaScript globs. Its check command reads the data sources, so each
 * legitimate filesystem wake-up has an observable fresh diagnostic while the
 * compiler's adjacent JavaScript stays quiet.
 *
 * 1. Start a real emitting watch with the exact file present and globs empty.
 * 2. Break and repair Markdown, then create a broken Swagger JSON match.
 * 3. Assert each declared transition rebuilds once and an unrelated README is
 *    quiet.
 * 4. Emit adjacent JavaScript in positional watch without a rebuild loop.
 * 5. Reject relative paths but accept Windows extended-length filesystem paths
 *    through the real plugin-sidecar protocol.
 * 6. Suppress positional `.js` and `.jsx` outputs declared by the plugin's
 *    JavaScript globs.
 * 7. Remove the plugin and prove its former Go source no longer wakes watch.
 *
 * @evidence contracts/testing.md#behavioral-verification Real watch reacts to declared Markdown edits and Swagger creation, reports fixture diagnostics, and remains quiet for unrelated README, emitted JS/JSX, and retired plugin sources.
 * @evidence contracts/testing.md#independent-expectations The authored sidecar declares exact inputs and prints fixed TS9001/TS9002 messages for broken content; quiet waits independently observe the absence of extra cycles.
 * @evidence contracts/testing.md#distinguishing-cases Broken/repaired file, initially empty glob creation, relative snapshot rejection, Windows extended paths, positional JSX modes, and removed plugin all remain asserted.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_watch_rebuilds_for_declared_markdown_and_swagger_inputs entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary Real watch consumes the compiled sidecar project-inputs protocol and connects exact files/globs to subsequent filesystem wakeups and emitted-output suppression. One sidecar fixture supplies all transitions; unit glob/state calculations alone cannot prove producer membership reaches actual watcher registration and retirement.
 * @evidence contracts/e2e.md#shared-execution The original phases share one authored check sidecar source, consumer and suite producer cache. Each owned watch closes successfully before the original input reset and next phase; cache-hit/build/process totals and minimum preparation are not measured. Phase failures are collected, while uncertain close stops reset and preserves prior failures.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns consumer/sidecar source; shared cache remains suite-owned and valid reuse requires equivalent source/host/toolchain inputs. Child-specific environment does not mutate ambient state. Every phase joins supported WatchSession.close before reset; body and close failures remain together, unknown join retains inputs. Transcript completed-cycle counts and bounded quiet waits are not kernel notification/Program/process totals or arbitrary-descendant/image certification.
 * @evidence contracts/e2e.md#preserved-coverage Real watch reacts to declared Markdown edits and Swagger creation, reports fixture diagnostics, and remains quiet for unrelated README, emitted JS/JSX, and retired plugin sources. These assertions stay in test_plugin_corpus_watch_rebuilds_for_declared_markdown_and_swagger_inputs with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_watch_rebuilds_for_declared_markdown_and_swagger_inputs =
  async (): Promise<void> => {
    const root = commonJsProject(
      {
        "docs/spec.md": "# Contract\n",
        "plugins/watch.cjs": `module.exports = (context) => ({
  name: "project-input-watch",
  source: require("node:path").resolve(context.dirname, "watch-go"),
  stage: "check",
  capabilities: { projectInputs: true },
});\n`,
        "plugins/watch-go/go.mod":
          "module example.com/projectinputwatch\n\ngo 1.26\n",
        "plugins/watch-go/main.go": goSource(),
        "README.md": "unrelated\n",
        "src/main.ts": "export const value: number = 1;\n",
      },
      {
        compilerOptions: {
          noEmit: false,
          plugins: [{ transform: "./plugins/watch.cjs" }],
        },
      },
    );
    assert.equal(fs.existsSync(path.join(root, "api")), false);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
    const errors: unknown[] = [];
    try {
      const session = new WatchSession(root, {
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      });
      try {
        await session.waitForBuilds(1);

        fs.writeFileSync(
          path.join(root, "docs", "spec.md"),
          "broken\n",
          "utf8",
        );
        await session.waitForBuilds(2);
        await session.waitForQuiet(300);
        assertDeclaredInputBuildCount(session, 2);
        assert.match(session.transcript(), /TS9001: Markdown input is stale/);

        fs.writeFileSync(
          path.join(root, "docs", "spec.md"),
          "# Contract\n",
          "utf8",
        );
        await session.waitForBuilds(3);
        await session.waitForQuiet(300);
        assertDeclaredInputBuildCount(session, 3);

        fs.mkdirSync(path.join(root, "api", "v1"), { recursive: true });
        fs.writeFileSync(
          path.join(root, "api", "v1", "openapi.json"),
          '{"broken":true}\n',
          "utf8",
        );
        await session.waitForBuilds(4);
        await session.waitForQuiet(300);
        assertDeclaredInputBuildCount(session, 4);
        assert.match(session.transcript(), /TS9002: Swagger input is stale/);

        fs.writeFileSync(path.join(root, "README.md"), "changed\n", "utf8");
        await session.waitForQuiet();
        assertDeclaredInputBuildCount(session, 4);
      } catch (error) {
        errors.push(
          new Error("declared-input watch session phase", { cause: error }),
        );
      } finally {
        await closeDeclaredInputWatch(session, "session");
      }

      fs.writeFileSync(
        path.join(root, "docs", "spec.md"),
        "# Contract\n",
        "utf8",
      );
      const positional = new WatchSession(root, {
        args: ["check", "src/main.ts"],
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      });
      try {
        await positional.waitForBuilds(1);
        fs.writeFileSync(
          path.join(root, "docs", "spec.md"),
          "positional broken\n",
          "utf8",
        );
        await positional.waitForBuilds(2);
        await positional.waitForQuiet(300);
        assertDeclaredInputBuildCount(positional, 2);
        assert.match(
          positional.transcript(),
          /TS9001: Markdown input is stale/,
        );
      } catch (error) {
        errors.push(
          new Error("declared-input watch positional phase", { cause: error }),
        );
      } finally {
        await closeDeclaredInputWatch(positional, "positional");
      }

      fs.writeFileSync(
        path.join(root, "docs", "spec.md"),
        "# Contract\n",
        "utf8",
      );
      fs.rmSync(path.join(root, "api"), { recursive: true, force: true });
      const emittingPositional = new WatchSession(root, {
        args: ["src/main.ts"],
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      });
      try {
        await emittingPositional.waitForBuilds(1);
        await emittingPositional.waitForQuiet();
        assertDeclaredInputBuildCount(emittingPositional, 1);
        assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), true);
      } catch (error) {
        errors.push(
          new Error("declared-input watch emittingPositional phase", {
            cause: error,
          }),
        );
      } finally {
        await closeDeclaredInputWatch(emittingPositional, "emittingPositional");
      }

      const invalid = new WatchSession(root, {
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
          TTSC_TEST_PROJECT_INPUT_MODE: "relative",
        },
      });
      try {
        await invalid.waitForBuilds(1);
        assert.match(
          invalid.transcript(),
          /invalid snapshot.*not an absolute local path/s,
        );
      } catch (error) {
        errors.push(
          new Error("declared-input watch invalid phase", { cause: error }),
        );
      } finally {
        await closeDeclaredInputWatch(invalid, "invalid");
      }

      if (process.platform === "win32") {
        const extended = new WatchSession(root, {
          env: {
            PATH: goPath(),
            TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
            TTSC_TEST_PROJECT_INPUT_MODE: "extended",
          },
        });
        try {
          await extended.waitForBuilds(1);
          await extended.waitForQuiet();
          assertDeclaredInputBuildCount(extended, 1);
          assert.equal(
            extended.transcript().includes("invalid snapshot"),
            false,
            extended.transcript(),
          );
        } catch (error) {
          errors.push(
            new Error("declared-input watch extended phase", { cause: error }),
          );
        } finally {
          await closeDeclaredInputWatch(extended, "extended");
        }
      }

      fs.writeFileSync(
        path.join(root, "src", "view.tsx"),
        "export const view = 1;\n",
        "utf8",
      );
      fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            jsx: "preserve",
            module: "commonjs",
            plugins: [{ transform: "./plugins/watch.cjs" }],
            rootDir: "src",
            strict: true,
            target: "ES2022",
          },
          include: ["src"],
        }),
        "utf8",
      );
      const reactNative = new WatchSession(root, {
        args: ["src/view.tsx", "-JSX", "react-native"],
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      });
      try {
        await reactNative.waitForBuilds(1);
        assert.equal(
          fs.existsSync(path.join(root, "src", "view.js")),
          true,
          reactNative.transcript(),
        );
        assert.equal(
          fs.existsSync(path.join(root, "src", "view.jsx")),
          false,
          reactNative.transcript(),
        );
        await reactNative.waitForQuiet();
        assertDeclaredInputBuildCount(reactNative, 1);
      } catch (error) {
        errors.push(
          new Error("declared-input watch reactNative phase", { cause: error }),
        );
      } finally {
        await closeDeclaredInputWatch(reactNative, "reactNative");
      }

      fs.rmSync(path.join(root, "src", "view.js"), { force: true });
      fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            jsx: "react-native",
            module: "commonjs",
            plugins: [{ transform: "./plugins/watch.cjs" }],
            rootDir: "src",
            strict: true,
            target: "ES2022",
          },
          include: ["src"],
        }),
        "utf8",
      );
      const preserve = new WatchSession(root, {
        args: ["src/view.tsx", "-JSX", "preserve"],
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      });
      try {
        await preserve.waitForBuilds(1);
        assert.equal(
          fs.existsSync(path.join(root, "src", "view.jsx")),
          true,
          preserve.transcript(),
        );
        assert.equal(
          fs.existsSync(path.join(root, "src", "view.js")),
          false,
          preserve.transcript(),
        );
        await preserve.waitForQuiet();
        assertDeclaredInputBuildCount(preserve, 1);
      } catch (error) {
        errors.push(
          new Error("declared-input watch preserve phase", { cause: error }),
        );
      } finally {
        await closeDeclaredInputWatch(preserve, "preserve");
      }

      fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            module: "commonjs",
            plugins: [{ transform: "./plugins/watch.cjs" }],
            rootDir: "src",
            strict: true,
            target: "ES2022",
          },
          include: ["src"],
        }),
        "utf8",
      );
      const removal = new WatchSession(root, {
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      });
      try {
        await removal.waitForBuilds(1);
        fs.writeFileSync(
          path.join(root, "tsconfig.json"),
          JSON.stringify({
            compilerOptions: {
              module: "commonjs",
              rootDir: "src",
              strict: true,
              target: "ES2022",
            },
            include: ["src"],
          }),
          "utf8",
        );
        await removal.waitForBuilds(2);
        await removal.waitForQuiet(300);
        assertDeclaredInputBuildCount(removal, 2);
        fs.appendFileSync(
          path.join(root, "plugins", "watch-go", "main.go"),
          "\n// removed plugin input\n",
          "utf8",
        );
        await removal.waitForQuiet();
        assertDeclaredInputBuildCount(removal, 2);
      } catch (error) {
        errors.push(
          new Error("declared-input watch removal phase", { cause: error }),
        );
      } finally {
        await closeDeclaredInputWatch(removal, "removal");
      }
    } catch (error) {
      throw new AggregateError(
        [...errors, error],
        "declared-input watch phase setup or close",
      );
    }
    if (errors.length)
      throw new AggregateError(errors, "declared-input watch phases");
  };

/**
 * Label supported close failure; the owning outer guard preserves body failures
 * and stops reset.
 */
async function closeDeclaredInputWatch(
  session: WatchSession,
  label: string,
): Promise<void> {
  try {
    await session.close();
  } catch (error) {
    throw new Error(`declared-input watch ${label} close`, { cause: error });
  }
}

/**
 * Literal expected completed-cycle count from the public transcript, not
 * Program/process totals.
 */
function assertDeclaredInputBuildCount(
  session: WatchSession,
  expected: number,
): void {
  const transcript = session.transcript();
  assert.equal(
    (transcript.match(/\[ttsc\] watch build (?:complete|failed)/g) ?? [])
      .length,
    expected,
    transcript,
  );
}

function goSource(): string {
  return [
    "package main",
    "",
    "import (",
    '\t"encoding/json"',
    '\t"fmt"',
    '\t"io/fs"',
    '\t"os"',
    '\t"path/filepath"',
    '\t"runtime"',
    '\t"strings"',
    ")",
    "",
    "func main() {",
    "\tif len(os.Args) < 2 { return }",
    "\troot, _ := os.Getwd()",
    "\tswitch os.Args[1] {",
    '\tcase "project-inputs":',
    '\t\tif os.Getenv("TTSC_TEST_PROJECT_INPUT_MODE") == "relative" {',
    "\t\t\t_ = json.NewEncoder(os.Stdout).Encode(map[string]any{",
    '\t\t\t\t"root": root,',
    '\t\t\t\t"files": []string{"docs/spec.md"},',
    '\t\t\t\t"globs": []string{},',
    "\t\t\t})",
    "\t\t\treturn",
    "\t\t}",
    '\t\tif os.Getenv("TTSC_TEST_PROJECT_INPUT_MODE") == "extended" && runtime.GOOS == "windows" {',
    "\t\t\textendedRoot := `\\\\?\\` + root",
    "\t\t\t_ = json.NewEncoder(os.Stdout).Encode(map[string]any{",
    '\t\t\t\t"root": extendedRoot,',
    '\t\t\t\t"files": []string{filepath.Join(extendedRoot, "docs", "spec.md")},',
    '\t\t\t\t"globs": []string{filepath.ToSlash(filepath.Join(extendedRoot, "api", "**", "*.json"))},',
    "\t\t\t})",
    "\t\t\treturn",
    "\t\t}",
    "\t\t_ = json.NewEncoder(os.Stdout).Encode(map[string]any{",
    '\t\t\t"root": root,',
    '\t\t\t"files": []string{filepath.Join(root, "docs", "spec.md")},',
    '\t\t\t"globs": []string{',
    '\t\t\t\tfilepath.ToSlash(filepath.Join(root, "api", "**", "*.json")),',
    '\t\t\t\tfilepath.ToSlash(filepath.Join(root, "**", "*.js")),',
    '\t\t\t\tfilepath.ToSlash(filepath.Join(root, "**", "*.jsx")),',
    "\t\t\t},",
    "\t\t})",
    '\tcase "check":',
    "\t\tfailed := false",
    '\t\tif text, err := os.ReadFile(filepath.Join(root, "docs", "spec.md")); err != nil || strings.Contains(string(text), "broken") {',
    '\t\t\tfmt.Fprintln(os.Stderr, "docs/spec.md(1,1): error TS9001: Markdown input is stale")',
    "\t\t\tfailed = true",
    "\t\t}",
    '\t\t_ = filepath.WalkDir(filepath.Join(root, "api"), func(name string, entry fs.DirEntry, err error) error {',
    "\t\t\tif err != nil { return nil }",
    '\t\t\tif entry.IsDir() || filepath.Ext(name) != ".json" { return nil }',
    "\t\t\ttext, readErr := os.ReadFile(name)",
    '\t\t\tif readErr != nil || strings.Contains(string(text), "broken") {',
    '\t\t\t\tfmt.Fprintln(os.Stderr, "api/openapi.json(1,1): error TS9002: Swagger input is stale")',
    "\t\t\t\tfailed = true",
    "\t\t\t}",
    "\t\t\treturn nil",
    "\t\t})",
    "\t\tif failed { os.Exit(1) }",
    "\t}",
    "}",
    "",
  ].join("\n");
}
