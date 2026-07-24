import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  path,
} from "../../internal/plugin-corpus";
import { WatchSession } from "../../internal/watch";

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
 * 6. Suppress React Native JSX's real adjacent `.js` emit.
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
    const session = new WatchSession(root, {
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    try {
      await session.waitForBuilds(1);

      fs.writeFileSync(path.join(root, "docs", "spec.md"), "broken\n", "utf8");
      await session.waitForBuilds(2);
      await session.waitForQuiet(300);
      assert.match(session.transcript(), /TS9001: Markdown input is stale/);

      fs.writeFileSync(
        path.join(root, "docs", "spec.md"),
        "# Contract\n",
        "utf8",
      );
      await session.waitForBuilds(3);
      await session.waitForQuiet(300);

      fs.mkdirSync(path.join(root, "api", "v1"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "api", "v1", "openapi.json"),
        '{"broken":true}\n',
        "utf8",
      );
      await session.waitForBuilds(4);
      await session.waitForQuiet(300);
      assert.match(session.transcript(), /TS9002: Swagger input is stale/);

      fs.writeFileSync(path.join(root, "README.md"), "changed\n", "utf8");
      await session.waitForQuiet();
    } finally {
      await session.close();
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
      assert.match(positional.transcript(), /TS9001: Markdown input is stale/);
    } finally {
      await positional.close();
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
      assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), true);
    } finally {
      await emittingPositional.close();
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
    } finally {
      await invalid.close();
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
        assert.equal(
          extended.transcript().includes("invalid snapshot"),
          false,
          extended.transcript(),
        );
      } finally {
        await extended.close();
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
          jsx: "react-native",
          module: "commonjs",
          plugins: [{ transform: "./plugins/watch.cjs" }],
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
      await reactNative.waitForQuiet();
      assert.equal(fs.existsSync(path.join(root, "src", "view.js")), true);
    } finally {
      await reactNative.close();
    }
  };

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
