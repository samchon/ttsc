import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const [mode, root, metroUrl, loaderUrl] = process.argv.slice(2);
const project = path.join(root, "tsconfig.json");
const rootPaths = JSON.parse(fs.readFileSync(project, "utf8")).compilerOptions.paths;
const compilerOptions = { paths: Object.fromEntries(Object.entries(rootPaths).map(([key, targets]) => [key, targets.map((target) => path.resolve(root, target))])) };
let transformer, loader;
let outsideProgramObserved = false;
let metroConfiguration;
let adapterCalls = [];
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
  const loaderCall = { mode, pid: process.pid, filename: resourcePath, startedAt: new Date().toISOString(), finishedAt: undefined, outcome: "pending" };
  adapterCalls.push(loaderCall);
  const delivery = await new Promise((resolve, reject) => loader.call({
    rootContext: root, resourcePath, getOptions: () => ({ compilerOptions }),
    async: () => (error, content, map) => { completions += 1; error ? reject(error) : resolve({ content, map }); },
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
for await (const line of createInterface({ input: process.stdin })) {
  const command = JSON.parse(line);
  if (command.close) break;
  try { process.stdout.write(JSON.stringify({ id: command.id, value: await deliver(command.sourceSuffix, command.deliveredSource) }) + "\n"); }
  catch (error) { process.stdout.write(JSON.stringify({ id: command.id, error: error instanceof Error ? error.message : String(error), adapterCalls }) + "\n"); }
}
