import { TestProject } from "@ttsc/testing";

import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies native execution cannot retain descriptor proof for an input it
 * changes before returning either a successful transform or a failed check.
 */
export const test_ttsccompiler_transform_omits_host_hash_changed_by_native_execution =
  () => {
    for (const stage of ["transform", "check"] as const) {
      const root = TestProject.physicalPath(
        createProject({
          plugins: [{ transform: "./plugin.cjs" }],
        }),
      );
      const config = path.join(root, "native.config.json");
      fs.writeFileSync(config, "old\n", "utf8");
      writeMutatingPlugin(root, stage);

      const result = new TtscCompiler({ binary: tsgo, cwd: root }).transform();

      assert.equal(result.type, stage === "transform" ? "success" : "failure");
      assert.equal(result.hostInputs?.includes(config), true);
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          result.hostInputHashes ?? {},
          config,
        ),
        false,
        `${stage} retained proof captured before native execution`,
      );
      assert.equal(fs.readFileSync(config, "utf8"), "new\n");
    }
  };

function writeMutatingPlugin(root: string, stage: "check" | "transform"): void {
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    [
      'const crypto = require("node:crypto");',
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      'const input = path.join(__dirname, "native.config.json");',
      "module.exports = {",
      '  name: "native-input-mutator",',
      '  source: "./plugin-go",',
      `  stage: ${JSON.stringify(stage)},`,
      "  hostInputs: [input],",
      '  hostInputHashes: { [input]: crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex") },',
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  const plugin = path.join(root, "plugin-go");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/nativeinputmutator\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(plugin, "main.go"),
    [
      "package main",
      "",
      "import (",
      '  "flag"',
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      ")",
      "",
      "func main() {",
      "  if len(os.Args) < 2 { os.Exit(2) }",
      "  flags := flag.NewFlagSet(os.Args[1], flag.ContinueOnError)",
      '  cwd := flags.String("cwd", "", "")',
      '  _ = flags.String("tsconfig", "", "")',
      '  _ = flags.String("plugins-json", "", "")',
      "  if err := flags.Parse(os.Args[2:]); err != nil { os.Exit(2) }",
      '  if err := os.WriteFile(filepath.Join(*cwd, "native.config.json"), []byte("new\\n"), 0o644); err != nil { panic(err) }',
      '  if os.Args[1] == "check" { fmt.Fprintln(os.Stderr, "native check failed"); os.Exit(2) }',
      '  if os.Args[1] == "transform" { fmt.Println(`{"typescript":{"src/main.ts":"export const value = 1;\\n"}}`); return }',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}
