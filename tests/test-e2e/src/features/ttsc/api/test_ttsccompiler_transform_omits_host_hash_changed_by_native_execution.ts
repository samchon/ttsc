import { TestProject } from "@ttsc/testing";

import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeBasicProject,
} from "../../../internal/ttsc/internal/compiler";

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
 * @evidence contracts/testing.md#execution-ownership The named feature calls checkout built TtscCompiler through the shared subclass and selected compiler; real Go inputs mutate the file in distinct transform/check stages. Returned envelopes and readback observe that connection, not packed installation or every native child.
 * @evidence contracts/e2e.md#necessary-boundary Actual native execution mutates a descriptor-observed file between initial hashing and result publication, a temporal boundary no immutable decoder fixture can reproduce.
 * @evidence contracts/e2e.md#shared-execution Standalone stages own separate projects. Consolidated stages borrow one empty physical API root, write identical default source/config/package and Go module bytes, and differ in descriptor stage. After the first returned API result, its files move into an observed sibling before the second receives old config bytes again. Both original native calls and mutation/proof assertions remain, with distinct content-key and process events rather than inferred cache hits or Program reuse.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Standalone stages remain freshly registered. Borrowed stages require an empty root and exact old config bytes. A returned API result admits holding the prior inputs aside even if an assertion failed, so the second independent verdict remains observable; a thrown preparation/transport blocks replacement and is retained under the second stage's name. The outer owner retains all borrowed inputs. Synchronous return is an admission bound, not arbitrary descendant closure or interruption cleanup certification.
 * @evidence contracts/e2e.md#preserved-coverage Stage-specific result type, input-path presence, stale-hash absence and exact new bytes remain for both stages. The fixture exercises host proof invalidation, not arbitrary transform semantics.
 */
export const test_ttsccompiler_transform_omits_host_hash_changed_by_native_execution =
  (prepared?: { root: string; observedRoot: string }) => {
    const failures: unknown[] = [];
    let previousReturned = true;
    for (const stage of ["transform", "check"] as const) {
      let returned = false;
      try {
        if (prepared !== undefined && !previousReturned)
          throw new Error(`${stage} input staging blocked by unsettled prior API transport`);
        if (prepared !== undefined && stage === "check") {
          const observed = path.join(prepared.observedRoot, "transform");
          fs.mkdirSync(observed, { recursive: true });
          for (const name of fs.readdirSync(prepared.root))
            fs.renameSync(path.join(prepared.root, name), path.join(observed, name));
        }
        const root = TestProject.physicalPath(prepared?.root ??
          createProject({
            plugins: [{ transform: "./plugin.cjs" }],
          }),
        );
        if (prepared !== undefined) {
          assert.deepEqual(fs.readdirSync(root), [], "borrowed host-proof project must be empty");
          writeBasicProject(root, 'const message: string = "api-ok";\nconsole.log(message);\n', {
            plugins: [{ transform: "./plugin.cjs" }],
          });
          fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ private: true }), "utf8");
        }
        const config = path.join(root, "native.config.json");
        fs.writeFileSync(config, "old\n", "utf8");
        writeMutatingPlugin(root, stage);

        const result = new TtscCompiler({ binary: tsgo, cwd: root }).transform();
        returned = true;

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
      } catch (error) {
        failures.push(
          new Error(`${stage} host proof invalidation failed`, { cause: error }),
        );
      } finally {
        previousReturned = returned;
      }
    }
    if (failures.length > 0)
      throw new AggregateError(
        failures,
        "Native host proof invalidation stages failed",
      );
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
