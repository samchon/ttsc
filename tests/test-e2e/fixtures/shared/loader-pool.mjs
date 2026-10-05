import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
const [mode, root, metroUrl, optionsUrl, loaderUrl] = process.argv.slice(2);
const project = path.join(root, "tsconfig.json");
const rootPaths = JSON.parse(fs.readFileSync(project, "utf8")).compilerOptions.paths;
const compilerOptions = { paths: Object.fromEntries(Object.entries(rootPaths).map(([key, targets]) => [key, targets.map((target) => path.resolve(root, target))])) };
let transformer, loader;
let outsideProgramObserved = false;
if (mode === "metro") {
  const options = await import(optionsUrl);
  process.env[options.ENV_KEY] = options.serializeOptions({ project, compilerOptions, upstreamTransformer: path.join(root, "upstream.cjs") });
  transformer = await import(metroUrl);
} else loader = (await import(loaderUrl)).default;
async function deliver(sourceSuffix = "", deliveredSource) {
  if (mode === "metro") {
    const filename = "src/bundle.ts";
    const result = await transformer.transform({ src: (deliveredSource ?? fs.readFileSync(path.join(root, filename), "utf8")) + sourceSuffix, filename, options: { projectRoot: root, platform: "ios" }, plugins: ["authored-babel-plugin"] });
    let outsideProgram;
    if (!outsideProgramObserved && !sourceSuffix && deliveredSource === undefined) {
      const outsideFilename = "passthrough/tool.ts";
      const outsideSource = fs.readFileSync(path.join(root, outsideFilename), "utf8");
      const outside = await transformer.transform({ src: outsideSource, filename: outsideFilename, options: { projectRoot: root, platform: "ios" }, plugins: ["authored-babel-plugin"] });
      outsideProgram = { filename: outside.ast.filename, source: outside.ast.source };
      outsideProgramObserved = true;
    }
    return { mode, ast: result.ast, outsideProgram, requestedOptions: { project, compilerOptions } };
  }
  const resourcePath = path.join(root, "src/pool-routing/map.ts");
  const dependencies = [], contextDependencies = [], cacheability = [], errors = [];
  let completions = 0;
  const delivery = await new Promise((resolve, reject) => loader.call({
    rootContext: root, resourcePath, getOptions: () => ({ compilerOptions }),
    async: () => (error, content, map) => { completions += 1; error ? reject(error) : resolve({ content, map }); },
    addDependency(file) { dependencies.push(file); },
    addContextDependency(directory) { contextDependencies.push(directory); },
    cacheable(value) { cacheability.push(value); },
    emitError(error) { errors.push(String(error)); },
  }, (deliveredSource ?? fs.readFileSync(resourcePath, "utf8")) + sourceSuffix));
  const observed = await import(`data:text/javascript;base64,${Buffer.from(delivery.content).toString("base64")}`);
  return { mode, ...delivery, dependencies, contextDependencies, cacheability, errors, completions, value: observed.value, requestedOptions: { compilerOptions } };
}
// Bounded requests share these exact adapter/module/cache owners and session.
// A line is an observation/state transition, never another worker or fixture.
for await (const line of createInterface({ input: process.stdin })) {
  const command = JSON.parse(line);
  if (command.close) break;
  try { process.stdout.write(JSON.stringify({ id: command.id, value: await deliver(command.sourceSuffix, command.deliveredSource) }) + "\n"); }
  catch (error) { process.stdout.write(JSON.stringify({ id: command.id, error: error instanceof Error ? error.message : String(error) }) + "\n"); }
}
