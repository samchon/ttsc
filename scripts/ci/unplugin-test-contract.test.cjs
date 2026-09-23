const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..", "..");

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
