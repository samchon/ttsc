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
 *
 * A descriptor's initial input hash becomes stale if its own native process
 * writes that input. Reporting its path remains useful, but the API must remove
 * the old proof even when the check stage fails.
 *
 * 1. Hash old config bytes in a descriptor for each native stage.
 * 2. Run a Go fixture that writes new bytes before success or failure.
 * 3. Assert the path remains reported and neither result retains its old hash.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes native transform-success and check-failure fixtures that overwrite native.config.json; requires the observed input path, new disk bytes and no stale pre-execution hash in either result.
 * @evidence contracts/testing.md#independent-expectations The descriptor independently hashes old bytes and the authored Go process writes new bytes; retaining that old proof would certify an input state no longer present.
 * @evidence contracts/testing.md#distinguishing-cases Transform success and check failure both invalidate the same descriptor proof, distinguishing lost input identity from intentional removal of stale authority.
 * @evidence contracts/testing.md#execution-ownership The named API feature runs two real Go process stages through TtscCompiler.transform under TestExecutor.
 * @evidence contracts/e2e.md#necessary-boundary Actual native execution mutates a descriptor-observed file between initial hashing and result publication, a temporal boundary no immutable decoder fixture can reproduce.
 * @evidence contracts/e2e.md#shared-execution The two stage descriptors use identical Go source bytes and a shared keyed plugin cache; stage selection differs and genuinely requires separate execution, while each run supplies all mutation/proof assertions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each stage gets a fresh physical registered project and old config bytes, preventing the first mutation from setting the second expectation. Synchronous native execution completes before readback; fixture cleanup is suite-owned.
 * @evidence contracts/e2e.md#preserved-coverage Stage-specific result type, input-path presence, stale-hash absence and exact new bytes remain for both stages. The fixture exercises host proof invalidation, not arbitrary transform semantics.
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
