import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
const [mode, root, metroUrl, optionsUrl, loaderUrl] = process.argv.slice(2);
const project = path.join(root, "tsconfig.json");
let transformer, loader;
if (mode === "metro") {
  const options = await import(optionsUrl);
  process.env[options.ENV_KEY] = options.serializeOptions({ project, upstreamTransformer: path.join(root, "upstream.cjs") });
  transformer = await import(metroUrl);
} else loader = (await import(loaderUrl)).default;
async function deliver(sourceSuffix = "") {
  if (mode === "metro") {
    const filename = "src/bundle.ts";
    const result = await transformer.transform({ src: fs.readFileSync(path.join(root, filename), "utf8") + sourceSuffix, filename, options: { projectRoot: root, platform: "ios" }, plugins: ["authored-babel-plugin"] });
    return { mode, ast: result.ast };
  }
  const resourcePath = path.join(root, "src/map.ts");
  const dependencies = [], contextDependencies = [], cacheability = [], errors = [];
  let completions = 0;
  const delivery = await new Promise((resolve, reject) => loader.call({
    rootContext: root, resourcePath, getOptions: () => ({ project }),
    async: () => (error, content, map) => { completions += 1; error ? reject(error) : resolve({ content, map }); },
    addDependency(file) { dependencies.push(file); },
    addContextDependency(directory) { contextDependencies.push(directory); },
    cacheable(value) { cacheability.push(value); },
    emitError(error) { errors.push(String(error)); },
  }, fs.readFileSync(resourcePath, "utf8") + sourceSuffix));
  const observed = await import(`data:text/javascript;base64,${Buffer.from(delivery.content).toString("base64")}`);
  return { mode, ...delivery, dependencies, contextDependencies, cacheability, errors, completions, value: observed.value };
}
// Bounded requests share these exact adapter/module/cache owners and session.
// A line is an observation/state transition, never another worker or fixture.
for await (const line of createInterface({ input: process.stdin })) {
  const command = JSON.parse(line);
  if (command.close) break;
  try { process.stdout.write(JSON.stringify({ id: command.id, value: await deliver(command.sourceSuffix) }) + "\n"); }
  catch (error) { process.stdout.write(JSON.stringify({ id: command.id, error: error instanceof Error ? error.message : String(error) }) + "\n"); }
}
