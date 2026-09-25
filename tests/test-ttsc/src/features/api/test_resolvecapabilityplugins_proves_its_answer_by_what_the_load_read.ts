import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveCapabilityPlugins } from "ttsc";

import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies the capability cache records its answer against the state the plugin
 * load read, not the state it finds afterwards.
 *
 * `resolveCapabilityPlugins` records which configured plugins declare a
 * capability, and a later call answers from that record while every recorded
 * input still holds the recorded state. The record hashed the inputs again when
 * it was written, so an input that moved while the descriptors evaluated was
 * recorded in its new state beside the answer computed from the old one, and
 * every later call proved the stale answer (samchon/ttsc#1504). The record now
 * carries the proof the load took, and no record is written for an answer the
 * load could not prove.
 *
 * 1. Write a project whose descriptor declares the capability a hoisted package
 *    exports, and which installs a nearer copy of that package, declaring
 *    nothing, once it has imported it.
 * 2. Resolve the capability, which records the answer.
 * 3. Resolve it again, and assert it answers what a fresh walk now answers.
 */
export const test_resolvecapabilityplugins_proves_its_answer_by_what_the_load_read =
  (): void => {
    const root = TestProject.tmpdir("ttsc-capability-load-state-");
    const app = path.join(root, "app");
    const nearer = path.join(app, "node_modules", "selection");
    write(path.join(root, "package.json"), '{ "private": true }\n');
    write(path.join(app, "package.json"), '{ "private": true }\n');
    fs.mkdirSync(path.join(app, "node_modules"), { recursive: true });
    write(
      path.join(root, "node_modules", "selection", "package.json"),
      '{ "name": "selection", "main": "index.js" }\n',
    );
    write(
      path.join(root, "node_modules", "selection", "index.js"),
      "module.exports = { probe: true };\n",
    );
    writeGoModule(path.join(app, "go-plugin"));
    write(
      path.join(app, "plugin.cjs"),
      [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        'const capabilities = require("selection");',
        `fs.mkdirSync(${JSON.stringify(nearer)}, { recursive: true });`,
        `fs.writeFileSync(${JSON.stringify(path.join(nearer, "package.json"))}, '{ "name": "selection", "main": "index.js" }');`,
        `fs.writeFileSync(${JSON.stringify(path.join(nearer, "index.js"))}, "module.exports = { probe: false };");`,
        "module.exports = (context) => ({ name: 'probe', source: path.join(context.dirname, 'go-plugin'), capabilities });",
        "",
      ].join("\n"),
    );
    write(
      path.join(app, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: "./plugin.cjs" }] },
      }),
    );
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const saved = {
      TTSC_CACHE_DIR: process.env.TTSC_CACHE_DIR,
      TTSC_GO_BINARY: process.env.TTSC_GO_BINARY,
      TTSC_GO_CACHE_DIR: process.env.TTSC_GO_CACHE_DIR,
    };
    process.env.TTSC_CACHE_DIR = path.join(root, "cache");
    process.env.TTSC_GO_BINARY = createFakeGoBinary(fakeGo);
    process.env.TTSC_GO_CACHE_DIR = path.join(root, "go-cache");
    try {
      const ask = () =>
        resolveCapabilityPlugins({ capability: "probe", cwd: app }).length;
      // The load read the hoisted package, which declares the capability.
      assert.equal(ask(), 1, "the first walk answers from the hoisted package");
      const second = ask();
      fs.rmSync(path.join(root, "cache"), { force: true, recursive: true });
      const fresh = ask();
      assert.equal(fresh, 0, "a fresh walk selects the nearer package");
      assert.equal(second, fresh, "the recorded answer outlived its state");
    } finally {
      for (const [key, value] of Object.entries(saved))
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
  };

function writeGoModule(directory: string): void {
  write(
    path.join(directory, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
  );
  write(path.join(directory, "main.go"), "package main\n");
  for (const relative of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    write(path.join(directory, relative), "package generated\n");
  }
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
