const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..", "..");

test("unplugin scenarios follow the repository test layout", () => {
  const packageRoot = path.join(root, "tests", "test-unplugin");
  const source = path.join(packageRoot, "src");
  const runner = fs.readFileSync(path.join(source, "index.ts"), "utf8");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  );
  // One scenario per file, discovered by the shared runner: `features` needs
  // neither a Go host nor a bundler process, `native-plugins` does. The split
  // is pinned per tree because a scenario moved across it changes which CI
  // lane runs it.
  const trees = { features: 19, "native-plugins": 197 };
  const scenarios = [];
  for (const [tree, count] of Object.entries(trees)) {
    const names = collectFiles(path.join(source, tree)).map((file) => {
      const relative = path.relative(packageRoot, file);
      const name = path.basename(file, ".ts");
      const text = fs.readFileSync(file, "utf8");
      assert.ok(
        file.endsWith(".ts"),
        `${relative} must be a TypeScript scenario`,
      );
      assert.match(name, /^test_[a-z0-9_]+$/);
      assert.deepEqual(
        [...text.matchAll(/^export\b.*$/gm)].map((match) => match[0]),
        [`export async function ${name}(): Promise<void> {`],
        `${relative} must export exactly the one async test its file is named after`,
      );
      assertScenarioDoc(relative, text, name);
      return name;
    });
    assert.equal(
      names.length,
      count,
      `the ${tree} inventory must stay explicit`,
    );
    scenarios.push(...names);
  }
  assert.equal(new Set(scenarios).size, scenarios.length);
  // A scenario outside the discovered trees would never run.
  const strays = collectFiles(source).filter(
    (file) =>
      !Object.keys(trees).some((tree) =>
        file.startsWith(path.join(source, tree) + path.sep),
      ) &&
      /^export\s+(?:async\s+function|const)\s+test_/m.test(
        fs.readFileSync(file, "utf8"),
      ),
  );
  assert.deepEqual(strays, [], "every scenario must live in a discovered tree");
  assert.match(runner, /TestExecutor\.main\(/);
  assert.match(runner, /TTSC_TEST_DIRS/);
  assert.deepEqual(Object.keys(manifest.scripts), ["start"]);
  const leftovers = collectFiles(source).filter((file) =>
    /\bcase_[a-z0-9_]+/.test(fs.readFileSync(file, "utf8")),
  );
  assert.deepEqual(
    leftovers,
    [],
    "no scenario may keep the retired case_ prefix",
  );
});

test("the packed adapter rehearsal is one pinned E2E", () => {
  const workspaceManifest = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  assert.equal(
    workspaceManifest.scripts.experimental,
    "pnpm package:tgz -- --current && pnpm --dir experimental/install start -- --skip-pack && pnpm --dir experimental/test-unplugin start -- --skip-pack",
    "the aggregate must prepare one fresh current-platform tarball set and let both consumers reuse it",
  );
  const source = fs.readFileSync(
    path.join(root, "experimental", "test-unplugin", "src", "index.ts"),
    "utf8",
  );
  const genericSource = fs.readFileSync(
    path.join(root, "experimental", "install", "src", "index.ts"),
    "utf8",
  );
  assert.equal(
    (source.match(/export function test_[a-z0-9_]+/g) ?? []).length,
    1,
    "the packed package must have one E2E entrypoint",
  );
  const dependencies = /const registryDependencies = \[([\s\S]*?)\n\];/.exec(
    source,
  );
  assert.ok(dependencies);
  const specifications = [...dependencies[1].matchAll(/"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(specifications.length > 0);
  for (const specification of specifications) {
    const version = specification.slice(specification.lastIndexOf("@") + 1);
    assert.match(
      version,
      /^\d+\.\d+\.\d+$/,
      `registry dependency must be pinned: ${specification}`,
    );
  }
  assert.equal(
    (source.match(/\binstallTarballs\(\);/g) ?? []).length,
    1,
    "the packed unplugin E2E must invoke its dependency install exactly once",
  );
  assert.equal(
    (genericSource.match(/\binstallTarballs\(\);/g) ?? []).length,
    1,
    "the generic packed-package rehearsal must invoke its dependency install exactly once",
  );
  assert.equal(
    packageManagerInstallCommands(source).length,
    1,
    "the packed unplugin E2E must contain exactly one package-manager install command",
  );
  assert.equal(
    packageManagerInstallCommands(genericSource).length,
    1,
    "the generic packed-package rehearsal must contain exactly one package-manager install command",
  );
  const workflow = fs.readFileSync(
    path.join(root, ".github", "workflows", "test.yml"),
    "utf8",
  );
  assert.match(
    workflow,
    /bun-version: \d+\.\d+\.\d+/,
    "the Bun runtime exercised by the packed E2E must be pinned",
  );
  assert.doesNotMatch(workflow, /bun-version: latest/);
});

test("native fixtures publish one immutable content-addressed source identity", () => {
  const defaultFixture = fs.readFileSync(
    path.join(
      root,
      "tests",
      "utils",
      "src",
      "unplugin",
      "TestUnpluginProject.ts",
    ),
    "utf8",
  );
  const publisher = fs.readFileSync(
    path.join(
      root,
      "tests",
      "utils",
      "src",
      "unplugin",
      "materializeSharedSource.ts",
    ),
    "utf8",
  );
  const suite = readTree(path.join(root, "tests", "test-unplugin", "src"));
  assert.match(defaultFixture, /return publishSharedSource\(/);
  assert.match(publisher, /crypto\.createHash\("sha256"\)/);
  assert.match(publisher, /fs\.mkdtempSync/);
  assert.match(publisher, /fs\.renameSync\(staging, destination\)/);
  assert.match(publisher, /String\(bytes\.byteLength\)/);
  assert.match(
    defaultFixture,
    /materializeSharedSource\(\s*"default-go-plugin",\s*writeGoPlugin/,
  );
  assert.match(
    suite,
    /materializeSharedSource\(\s*"cache-go-plugin",\s*writeGoPlugin/,
  );
  assert.match(suite, /isolatedPluginSource: true/g);
  assert.equal(
    (suite.match(/isolatedPluginSource: true/g) ?? []).length,
    2,
    "only descriptor-mutation scenarios may fork the cache plugin source",
  );
  assert.match(
    suite,
    /materializeSharedSource\(\s*"real-native-envelope-module"/,
  );
  assert.match(
    suite,
    /path\.join\(moduleRoot, "go\.mod"\)/,
    "the published fixture must own the contributor's Go module",
  );
  assert.match(
    suite,
    /const contributor = path\.join\(moduleRoot, "compile-probe"\)/,
    "the linked contributor must remain below the published Go module",
  );
  assert.match(suite, /path\.join\(contributor, "probe\.go"\)/);
  assert.match(suite, /source: \$\{JSON\.stringify\(contributorRoot\)\}/);
});

test("shared native fixture publication is content-addressed and atomic", async (context) => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-unplugin-publisher-contract-"),
  );
  context.after(() => {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  });
  const parent = path.join(temporaryRoot, "cache");
  const helper = path.join(
    root,
    "tests",
    "utils",
    "src",
    "unplugin",
    "materializeSharedSource.ts",
  );
  const { materializeSharedSource } = await import(pathToFileURL(helper).href);
  const writeTree = (files) => (directory) => {
    for (const [relative, contents] of Object.entries(files)) {
      const target = path.join(directory, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents);
    }
  };

  const sameFiles = {
    "go.mod": "module example.com/same\n",
    "src/main.go": "package main\n",
  };
  const sameFirst = materializeSharedSource(
    parent,
    "same-content",
    writeTree(sameFiles),
  );
  const sameSecond = materializeSharedSource(
    parent,
    "same-content",
    writeTree(sameFiles),
  );
  assert.equal(sameSecond, sameFirst);

  const framedFirst = materializeSharedSource(
    parent,
    "framed-content",
    writeTree({ a: Buffer.from("x\0file\0b\0y") }),
  );
  const framedSecond = materializeSharedSource(
    parent,
    "framed-content",
    writeTree({ a: "x", b: "y" }),
  );
  assert.notEqual(
    framedSecond,
    framedFirst,
    "file boundaries and content lengths must participate in the digest",
  );

  const stale = materializeSharedSource(
    parent,
    "stale-content",
    writeTree({ "main.go": "package main\n" }),
  );
  fs.writeFileSync(path.join(stale, "main.go"), "package stale\n", "utf8");
  assert.throws(
    () =>
      materializeSharedSource(
        parent,
        "stale-content",
        writeTree({ "main.go": "package main\n" }),
      ),
    "a corrupted destination must never stand in for the requested content",
  );
  assert.deepEqual(hiddenStagingEntries(parent, "stale-content"), []);

  const synchronization = path.join(temporaryRoot, "synchronization");
  const ready = path.join(synchronization, "ready");
  const release = path.join(synchronization, "release");
  fs.mkdirSync(ready, { recursive: true });
  const concurrentFiles = {
    "go.mod": "module example.com/concurrent\n",
    "nested/probe.go": "package probe\n",
  };
  const publishers = [
    spawnPublisher({
      files: concurrentFiles,
      helper,
      label: "concurrent-content",
      parent,
      ready,
      release,
    }),
    spawnPublisher({
      files: concurrentFiles,
      helper,
      label: "concurrent-content",
      parent,
      ready,
      release,
    }),
  ];
  context.after(() => {
    for (const publisher of publishers) publisher.child.kill();
  });
  await waitFor(() => fs.readdirSync(ready).length === 2);
  assert.equal(
    fs
      .readdirSync(parent)
      .some((entry) => entry.startsWith("concurrent-content-")),
    false,
    "the destination must stay invisible until the complete fixture is published",
  );
  assert.equal(hiddenStagingEntries(parent, "concurrent-content").length, 2);
  fs.writeFileSync(release, "release", "utf8");
  const [concurrentFirst, concurrentSecond] = await Promise.all(
    publishers.map((publisher) => publisher.completed),
  );
  assert.equal(concurrentSecond, concurrentFirst);
  assert.deepEqual(hiddenStagingEntries(parent, "concurrent-content"), []);
  assert.equal(
    fs.readFileSync(path.join(concurrentFirst, "nested", "probe.go"), "utf8"),
    "package probe\n",
  );
});

const PUBLISHER_SOURCE = String.raw`
import fs from "node:fs";
import path from "node:path";

const { materializeSharedSource } = await import(process.env.TTSC_FIXTURE_HELPER);
const files = JSON.parse(Buffer.from(process.env.TTSC_FIXTURE_FILES, "base64").toString("utf8"));
const result = materializeSharedSource(
  process.env.TTSC_FIXTURE_PARENT,
  process.env.TTSC_FIXTURE_LABEL,
  (directory) => {
    for (const [relative, encoded] of Object.entries(files)) {
      const target = path.resolve(directory, relative);
      if (target !== directory && !target.startsWith(directory + path.sep)) {
        throw new Error("fixture path escaped staging directory");
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(encoded, "base64"));
    }
    fs.writeFileSync(path.join(process.env.TTSC_FIXTURE_READY, String(process.pid)), "ready", "utf8");
    const lock = new Int32Array(new SharedArrayBuffer(4));
    while (!fs.existsSync(process.env.TTSC_FIXTURE_RELEASE)) Atomics.wait(lock, 0, 0, 10);
  },
);
process.stdout.write(result);
`;

function spawnPublisher({ files, helper, label, parent, ready, release }) {
  const encodedFiles = Object.fromEntries(
    Object.entries(files).map(([file, contents]) => [
      file,
      Buffer.from(contents).toString("base64"),
    ]),
  );
  const child = spawn(
    process.execPath,
    [
      "--disable-warning=ExperimentalWarning",
      "--experimental-transform-types",
      "--input-type=module",
      "--eval",
      PUBLISHER_SOURCE,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        TTSC_FIXTURE_FILES: Buffer.from(JSON.stringify(encodedFiles)).toString(
          "base64",
        ),
        TTSC_FIXTURE_HELPER: pathToFileURL(helper).href,
        TTSC_FIXTURE_LABEL: label,
        TTSC_FIXTURE_PARENT: parent,
        TTSC_FIXTURE_READY: ready,
        TTSC_FIXTURE_RELEASE: release,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const completed = new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`fixture publisher exited ${code}: ${stderr}`));
    });
  });
  return { child, completed };
}

function hiddenStagingEntries(parent, label) {
  return fs
    .readdirSync(parent)
    .filter((entry) => entry.startsWith(`.${label}-`));
}

async function waitFor(predicate) {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() >= deadline)
      throw new Error("timed out waiting for fixture publishers");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Concatenate every source of one tree. Scenarios and their helpers are one
 * file per identity, so a fixture invariant is a property of the whole suite,
 * not of whichever file happens to hold it.
 */
function readTree(directory) {
  return collectFiles(directory)
    .sort()
    .map((file) => fs.readFileSync(file, "utf8"))
    .join(String.fromCharCode(10));
}

/**
 * The development skill's scenario doc: a one-line `Verifies …` headline, at
 * least one paragraph stating why, and a closing list of two to four numbered
 * steps, directly above the exported test.
 */
function assertScenarioDoc(relative, text, name) {
  const declaration = text.indexOf(`export async function ${name}(`);
  const end = text.lastIndexOf("*/", declaration);
  const start = text.lastIndexOf("\n/**", end) + 1;
  assert.ok(
    start > 0 && text.slice(end + 2, declaration).trim() === "",
    `${relative} must open with a doc comment directly above its test`,
  );
  const blocks = text
    .slice(start + 3, end)
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .join("\n")
    .trim()
    .split(/\n\s*\n/);
  const steps = blocks.at(-1).match(/^\d+\. /gm) ?? [];
  assert.match(
    blocks[0],
    /^Verifies /,
    `${relative} must open with "Verifies"`,
  );
  assert.ok(blocks.length >= 3, `${relative} must say why it exists`);
  assert.ok(
    /^1\. /.test(blocks.at(-1)) && steps.length >= 2 && steps.length <= 4,
    `${relative} must close with two to four numbered steps`,
  );
}

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(location) : [location];
  });
}

function packageManagerInstallCommands(source) {
  return (
    source.match(/["'`](?:npm|pnpm|yarn|bun) (?:install|add|i|ci)\b/g) ?? []
  );
}
