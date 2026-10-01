const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/**
 * Verifies actual compiler-emitted JSX renders through the authored runtime.
 *
 * Effective classic, development, namespace and automatic programs are
 * compiled once each. Equivalent policy requests share their immutable output;
 * every original request retains a labeled exact HTML assertion.
 *
 * 1. Require four complete records from the actual Go library unit process.
 * 2. Execute emitted output and the authored package modules in fresh VMs.
 * 3. Compare all eight request effects and reject incomplete transport.
 * @evidence contracts/testing.md#behavioral-verification The actual TestRuntimeJsxProfiles LoadProgram/EmitAllRaw output executes its real factory/automatic/development calls against the authored myjsx JavaScript modules. Every rendered view must equal the complete div hello and b world HTML, detecting mismatched JSX runtime imports or in-scope factory declarations.
 * @evidence contracts/testing.md#independent-expectations The original authored component and runtime specify literal <div>hello</div><b>world</b>; expected HTML is never obtained from compiler output. The VM loader evaluates those complete authored module sources rather than implementing a replacement render callback.
 * @evidence contracts/testing.md#distinguishing-cases Preserved classic and already-react share classic effective emission; development, namespace, factory plus import-source, namespace plus import-source and plain automatic and react-native each retain labeled assertions. The two import-source conflicts use the automatic canonical output only after exact runtime argument units prove clearing the conflicting declarations. Malformed, truncated, duplicate or missing records fail closed. Actual root response transport and native loading remain E2E owners.
 * @evidence contracts/testing.md#execution-ownership This named unit is called in the existing test-go-driver Node process with one captured real Go unit event stream. It builds no product/contributor binary and installs or launches no consumer. Four actual compiler programs share one authored input workspace in one Go process; the VM contexts/module caches are fresh per request and support only these authored fixture modules, not product resolution or bootstrap.
 */
function test_runtime_compiler_output_renders_jsx_profiles(result) {
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const records = decode(result.stdout);
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "../../internal/runtime-jsx-fixture.json"), "utf8"));
  const failures = [];
  for (const [name, profile] of requests) {
    try {
      const files = { ...fixture.files, "view.js": records.get(profile) };
      const cache = new Map();
      const context = vm.createContext({});
      const load = (file) => {
        if (cache.has(file)) return cache.get(file).exports;
        assert.equal(typeof files[file], "string", "unknown authored fixture module: " + file);
        const module = { exports: {} };
        cache.set(file, module);
        const execute = vm.compileFunction(files[file], ["exports", "require", "module"], { parsingContext: context, filename: file });
        const requireFixture = (specifier) => {
          let target;
          if (specifier.startsWith(".")) target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
          else {
            const manifest = JSON.parse(fixture.files["node_modules/myjsx/package.json"]);
            const subpath = specifier === "myjsx" ? "." : specifier.startsWith("myjsx/") ? "./" + specifier.slice(6) : undefined;
            assert.ok(subpath && manifest.exports[subpath], "unexpected fixture import: " + specifier);
            target = path.posix.join("node_modules/myjsx", manifest.exports[subpath].default);
          }
          return load(target);
        };
        execute(module.exports, requireFixture, module);
        return module.exports;
      };
      context.execute = () => load("view.js");
      const view = vm.runInContext("execute().view", context, { timeout: 1000 });
      assert.equal(view, fixture.expected, name);
    } catch (error) { failures.push(error); }
  }
  const event = (Output) => JSON.stringify({ Action: "output", Package: packageName, Test: "TestRuntimeJsxProfiles/classic", Output }) + "\n";
  for (const [name, stream] of [["truncated event", result.stdout.trimEnd()], ["missing", event("Go output\n")], ["malformed event", "{\n"], ["malformed record", event(prefix + "{\n")], ["truncated record", event(prefix + "{}")], ["duplicate", result.stdout + event(prefix + JSON.stringify({ name: "classic", javascript: "x" }) + "\n")]]) {
    try { assert.throws(() => decode(stream), undefined, name); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "actual compiler JSX VM unit failed");
}
const prefix = "TTSC_JSX_EMIT_V1:";
const packageName = "github.com/samchon/ttsc/packages/ttsc/test/driver-unit";
const profiles = ["classic", "development", "namespace", "automatic"];
const requests = [["classic-preserved", "classic"], ["react", "classic"], ["development", "development"], ["namespace", "namespace"], ["factory-import", "automatic"], ["namespace-import", "automatic"], ["automatic", "automatic"], ["react-native", "automatic"]];
function decode(stream) {
  assert.equal(typeof stream, "string");
  assert.ok(stream.endsWith("\n"), "truncated Go event stream");
  let output = "";
  for (const line of stream.trimEnd().split(/\r?\n/)) {
    const event = JSON.parse(line);
    assert.equal(typeof event.Action, "string");
    if (event.Action !== "output") continue;
    assert.equal(typeof event.Output, "string");
    if (event.Package === packageName && event.Test?.startsWith("TestRuntimeJsxProfiles/")) output += event.Output;
    else assert.ok(!event.Output.includes(prefix), "record outside owning Go test");
  }
  assert.ok(output.endsWith("\n"), "truncated Go output");
  const records = new Map();
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith(prefix)) continue;
    const record = JSON.parse(line.slice(prefix.length));
    assert.ok(profiles.includes(record.name), "unknown JSX fixture");
    assert.equal(typeof record.javascript, "string");
    assert.ok(record.javascript.length > 0, "empty emitted program");
    assert.ok(!records.has(record.name), "duplicate JSX fixture");
    records.set(record.name, record.javascript);
  }
  assert.equal(records.size, profiles.length, "missing JSX fixture");
  return records;
}
module.exports = { test_runtime_compiler_output_renders_jsx_profiles };
