import fs from "node:fs";
import path from "node:path";
const [apiUrl, root, encodedOptions] = process.argv.slice(2);
const api = await import(apiUrl);
const file = path.join(root, "src/mod.ts");
const cache = api.createTtscTransformCache();
api.shareTtscTransformCache(cache, api.readTtscTransformSession());
try {
  const result = await api.transformTtsc(file, fs.readFileSync(file, "utf8"), api.resolveOptions(JSON.parse(encodedOptions)), undefined, cache);
  console.log(JSON.stringify({ code: result?.code ?? null }));
} catch (error) {
  console.log(JSON.stringify({ error: String(error?.stack ?? error) }));
} finally {
  api.resetTtscTransformCache(cache);
}
