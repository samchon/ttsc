import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const version = process.argv[2];
if (
  process.argv.length !== 3 ||
  !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-next\.(?:0|[1-9]\d*)$/.test(
    version,
  )
)
  throw new Error("Usage: pnpm release:next <major.minor.patch-next.number>");

const run = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})`);
  return result.stdout.trim();
};

if (run("git", ["branch", "--show-current"]) !== "master")
  throw new Error("Next releases must start from master.");
if (run("git", ["status", "--porcelain"]))
  throw new Error("Next releases require a clean worktree.");

run("git", ["fetch", "origin", "master", "--tags"]);
if (
  run("git", ["rev-parse", "HEAD"]) !==
  run("git", ["rev-parse", "origin/master"])
)
  throw new Error(
    "Master must match origin/master before preparing a next release.",
  );

const tag = `v${version}`;
const existingTag = spawnSync(
  "git",
  ["rev-parse", "-q", "--verify", `refs/tags/${tag}`],
  {
    stdio: "ignore",
    windowsHide: true,
  },
);
if (existingTag.error) throw existingTag.error;
if (existingTag.status === 0)
  throw new Error(`Release tag ${tag} already exists.`);
if (existingTag.status !== 1)
  throw new Error("Could not check the release tag.");

const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run this script through pnpm release:next.");
run(process.execPath, [
  pnpm,
  "exec",
  "bumpp",
  version,
  "--recursive",
  "--yes",
  "--no-push",
  "--commit",
  "chore(release): prepare v%s",
  "--tag",
  "v%s",
]);

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
if (
  run("git", ["rev-parse", `${tag}^{commit}`]) !==
  run("git", ["rev-parse", "HEAD"])
)
  throw new Error(`${tag} does not point to the prepared release commit.`);
if (run("git", ["status", "--porcelain"]))
  throw new Error("The version tool left uncommitted files.");

// Publish only this commit and its tag; bumpp's default push sends all local tags.
run("git", [
  "push",
  "--atomic",
  "origin",
  "HEAD:refs/heads/master",
  `refs/tags/${tag}:refs/tags/${tag}`,
]);
console.log(
  `Prepared ${tag}; release.yml will publish it with the next npm tag.`,
);
