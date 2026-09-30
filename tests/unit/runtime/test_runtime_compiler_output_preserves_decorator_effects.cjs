const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const util = require("node:util");
const vm = require("node:vm");

/**
 * Verifies actual Go library output preserves decorator effects in a Node VM.
 *
 * Compiler output arrives from the same standard Go unit process, not a
 * product binary or generated snapshot. The wrapper has ordinary CommonJS
 * bindings and an isolated console; real CLI/loading assembly stays in E2E.
 *
 * 1. Decode the completed Go test event stream and require all six outputs.
 * 2. Execute each actual output and assert the authored decorator literals.
 * 3. Reject malformed, truncated, duplicate and missing protocol records.
 * @evidence contracts/testing.md#behavioral-verification The same real LoadProgram/EmitAllRaw output selected by TestRuntimeDecoratorTargetProfiles executes in vm.compileFunction. Complete class replacement/method/optional syntax output and the separate legacy Foo effect are compared, detecting incorrect lowering even when emitted helper names look correct.
 * @evidence contracts/testing.md#independent-expectations The authored standard decorator source logs class construction, method wrapping and abc in that order; the shared fixture literal records those independently specified effects. Optional syntax remains at modern/default targets and lowers at ES2019. Legacy logs Foo. Protocol negative controls are deliberately malformed transport inputs, not successful compiler substitutes.
 * @evidence contracts/testing.md#distinguishing-cases Six target/CLI-overlay/legacy profiles retain separate labels and exact output expectations. Malformed JSON, truncated lines, missing population, duplicates and unavailable producer results fail closed. VM exceptions are collected across all profiles. CommonJS pure execution is observed; native ESM bootstrap and registration remain E2E owners.
 * @evidence contracts/testing.md#execution-ownership This named unit is invoked directly by test-go-driver.cjs with the captured completed real Go test stdout. It starts no process and builds or installs no product artifact; one normal Go unit harness owns compilation. Each profile gets a fresh VM context and module object, and no external require capability. The checker must select this CJS entry explicitly; it is not a separately discovered source-unit host.
 */
function test_runtime_compiler_output_preserves_decorator_effects(result) {
  validateProducer(result);
  const records = decode(result.stdout);
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "../../test-ttsc/src/internal/runtime-decorator-fixture.json"), "utf8"));
  const failures = [];
  for (const [name, optional] of profiles) {
    try {
      const lines = [];
      const context = vm.createContext({ console: { log: (...args) => lines.push(util.format(...args)) } });
      const execute = vm.compileFunction(records.get(name), ["exports", "require", "module", "__filename", "__dirname"], { parsingContext: context, filename: name + ".js" });
      const module = { exports: {} };
      context.execute = () => execute(module.exports, (specifier) => { throw new Error("unexpected dependency: " + specifier); }, module, name + ".js", "/unit");
      vm.runInContext("execute()", context, { timeout: 1000 });
      assert.equal(lines.join("\n"), name === "legacy-esnext" ? "Foo" : fixture.expected + "\n" + optional, name);
    } catch (error) { failures.push(error); }
  }
  const outputEvent = (text) => JSON.stringify({ Action: "output", Package: "github.com/samchon/ttsc/packages/ttsc/test/driver-unit", Test: "TestRuntimeDecoratorTargetProfiles/default", Output: text }) + "\n";
  try { assert.throws(() => validateProducer({ ...result, status: 1 })); assert.throws(() => validateProducer({ ...result, error: new Error("producer unavailable") })); } catch (error) { failures.push(error); }
  for (const [name, stream] of [
    ["malformed event", "{\n"],
    ["truncated event", result.stdout.trimEnd()],
    ["missing fixture", outputEvent("ordinary Go output\n")],
    ["malformed record", outputEvent(prefix + "{\n")],
    ["truncated record", outputEvent(prefix + '{}')],
    ["duplicate fixture", result.stdout + outputEvent(prefix + JSON.stringify({ name: "default", javascript: "x" }) + "\n")],
  ]) {
    try { assert.throws(() => decode(stream), undefined, name); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "actual compiler VM unit failed");
}

const prefix = "TTSC_RUNTIME_EMIT_V1:";
const profiles = [["default", true], ["es2025", true], ["es2019", false], ["cli-es2019", false], ["cli-null", true], ["legacy-esnext", true]];
function decode(stream) {
  assert.equal(typeof stream, "string");
  assert.ok(stream.endsWith("\n"), "truncated Go event stream");
  let output = "";
  for (const line of stream.trimEnd().split(/\r?\n/)) {
    const event = JSON.parse(line);
    assert.equal(typeof event.Action, "string", "invalid Go test event");
    if (event.Action === "output") {
      assert.equal(typeof event.Output, "string");
      if (event.Package === "github.com/samchon/ttsc/packages/ttsc/test/driver-unit" && event.Test?.startsWith("TestRuntimeDecoratorTargetProfiles/")) output += event.Output;
      else assert.ok(!event.Output.includes(prefix), "record outside its owning Go test");
    }
  }
  assert.ok(output.endsWith("\n"), "truncated Go output");
  const records = new Map();
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith(prefix)) continue;
    const record = JSON.parse(line.slice(prefix.length));
    assert.ok(profiles.some(([name]) => name === record.name), "unknown fixture");
    assert.equal(typeof record.javascript, "string");
    assert.ok(record.javascript.length > 0, "empty emitted program");
    assert.ok(!records.has(record.name), "duplicate fixture");
    records.set(record.name, record.javascript);
  }
  assert.equal(records.size, profiles.length, "missing emitted fixture");
  return records;
}
function validateProducer(result) {
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
}
module.exports = { test_runtime_compiler_output_preserves_decorator_effects };
