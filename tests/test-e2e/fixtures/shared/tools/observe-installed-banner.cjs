const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = (root) => {
  const expectedSource = fs.realpathSync.native(path.join(root, "node_modules/root-pkg/index.ts"));
  const manifest = JSON.parse(fs.readFileSync(process.env.TTSX_RUNTIME_MANIFEST, "utf8"));
  const outputs = new Set();
  for (const entry of fs.readdirSync(manifest.depCacheDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    let metadata;
    try { metadata = JSON.parse(fs.readFileSync(path.join(manifest.depCacheDir, entry.name), "utf8")); }
    catch { continue; }
    if (!metadata || typeof metadata !== "object" || !metadata.emittedSources || typeof metadata.emittedSources !== "object" || Array.isArray(metadata.emittedSources)) continue;
    for (const [output, sources] of Object.entries(metadata.emittedSources)) {
      if (!Array.isArray(sources) || sources.length !== 1 || typeof sources[0] !== "string" || !output.endsWith(".js")) continue;
      let actualSource;
      try { actualSource = fs.realpathSync.native(sources[0]); }
      catch { continue; }
      if (actualSource !== expectedSource) continue;
      const relative = path.relative(manifest.depCacheDir, output);
      assert.ok(relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative), "package output must remain inside the selected dependency cache");
      outputs.add(output);
    }
  }
  assert.equal(outputs.size, 1, "exactly one emitted JavaScript must own the independently resolved installed package index.ts: " + JSON.stringify([...outputs]));
  const text = fs.readFileSync([...outputs][0], "utf8");
  assert.equal(text.split("package root banner").length - 1, 1, "the installed dependency's own banner must appear exactly once");
};
