declare const require: (id: string) => any;
declare const process: { env: Record<string, string | undefined>; cwd(): string };
const fs = require("node:fs");
const path = require("node:path");
const value: string = require("banner-pkg").value;
const manifest = JSON.parse(
  fs.readFileSync(process.env.TTSX_RUNTIME_MANIFEST, "utf8"),
);
const expectedSource = fs.realpathSync.native(
  path.join(process.cwd(), "node_modules", "banner-pkg", "index.ts"),
);
const outputs = new Set<string>();
for (const entry of fs.readdirSync(manifest.depCacheDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  let metadata: any;
  try { metadata = JSON.parse(fs.readFileSync(path.join(manifest.depCacheDir, entry.name), "utf8")); }
  catch { continue; } // Unreadable metadata cannot contribute a matching output.
  if (!metadata || typeof metadata !== "object" || !metadata.emittedSources ||
    typeof metadata.emittedSources !== "object" || Array.isArray(metadata.emittedSources)) continue;
  for (const [output, sources] of Object.entries(metadata.emittedSources)) {
    if (!Array.isArray(sources) || sources.length !== 1 || typeof sources[0] !== "string" ||
      !output.endsWith(".js")) continue;
    let actualSource: string;
    try { actualSource = fs.realpathSync.native(sources[0]); }
    catch { continue; } // Missing source ownership never satisfies the positive oracle.
    if (actualSource !== expectedSource) continue;
    const relative = path.relative(manifest.depCacheDir, output);
    if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative))
      throw new Error("Package output is outside the selected dependency cache");
    outputs.add(output);
  }
}
const bannered = outputs.size === 1 && fs.readFileSync([...outputs][0], "utf8")
  .includes("package root banner");
console.log(value + " bannered=" + bannered);
export {};
