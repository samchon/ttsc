import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { observeMappedDescriptorResolution } from "../../../../../packages/ttsc/src/launcher/internal/runtime/observeMappedDescriptorResolution";

/**
 * Verifies the runtime's mapped observation preserves its earlier witnesses.
 *
 * Actual Node resolution selects FAR before an owned nearer package appears.
 * Both runtime callers use this production operation; the direct window makes
 * its earlier observation distinguishable without replacing Node's resolver.
 *
 * 1. Resolve real mapped packages between production capture and settlement.
 * 2. Contrast stable proof with created, replaced, failed and linked inputs.
 * 3. Require unavailable proof to remain withdrawn after repeated settlement.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual common runtime operation around createRequire.resolve. Changed scoped/unscoped/subpath/local/linked/failed candidates emit unstable records without hash, physical or metadata proof; stable inputs retain authored content and absence proof. Repeated settlement cannot restore withdrawn proof.
 * @evidence contracts/testing.md#independent-expectations Authored FAR/NEAR roots and Node's selected physical file define selection; SHA-256 of literal bytes and native realpath define stable proof. Equal-byte replacement and linked-target substitution must refuse even when content agrees; no expected signature is copied from the recorder.
 * @evidence contracts/testing.md#distinguishing-cases Covers stable/created scoped and unscoped targets, subpaths, configured JavaScript-to-TypeScript candidates, conditional alternative/farther-root exclusion, local equal-byte replacement, failed imports, stable/retargeted links, native/file-URL parents and repeated unstable settlement. Every case is collected before failure is reported.
 * @evidence contracts/testing.md#execution-ownership This in-process source unit uses the real common runtime operation and public Node resolution over one fresh owned root. It installs no hooks or native artifact and does not claim live descriptor/cache acceptance; cleanup failures remain observable.
 */
export function test_runtime_mapped_resolution_preserves_earlier_witnesses(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-runtime-mapped-witness-")),
  );
  const failures: Error[] = [];
  const write = (file: string, bytes: string): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  };
  const packageAt = (directory: string): string => {
    write(path.join(directory, "package.json"), '{"main":"index.cjs"}');
    const entry = path.join(directory, "index.cjs");
    write(entry, "module.exports='FAR';");
    return entry;
  };
  const digest = (bytes: string): string =>
    crypto.createHash("sha256").update(bytes).digest("hex");
  const check = (name: string, run: (directory: string) => void): void => {
    try {
      run(path.join(root, name));
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const refused = (
    records: ReturnType<ReturnType<typeof observeMappedDescriptorResolution>["commit"]>,
    file: string,
  ): void => {
    const record = records.find((item) => item.resolved === file);
    assert.ok(record, file);
    assert.equal(record.unstable, true, file);
    for (const key of ["hash", "realpath", "signature"])
      assert.equal(Object.hasOwn(record, key), false, `${file}: ${key}`);
  };
  try {
    for (const [name, target, changed] of [
      ["stable", "@scope/pkg", false],
      ["scoped", "@scope/pkg", true],
      ["unscoped", "pkg", true],
      ["subpath", "@scope/pkg/sub.cjs", true],
    ] as const) {
      try {
        const directory = path.join(root, name);
        const app = path.join(directory, "app");
        const parent = path.join(app, "entry.cjs");
        write(parent, "// importer");
        write(path.join(app, "package.json"), JSON.stringify({ imports: { "#dep": target } }));
        const packageName = target.startsWith("@") ? "@scope/pkg" : "pkg";
        const near = path.join(app, "node_modules", packageName);
        fs.mkdirSync(path.dirname(near), { recursive: true });
        const far = path.join(directory, "node_modules", packageName);
        const entry = packageAt(far);
        if (target.endsWith("/sub.cjs")) write(path.join(far, "sub.cjs"), "module.exports='SUB';");
        const window = observeMappedDescriptorResolution("#dep", parent, [".cjs", ".js", ".json", ".node"]);
        const selected = createRequire(parent).resolve("#dep");
        assert.equal(selected, target.endsWith("/sub.cjs") ? path.join(far, "sub.cjs") : entry);
        if (changed) packageAt(near);
        const records = window.commit(selected);
        for (const leaf of ["package.json", "index.cjs"]) {
          const file = path.join(near, leaf);
          const record = records.find((item) => item.resolved === file);
          assert.ok(record, file);
          assert.equal(record.unstable === true, changed, file);
          if (changed) refused(records, file);
          else {
            assert.equal(record.hash, null);
            assert.equal(record.realpath, null);
            assert.equal(typeof record.signature, "string");
          }
        }
        if (!changed) {
          const record = records.find((item) => item.resolved === entry);
          assert.equal(record?.hash, digest("module.exports='FAR';"));
          assert.equal(record?.realpath, fs.realpathSync.native(entry));
          assert.equal(typeof record?.signature, "string");
        }
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
    }
    check("conditional-cutoff", (directory) => {
      const parent = path.join(directory, "app", "entry.cjs");
      write(parent, "// importer");
      write(path.join(directory, "app", "package.json"), JSON.stringify({ imports: { "#dep": { require: "@scope/pkg", default: "unused" } } }));
      const selected = packageAt(path.join(directory, "node_modules", "@scope/pkg"));
      const window = observeMappedDescriptorResolution("#dep", pathToFileURL(parent).href, [".cjs", ".js"]);
      assert.equal(createRequire(parent).resolve("#dep"), selected);
      const records = window.commit(selected);
      assert.equal(records.find((item) => item.resolved === selected)?.hash, digest("module.exports='FAR';"));
      assert.ok(!records.some((item) => item.resolved.includes(`${path.sep}unused`)));
      assert.ok(!records.some((item) => item.resolved === path.join(root, "node_modules", "@scope/pkg", "package.json")));
    });
    check("javascript-source-candidate", (directory) => {
      const parent = path.join(directory, "app", "entry.cjs");
      write(parent, "// importer");
      write(path.join(directory, "app", "package.json"), '{"imports":{"#dep":"@scope/pkg/implementation.js"}}');
      const pkg = path.join(directory, "node_modules", "@scope/pkg");
      packageAt(pkg);
      const selected = path.join(pkg, "implementation.js");
      const source = path.join(pkg, "implementation.ts");
      write(selected, "module.exports=1;");
      const window = observeMappedDescriptorResolution("#dep", parent, [".ts", ".tsx", ".js", ".cjs"]);
      assert.equal(createRequire(parent).resolve("#dep"), selected);
      write(source, "export default 2;");
      refused(window.commit(selected), source);
    });
    check("local-equal-byte-replacement", (directory) => {
      const parent = path.join(directory, "entry.cjs");
      const selected = path.join(directory, "local.cjs");
      write(parent, "// importer");
      write(path.join(directory, "package.json"), '{"imports":{"#dep":"./local.cjs"}}');
      write(selected, "module.exports=1;");
      const before = fs.statSync(selected, { bigint: true });
      const window = observeMappedDescriptorResolution("#dep", parent, [".cjs"]);
      assert.equal(createRequire(parent).resolve("#dep"), selected);
      fs.renameSync(selected, selected + ".original");
      write(selected, "module.exports=1;");
      const after = fs.statSync(selected, { bigint: true });
      assert.ok(before.dev !== after.dev || before.ino !== after.ino);
      refused(window.commit(selected), selected);
      refused(window.commit(selected), selected);
    });
    check("failed-created", (directory) => {
      const parent = path.join(directory, "entry.cjs");
      write(parent, "// importer");
      write(path.join(directory, "package.json"), '{"imports":{"#dep":"@scope/pkg"}}');
      const window = observeMappedDescriptorResolution("#dep", parent, [".cjs"]);
      assert.throws(() => createRequire(parent).resolve("#dep"));
      const selected = packageAt(path.join(directory, "node_modules", "@scope/pkg"));
      refused(window.commit(undefined), selected);
    });
    for (const changed of [false, true])
      check(changed ? "linked-retarget" : "linked-stable", (directory) => {
        const parent = path.join(directory, "app", "entry.cjs");
        write(parent, "// importer");
        write(path.join(directory, "app", "package.json"), '{"imports":{"#dep":"@scope/pkg"}}');
        const first = path.join(directory, "first");
        const second = path.join(directory, "second");
        const selected = packageAt(first);
        packageAt(second);
        const link = path.join(directory, "app", "node_modules", "@scope/pkg");
        fs.mkdirSync(path.dirname(link), { recursive: true });
        fs.symlinkSync(first, link, process.platform === "win32" ? "junction" : "dir");
        const window = observeMappedDescriptorResolution("#dep", parent, [".cjs"]);
        assert.equal(createRequire(parent).resolve("#dep"), selected);
        if (changed) {
          fs.unlinkSync(link);
          fs.symlinkSync(second, link, process.platform === "win32" ? "junction" : "dir");
        }
        const records = window.commit(selected);
        const file = path.join(link, "index.cjs");
        if (changed) refused(records, file);
        else {
          const record = records.find((item) => item.resolved === file);
          assert.equal(record?.hash, digest("module.exports='FAR';"));
          assert.equal(record?.realpath, fs.realpathSync.native(selected));
          assert.equal(typeof record?.signature, "string");
        }
      });
  } finally {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (cause) {
      failures.push(new Error("owned root cleanup", { cause }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "Runtime mapped resolution witnesses");
}
