"use strict";
const fs = require("node:fs");
const path = require("node:path");
// Installed once for this consumer. Mutable profiles change only after joins.
const root = process.cwd();
const profile = JSON.parse(fs.readFileSync(path.join(root, "provenance-profile.json"), "utf8"));
const args = process.argv.slice(2);
const phase = args.includes("--showConfig") ? "config" : args.includes("--listFilesOnly") ? "files" : "emit";
fs.appendFileSync(path.join(root, "provenance-invocations.jsonl"), JSON.stringify({ phase, args }) + "\n");
if (phase === "config") {
  process.stdout.write(JSON.stringify({ compilerOptions: { rootDir: "src", outDir: "dist", ...(profile.hasJsx ? { jsx: profile.jsx } : {}) } }));
} else if (phase === "files") {
  process.stdout.write(profile.files.join("\n") + "\n");
} else {
  const output = path.resolve(root, profile.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, "// actual fixture writer bytes\n");
  process.stdout.write(profile.files.join("\n") + "\nTSFILE: " + output + "\n");
  process.stderr.write("fixture diagnostic preserved");
  process.exitCode = 7;
}
