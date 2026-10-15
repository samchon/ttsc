const fs = require("node:fs");
const path = require("node:path");

const tag = process.env.GITHUB_REF_NAME;
const stable = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const next =
  /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-next\.(?:0|[1-9]\d*)$/;
const channel = stable.test(tag) ? "latest" : next.test(tag) ? "next" : null;
if (!channel || process.env.GITHUB_REF !== `refs/tags/${tag}`)
  throw new Error(`Unsupported release tag: ${tag}`);

const version = tag.slice(1);
const manifests = [
  "package.json",
  "config/package.json",
  "website/package.json",
];
for (const group of ["benchmarks", "packages", "tests"])
  for (const directory of fs.readdirSync(group)) {
    const file = path.join(group, directory, "package.json");
    if (fs.existsSync(file)) manifests.push(file);
  }
manifests.push("packages/lint/test/lint-contributor-demo/package.json");
for (const file of manifests) {
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (manifest.version !== version)
    throw new Error(`${file}: expected ${version}, got ${manifest.version}`);
}
fs.appendFileSync(process.env.GITHUB_OUTPUT, `value=${channel}\n`);
console.log(
  `Publishing ${manifests.length} workspace versions as ${channel}: ${tag}`,
);
