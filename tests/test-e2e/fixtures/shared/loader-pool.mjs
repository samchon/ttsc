import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const [mode, root, metroUrl, loaderUrl] = process.argv.slice(2);
const pluginLockSession = createRequire(import.meta.url)(path.join(root, "plugin-lock-session.cjs"));
const project = path.join(root, "tsconfig.json");
const rootPaths = JSON.parse(fs.readFileSync(project, "utf8")).compilerOptions.paths;
const compilerOptions = { paths: Object.fromEntries(Object.entries(rootPaths).map(([key, targets]) => [key, targets.map((target) => path.resolve(root, target))])) };
let transformer, loader;
let outsideProgramObserved = false;
let metroConfiguration;
let adapterCalls = [];
let callbackObservation;
if (mode === "metro") {
  const require = createRequire(import.meta.url);
  const index = require(path.join(path.dirname(fileURLToPath(metroUrl)), "index.js"));
  const configured = index.withTtsc({ projectRoot: root, transformer: {} }, { project, compilerOptions, upstreamTransformer: path.join(root, "upstream.cjs") });
  transformer = require(configured.transformer.babelTransformerPath);
  const cacheKey = transformer.getCacheKey({ projectRoot: root });
  metroConfiguration = { transformerPath: configured.transformer.babelTransformerPath, cacheKey, withTtscType: typeof index.withTtsc, transformType: typeof transformer.transform, getCacheKeyType: typeof transformer.getCacheKey };
} else loader = (await import(loaderUrl)).default;
async function deliver(sourceSuffix = "", deliveredSource) {
  adapterCalls = [];
  callbackObservation = undefined;
  if (mode === "metro") {
    const filename = "src/bundle.ts";
    const primaryCall = { mode, pid: process.pid, filename, startedAt: new Date().toISOString(), finishedAt: undefined, outcome: "pending" };
    adapterCalls.push(primaryCall);
    let result;
    try {
      result = await transformer.transform({ src: (deliveredSource ?? fs.readFileSync(path.join(root, filename), "utf8")) + sourceSuffix, filename, options: { projectRoot: root, platform: "ios" }, plugins: ["authored-babel-plugin"] });
      primaryCall.outcome = "returned";
    } catch (error) { primaryCall.outcome = "threw"; throw error; }
    finally { primaryCall.finishedAt = new Date().toISOString(); }
    let outsideProgram;
    if (!outsideProgramObserved && !sourceSuffix && deliveredSource === undefined) {
      const outsideFilename = "passthrough/tool.ts";
      const outsideSource = fs.readFileSync(path.join(root, outsideFilename), "utf8");
      const outsideCall = { mode, pid: process.pid, filename: outsideFilename, startedAt: new Date().toISOString(), finishedAt: undefined, outcome: "pending" };
      adapterCalls.push(outsideCall);
      let outside;
      try {
        outside = await transformer.transform({ src: outsideSource, filename: outsideFilename, options: { projectRoot: root, platform: "ios" }, plugins: ["authored-babel-plugin"] });
        outsideCall.outcome = "returned";
      } catch (error) { outsideCall.outcome = "threw"; throw error; }
      finally { outsideCall.finishedAt = new Date().toISOString(); }
      outsideProgram = { filename: outside.ast.filename, source: outside.ast.source };
      outsideProgramObserved = true;
    }
    return { mode, adapterCalls, ast: result.ast, outsideProgram, metroConfiguration, requestedOptions: { project, compilerOptions } };
  }
  const resourcePath = path.join(root, "src/pool-routing/map.ts");
  const dependencies = [], contextDependencies = [], cacheability = [], errors = [];
  let completions = 0;
  callbackObservation = { dependencies, contextDependencies, cacheability, errors, completions };
  const loaderCall = { mode, pid: process.pid, filename: resourcePath, startedAt: new Date().toISOString(), finishedAt: undefined, outcome: "pending" };
  adapterCalls.push(loaderCall);
  const delivery = await new Promise((resolve, reject) => loader.call({
    rootContext: root, resourcePath, getOptions: () => ({ compilerOptions }),
    async: () => (error, content, map) => { completions += 1; callbackObservation.completions = completions; error ? reject(error) : resolve({ content, map }); },
    addDependency(file) { dependencies.push(file); },
    addContextDependency(directory) { contextDependencies.push(directory); },
    cacheable(value) { cacheability.push(value); },
    emitError(error) { errors.push(String(error)); },
  }, (deliveredSource ?? fs.readFileSync(resourcePath, "utf8")) + sourceSuffix))
    .then((value) => { loaderCall.outcome = "returned"; return value; }, (error) => { loaderCall.outcome = "threw"; throw error; })
    .finally(() => { loaderCall.finishedAt = new Date().toISOString(); });
  const observed = await import(`data:text/javascript;base64,${Buffer.from(delivery.content).toString("base64")}`);
  return { mode, adapterCalls, ...delivery, dependencies, contextDependencies, cacheability, errors, completions, value: observed.value, requestedOptions: { compilerOptions } };
}
// Bounded requests share these exact adapter/module/cache owners and session.
// A line is an observation/state transition, never another worker or fixture.
try { for await (const line of createInterface({ input: process.stdin })) {
  const command = JSON.parse(line);
  if (command.close) break;
  try {
    let value;
    if (command.pluginLock) value = pluginLockSession.operation(command.pluginLock);
    else if (command.descriptorFlow) {
      const scope = command.descriptorFlow.root;
      const { loadProjectPlugins } = createRequire(import.meta.url)(command.descriptorFlow.api);
      if (command.descriptorFlow.runtimeInputs) {
        const inputs = command.descriptorFlow.runtimeInputs;
        const loaded = loadProjectPlugins({ binary: "", cacheDir: inputs.cache, tsconfig: inputs.config,
          env: { ...process.env, TTSC_BINARY: command.descriptorFlow.binary, TTSC_TSGO_BINARY: command.descriptorFlow.tsgo, NODE_PATH: inputs.nodePath } });
        value = { hostInputs: loaded.hostInputs, hostInputHashes: loaded.hostInputHashes, hostInputRealpaths: loaded.hostInputRealpaths };
      } else {
      const cases = [
        ["factory", "factory.cts"], ["module", "module.cts"],
        ["counterfeit", "counterfeit.cts", true], ["counterfeit-missing", "counterfeit-missing.cts", true],
        ["mutated-missing", "mutated-missing.cts", true], ["late-candidate-race", "late-candidate-race.cts", true],
        ["directory-candidate-race", "directory-candidate-race.cts", true],
        ["context", "descriptor/context.ts"], ["body", "descriptor/body.ts"],
      ];
      const results = [];
      const previousMarker = process.env.TTSC_DESC_MARKER;
      process.env.TTSC_DESC_MARKER = "ambient";
      try {
        for (const [name, file, refuseFallback] of cases) {
          const tsconfig = path.join(scope, "tsconfig.json");
          fs.writeFileSync(tsconfig, JSON.stringify({ compilerOptions: { plugins: [{ transform: path.join(scope, file) }] } }));
          const env = { ...process.env, TTSC_BINARY: command.descriptorFlow.binary, TTSC_TSGO_BINARY: command.descriptorFlow.tsgo,
            TTSC_DESC_MARKER: name === "context" ? "context-only" : "effective",
            ...(refuseFallback ? { TTSC_TTSX_BINARY: path.join(scope, "trap.cjs") } : {}) };
          try { loadProjectPlugins({ binary: "", env, tsconfig }); results.push({ name, failed: false, message: "NO_ERROR" }); }
          catch (error) {
            const message = String(error?.message ?? error);
            results.push({ name, failed: true, message });
            process.stderr.write(name + ": " + message + "\n");
          }
        }
      } finally {
        if (previousMarker === undefined) delete process.env.TTSC_DESC_MARKER;
        else process.env.TTSC_DESC_MARKER = previousMarker;
      }
      if (command.descriptorFlow.lint) {
        const input = command.descriptorFlow.lint;
        const mod = createRequire(import.meta.url)(input.factory);
        const factory = mod.createTtscPlugin ?? mod.default ?? mod;
        const config = path.join(input.root, "lint.config.ts");
        const helper = path.join(input.root, "typed-selection.ts");
        const moduleHelper = path.join(input.root, "module-selection.mjs");
        const originalConfig = fs.readFileSync(config);
        const originalHelper = fs.readFileSync(helper);
        const originalModule = fs.readFileSync(moduleHelper);
        const previousEnv = { TTSC_TTSX_BINARY: process.env.TTSC_TTSX_BINARY, TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY };
        const context = (configFile) => ({ binary: "", cwd: input.root, projectRoot: input.root,
          pluginConfigDir: input.root, tsconfig: path.join(input.root, "tsconfig.json"),
          filename: input.factory, dirname: path.dirname(input.factory),
          plugin: { transform: "@ttsc/lint", configFile } });
        const observe = (name, configFile = "./lint.config.ts") => {
          try { results.push({ name, failed: false, contributors: factory(context(configFile)).contributors ?? [] }); }
          catch (error) { results.push({ name, failed: true, message: String(error?.message ?? error) }); }
        };
        try {
          process.env.TTSC_TTSX_BINARY = input.ttsx;
          process.env.TTSC_TSGO_BINARY = command.descriptorFlow.tsgo;
          observe("lint-initial");
          fs.writeFileSync(moduleHelper, `export default { beta: { source: ${JSON.stringify(input.beta)} } };\n`);
          observe("lint-module-edit");
          fs.writeFileSync(helper, `export default { beta: { source: ${JSON.stringify(input.beta)} } };\n`);
          observe("lint-typed-edit");
          fs.writeFileSync(config, `export default { plugins: { "react-hooks": { source: ${JSON.stringify(input.alpha)} }, react_hooks: { source: ${JSON.stringify(input.beta)} } } };\n`);
          observe("lint-typed-collision");
          fs.writeFileSync(config, 'declare const console: { log(value: string): void; error(value: string): void };\nconsole.log("failed config stdout");\nconsole.error("failed config stderr");\nthrow new Error("intentional config failure");\nexport {};\n');
          observe("lint-typed-failure");
          observe("lint-json-log", "./lint.config.json");
        } finally {
          fs.writeFileSync(config, originalConfig);
          fs.writeFileSync(helper, originalHelper);
          fs.writeFileSync(moduleHelper, originalModule);
          for (const [key, value] of Object.entries(previousEnv)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
          }
        }
      }
      value = results;
      }
    } else value = await deliver(command.sourceSuffix, command.deliveredSource);
    process.stdout.write(JSON.stringify({ id: command.id, value }) + "\n");
  }
  catch (error) { process.stdout.write(JSON.stringify({ id: command.id, error: error instanceof Error ? error.message : String(error), adapterCalls, callbackObservation }) + "\n"); }
}
} finally { pluginLockSession.close(); }
