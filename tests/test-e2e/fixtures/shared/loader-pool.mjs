import fs from "node:fs";
import path from "node:path";
const [mode, root, metroUrl, optionsUrl, loaderUrl] = process.argv.slice(2);
const project = path.join(root, "tsconfig.json");
if (mode === "metro") {
  const options = await import(optionsUrl);
  process.env[options.ENV_KEY] = options.serializeOptions({ project, upstreamTransformer: path.join(root, "upstream.cjs") });
  const transformer = await import(metroUrl);
  const filename = "src/bundle.ts";
  const result = await transformer.transform({ src: fs.readFileSync(path.join(root, filename), "utf8"), filename, options: { projectRoot: root, platform: "ios" }, plugins: ["authored-babel-plugin"] });
  process.stdout.write(JSON.stringify({ mode, ast: result.ast }));
} else {
  const loader = (await import(loaderUrl)).default;
  const resourcePath = path.join(root, "src/map.ts");
  const dependencies = [], cacheability = [], errors = [];
  let completions = 0;
  const delivery = await new Promise((resolve, reject) => loader.call({
    rootContext: root, resourcePath, getOptions: () => ({ project }),
    async: () => (error, content, map) => { completions += 1; error ? reject(error) : resolve({ content, map }); },
    addDependency(file) { dependencies.push(file); },
    cacheable(value) { cacheability.push(value); },
    emitError(error) { errors.push(String(error)); },
  }, fs.readFileSync(resourcePath, "utf8")));
  const observed = await import(`data:text/javascript;base64,${Buffer.from(delivery.content).toString("base64")}`);
  process.stdout.write(JSON.stringify({ mode, ...delivery, dependencies, cacheability, errors, completions, value: observed.value }));
}
