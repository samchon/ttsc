declare const require: (id: string) => any;
declare const process: { env: Record<string, string | undefined> };
const fs = require("node:fs");
const path = require("node:path");
const value: string = require("banner-pkg").value;
const manifest = JSON.parse(
  fs.readFileSync(process.env.TTSX_RUNTIME_MANIFEST, "utf8"),
);
const files: string[] = fs.readdirSync(manifest.depCacheDir, {
  recursive: true,
});
const bannered = files
  .filter((file) => file.endsWith("index.js"))
  .some((file) =>
    fs
      .readFileSync(path.join(manifest.depCacheDir, file), "utf8")
      .includes("package root banner"),
  );
console.log(value + " bannered=" + bannered);
export {};
