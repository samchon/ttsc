const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Verifies the installed compiler preserves constructor environment layers
 * across actual source preparation, descriptor evaluation, compile and transform.
 *
 * The existing runtime actor, installed SDK, source graph and full native
 * composition serve these calls. Owned project-plugin mutations preserve normal
 * dependency discovery and restore the original config bytes. A wrapper
 * preserves the original descriptor factory after asserting the actual
 * evaluator's environment. Reporting fields select the declaration Program's
 * three authored sources. Source/tool/key
 * witnesses, rather than this fixture, decide whether a native artifact is reused.
 *
 * 1. Reject a lowercase missing Go tool and a mixed-case missing Node runtime.
 * 2. Prepare with captured constructor aliases and the existing physical cache.
 * 3. Compile and transform the authored factory source, preserving its neighbor.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual installed TtscCompiler.prepare must reject the selected missing Go/runtime on Windows, then a captured mixed-spelling context must reach the isolated descriptor and native compile/transform. Emitted factory input.value contrasts with retained input.value + 1 in source transformation and the neighboring emitted function; ambient entries and authored source bytes must remain unchanged.
 * @evidence contracts/testing.md#independent-expectations Native environment-name precedence supplies literal descriptor values and missing executable paths. The authored native factory fixture and compile-probe emit contract independently require the generated arrow to drop +1 while its neighbor and source-stage text retain it; no returned result supplies another call's expected output.
 * @evidence contracts/testing.md#distinguishing-cases Windows rejects contradictory inherited uppercase versus constructor lowercase Go and mixed runtime overrides, then valid constructor tools and the existing cache beat inherited missing tools and a distinct absent cache across prepare, compile and transform. The captured marker survives original-input mutation; POSIX instead requires both variable spellings to retain independent values. Direct cleanup units own undefined, blank, duplicate, independent-instance and protected user-cache distinctions.
 * @evidence contracts/testing.md#execution-ownership This static fixture is called by test_e2e_runtime_batch's existing runtime-declared-flow preload actor. Its body is excluded from Evidence declaration selection and is not separately addressable; the owning batch and Individual review cover its execution and assertions.
 * @evidence contracts/e2e.md#necessary-boundary Pure environment/cleanup units cannot prove that the installed API's isolated descriptor and selected native source pipeline receive the same constructor authority or preserve emit/source-stage meaning.
 * @evidence contracts/e2e.md#shared-execution The existing installed actor and complete original native composition serve two Windows negative prepares and one positive prepare/compile/transform. No actor, installation, Go source producer or direct build command is added; actual descriptor probes and compiler/native calls remain additional work, and real build-owner cache misses are not presumed away.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Relative constructor cache spelling resolves to the existing physical root, and the wrapped original factory returns the same native sources/stages/capabilities. Temporary owned project-plugin configuration preserves ordinary automatic dependency discovery and restores exact original bytes in finally. The product revalidates source/tool/environment witnesses. Actor-owned ambient test entries restore in finally; original constructor input is mutated only after capture. Actual native receipt boundaries separate these calls from the parent's unchanged original discovery oracle without deleting records. No shared cache is deleted or copied, and every independent API outcome is collected.
 * @evidence contracts/e2e.md#preserved-coverage Keeps the parent actor's existing recovery, declaration, native emission and register assertions. The new calls distinguish preparation/descriptor/native transport; detailed cache ownership and POSIX native-name decisions remain in direct cleanup/SidecarEnvironment units.
 */
module.exports = function apiEnvironmentLayers({ root, launcher, rootEntries, apiFailures }) {
  const { TtscCompiler } = require(path.join(launcher, "../TtscCompiler.js"));
  const { resolveGoCompiler } = require(path.join(launcher, "../plugin/internal/source/resolveGoCompiler.js"));
  const names = ["TTSC_GO_BINARY", "TTSC_NODE_BINARY", "TTSC_CACHE_DIR", "TTSC_E2E_API_LAYER"];
  const saved = new Map(names.map((name) => [name, process.env[name]]));
  const cache = process.env.TTSC_CACHE_DIR;
  assert.ok(path.isAbsolute(cache), "the shared actor must retain its actual prepared cache root");
  const go = resolveGoCompiler(process.env).binary;
  const node = process.execPath;
  const sourceFile = path.join(root, "src/runtime-corpus/native-factory.ts");
  const source = fs.readFileSync(sourceFile);
  const configFile = path.join(root, "runtime-declared.json");
  const configBytes = fs.readFileSync(configFile);
  const automaticFile = path.join(root, "packages/batch-auto-discovery/package.json");
  const automaticBytes = fs.readFileSync(automaticFile);
  const reportedFiles = [
    "src/runtime-corpus/native-factory.ts",
    "src/runtime-corpus/excluded-owner.ts",
    "src/runtime-corpus/declared-owned.cts",
  ];
  const reporting = {
    reportedFiles,
    reportedDependencies: [
      ...reportedFiles, configFile, path.join(root, "runtime-base.json"),
      path.join(root, "config/banner.config.json"), path.join(root, "config/strip.config.json"),
    ],
  };
  const entries = rootEntries.map((entry) => ({
    ...entry, ...(Object.hasOwn(entry, "reportedFiles") ? reporting : {}),
  }));
  const automaticManifest = JSON.parse(automaticBytes);
  Object.assign(automaticManifest.ttsc.plugin, reporting);
  const selectedAutomatic = Buffer.from(JSON.stringify(automaticManifest));
  let selectedConfig = configBytes;
  const selectPlugins = (plugins) => {
    const config = JSON.parse(configBytes);
    config.compilerOptions.plugins = plugins;
    selectedConfig = Buffer.from(JSON.stringify(config));
    fs.writeFileSync(configFile, selectedConfig);
  };
  const receipts = () => fs.readFileSync(path.join(root, "native-context.jsonl"), "utf8")
    .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const before = receipts().length;
  const automatic = (start) => {
    assert.deepEqual(receipts().slice(start).filter((entry) => entry.name === "native-auto-discovery"), [
      { name: "native-auto-discovery", operation: "identity", prefix: null, suffix: null },
    ], "each real API native dispatch must retain the ordinary automatic contributor");
  };
  const unselectedCache = path.join(root, "tools/api-unselected-cache");
  assert.equal(fs.existsSync(unselectedCache), false);
  const check = (name, operation) => {
    try { operation(); }
    catch (cause) { apiFailures.push(new Error("public API environment: " + name, { cause })); }
  };
  try {
    selectPlugins(entries);
    fs.writeFileSync(automaticFile, selectedAutomatic);
    process.env.TTSC_GO_BINARY = go;
    process.env.TTSC_NODE_BINARY = node;
    process.env.TTSC_E2E_API_LAYER = "ambient-layer";
    let ambient = names.map((name) => process.env[name]);
    const unchanged = () => {
      assert.deepEqual(names.map((name) => process.env[name]), ambient);
      assert.deepEqual(fs.readFileSync(sourceFile), source);
      assert.deepEqual(fs.readFileSync(configFile), selectedConfig);
      assert.deepEqual(fs.readFileSync(automaticFile), selectedAutomatic);
      assert.equal(fs.existsSync(unselectedCache), false, "the inherited unselected cache must stay absent");
    };
    if (process.platform === "win32") {
      const missingGo = path.join(root, "tools/api-missing-go.exe");
      const missingNode = path.join(root, "tools/api-missing-node.exe");
      assert.equal(fs.existsSync(missingGo), false);
      assert.equal(fs.existsSync(missingNode), false);
      check("lowercase Go override", () => {
        assert.throws(() => new TtscCompiler({
          cwd: root, tsconfig: "runtime-declared.json",
          env: { ttsc_go_binary: missingGo },
        }).prepare(), /api-missing-go/);
        unchanged();
      });
      check("mixed runtime override", () => {
        assert.throws(() => new TtscCompiler({
          cwd: root, tsconfig: "runtime-declared.json",
          env: { Ttsc_Node_Binary: missingNode },
        }).prepare(), /api-missing-node/);
        unchanged();
      });
      process.env.TTSC_GO_BINARY = missingGo;
      process.env.TTSC_NODE_BINARY = missingNode;
      process.env.TTSC_CACHE_DIR = unselectedCache;
      ambient = names.map((name) => process.env[name]);
    }
    const relativeCache = path.relative(root, cache);
    assert.ok(relativeCache.length > 0);
    assert.equal(path.resolve(root, relativeCache), path.resolve(cache));
    const env = {
      ttsc_go_binary: go,
      Ttsc_Node_Binary: node,
      ttsc_cache_dir: relativeCache,
      ttsc_e2e_api_layer: "constructor-layer",
    };
    const windows = process.platform === "win32";
    const probe = {
      TTSC_GO_BINARY: go,
      TTSC_NODE_BINARY: node,
      TTSC_CACHE_DIR: windows ? relativeCache : cache,
      TTSC_E2E_API_LAYER: windows ? "constructor-layer" : "ambient-layer",
      ...(windows ? {} : env),
    };
    let wrapped = 0;
    const plugins = entries.map((entry) => {
      if (entry.name !== "shared-real-program-probe") return entry;
      wrapped++;
      return {
        ...entry,
        transform: "./tools/api-env-descriptor.cjs",
        environmentProbe: probe,
        absentEnvironmentProbe: windows ? Object.keys(env) : [],
      };
    });
    assert.equal(wrapped, 1);
    selectPlugins(plugins);
    const compiler = new TtscCompiler({ cwd: root, tsconfig: "runtime-declared.json", env });
    env.ttsc_e2e_api_layer = "mutated-after-construction";
    check("prepare captured constructor layer", () => {
      const prepared = compiler.prepare();
      assert.ok(prepared.length > 0);
      for (const binary of prepared) assert.equal(fs.statSync(binary).isFile(), true);
      unchanged();
    });
    check("compile captured constructor layer", () => {
      const start = receipts().length;
      const result = compiler.compile();
      assert.equal(result.type, "success", JSON.stringify(result));
      const factory = Object.entries(result.output).find(([file]) => file.replaceAll("\\", "/").endsWith("/native-factory.js"))?.[1];
      assert.equal(typeof factory, "string");
      assert.match(factory, /__TTSC_NATIVE_FACTORY_ARROW__\s*=\s*\(?input\)?\s*=>\s*input\.value\s*;/);
      assert.match(factory, /unchanged\s*=\s*\(?input\)?\s*=>\s*input\.value\s*\+\s*1\s*;/);
      automatic(start);
      unchanged();
    });
    check("transform captured constructor layer", () => {
      const start = receipts().length;
      const result = compiler.transform();
      assert.equal(result.type, "success", JSON.stringify(result));
      const factory = Object.entries(result.typescript).find(([file]) => file.replaceAll("\\", "/").endsWith("/native-factory.ts"))?.[1];
      assert.equal(typeof factory, "string");
      assert.match(factory, /__TTSC_NATIVE_FACTORY_ARROW__[^;]*=>\s*input\.value\s*\+\s*1\s*;/);
      automatic(start);
      unchanged();
    });
  } finally {
    try {
      try { fs.writeFileSync(configFile, configBytes); }
      finally { fs.writeFileSync(automaticFile, automaticBytes); }
    }
    finally {
      for (const [name, value] of saved) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  }
  assert.deepEqual(fs.readFileSync(configFile), configBytes);
  assert.deepEqual(fs.readFileSync(automaticFile), automaticBytes);
  return { before, after: receipts().length };
};
