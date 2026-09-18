import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../../packages/ttsc/lib/compiler/internal/EmitOwnershipIndex.js";

/**
 * Verifies the emit ownership index answers only with output compiled from the
 * very file asked about.
 *
 * Every ttsx lane and `ttsc <file>` ask this index which JavaScript a build
 * emitted from a source. It replaced a lookup that scored outputs by shared
 * trailing path segments, which answered for files the build never compiled
 * (samchon/ttsc#1382). The positive cases pin that no legitimate answer was
 * lost: an ordinary mirror, a directory the compiler saw through a link, a
 * root named through a link, a file symlink with another name, and each
 * extension mapping. The negative twins pin that a same-named file elsewhere, a
 * declaration file, a file outside the root, and an output the record does
 * not list are never answers, and that an output two TypeScript sources could
 * have produced goes to the one its source map names, or else to the one the
 * compiler's extension precedence picks.
 *
 * 1. Lay out sources under a root and outputs under an emit directory, with a
 *    directory link and, where permitted, a file symlink.
 * 2. Index the build with and without an explicit output record.
 * 3. Assert each lookup returns its own output or `null`.
 */
export const test_emit_ownership_index_answers_only_with_the_output_of_the_same_file =
  () => {
    const base = fs.realpathSync.native(TestProject.tmpdir("ttsc-ownership-"));
    const root = path.join(base, "root");
    const emit = path.join(base, "emit");
    const write = (file: string, text: string = "//\n"): void => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    };
    for (const file of [
      "a/index.ts",
      "b/index.ts",
      "real/aliased.ts",
      "types/value.d.ts",
      "modules/esm.mts",
      "modules/cjs.cts",
      "view/page.tsx",
      "solo/widget.tsx",
      "both/twin.ts",
      "both/twin.tsx",
    ]) {
      write(path.join(root, file));
    }
    fs.symlinkSync(path.join(root, "real"), path.join(root, "alias"), "junction");
    const outputs = [
      "a/index.js",
      "alias/aliased.js",
      "types/value.js",
      "modules/esm.mjs",
      "modules/cjs.cjs",
      "view/page.jsx",
      "solo/widget.js",
      "both/twin.js",
    ];
    for (const output of outputs) write(path.join(emit, output));

    const index = new EmitOwnershipIndex({ emitDir: emit, rootDir: root });
    const found = (source: string): string | null =>
      index.find(path.join(root, source));
    const emitted = (output: string): string => path.join(emit, output);

    assert.equal(found("a/index.ts"), emitted("a/index.js"));
    assert.equal(found("b/index.ts"), null, "a same-named file elsewhere");
    assert.equal(found("real/aliased.ts"), emitted("alias/aliased.js"));
    assert.equal(found("alias/aliased.ts"), emitted("alias/aliased.js"));
    assert.equal(found("types/value.d.ts"), null, "a declaration file");
    assert.equal(found("modules/esm.mts"), emitted("modules/esm.mjs"));
    assert.equal(found("modules/cjs.cts"), emitted("modules/cjs.cjs"));
    assert.equal(found("view/page.tsx"), emitted("view/page.jsx"));
    assert.equal(found("solo/widget.tsx"), emitted("solo/widget.js"));
    // `twin.js` could be either source's output. With no source map, the
    // compiler's precedence decides: `.ts` before `.tsx`.
    assert.equal(found("both/twin.ts"), emitted("both/twin.js"));
    assert.equal(found("both/twin.tsx"), null, "the lower-precedence twin");
    // A source map names the file the compiler actually read.
    write(path.join(root, "mapped/pair.ts"));
    write(path.join(root, "mapped/pair.tsx"));
    write(path.join(emit, "mapped/pair.js"));
    write(
      path.join(emit, "mapped/pair.js.map"),
      JSON.stringify({
        version: 3,
        sources: [path.relative(path.join(emit, "mapped"), path.join(root, "mapped/pair.tsx")).split(path.sep).join("/")],
        mappings: "",
      }),
    );
    const mapped = new EmitOwnershipIndex({ emitDir: emit, rootDir: root });
    assert.equal(
      mapped.find(path.join(root, "mapped", "pair.tsx")),
      emitted("mapped/pair.js"),
    );
    assert.equal(mapped.find(path.join(root, "mapped", "pair.ts")), null);
    // Under JSX `preserve` the twins write different files: `doc.ts` owns
    // `doc.js`, and `doc.tsx`, refused there, owns `doc.jsx`.
    write(path.join(root, "preserved/doc.ts"));
    write(path.join(root, "preserved/doc.tsx"));
    write(path.join(emit, "preserved/doc.js"));
    write(path.join(emit, "preserved/doc.jsx"));
    const preserved = new EmitOwnershipIndex({ emitDir: emit, rootDir: root });
    assert.equal(
      preserved.find(path.join(root, "preserved", "doc.ts")),
      emitted("preserved/doc.js"),
    );
    assert.equal(
      preserved.find(path.join(root, "preserved", "doc.tsx")),
      emitted("preserved/doc.jsx"),
    );
    assert.equal(
      index.find(path.join(base, "outside.ts")),
      null,
      "a file outside the root",
    );

    // A root named through a link is the same root.
    const linkedRoot = path.join(base, "linked-root");
    fs.symlinkSync(root, linkedRoot, "junction");
    const throughLink = new EmitOwnershipIndex({
      emitDir: emit,
      rootDir: linkedRoot,
    });
    assert.equal(
      throughLink.find(path.join(root, "a", "index.ts")),
      emitted("a/index.js"),
    );

    // The record is the authority: an owned output that disappeared is still
    // owned, and an output the record does not list is not.
    const recorded = new EmitOwnershipIndex({
      emitDir: emit,
      outputs: ["a/index.js"],
      rootDir: root,
    });
    write(path.join(root, "late.ts"));
    write(path.join(emit, "late.js"));
    fs.rmSync(emitted("a/index.js"));
    assert.equal(
      recorded.find(path.join(root, "a", "index.ts")),
      emitted("a/index.js"),
    );
    assert.equal(recorded.find(path.join(root, "late.ts")), null);

    // Listing records real outputs only: a link inside the emit directory
    // reaches the user's tree, not the build's output.
    fs.symlinkSync(path.join(root, "real"), path.join(emit, "linked"), "junction");
    write(path.join(root, "real", "stray.js"));
    assert.equal(
      EmitOwnershipIndex.listOutputs(emit).some((output) =>
        output.startsWith("linked/"),
      ),
      false,
    );

    // A file symlink may carry any name, so only identity pairs it with the
    // file it points at. Creating one needs a privilege Windows may withhold.
    const target = path.join(root, "target", "renamed.ts");
    write(target);
    try {
      fs.symlinkSync(target, path.join(root, "shortcut.ts"), "file");
    } catch {
      return;
    }
    write(path.join(emit, "shortcut.js"));
    const linked = new EmitOwnershipIndex({ emitDir: emit, rootDir: root });
    assert.equal(linked.find(target), emitted("shortcut.js"));
  };
