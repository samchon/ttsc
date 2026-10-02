import { TestProject } from "../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../packages/ttsc/src/compiler/internal/EmitOwnershipIndex";

/**
 * Verifies the emit ownership index answers only with output compiled from the
 * very file asked about.
 *
 * Every ttsx lane and `ttsc <file>` ask this index which JavaScript a build
 * emitted from a source. It replaced a lookup that scored outputs by shared
 * trailing path segments, which answered for files the build never compiled
 * (samchon/ttsc#1382). The positive cases pin that no legitimate answer was
 * lost: an ordinary mirror, a directory the compiler saw through a link, a root
 * named through a link, and each extension mapping; the file symlink with
 * another name is owned by the sibling test
 * test_emit_ownership_index_pairs_a_file_symlink_with_the_file_it_points_at. The negative twins pin that a same-named file elsewhere, a
 * declaration file, a file outside the root, and an output the record does not
 * list are never answers. Same-stem siblings receive only the output whose
 * producer record names them, independently of maps or extension precedence.
 *
 * 1. Lay out sources under a root and outputs under an emit directory, with a
 *    directory link.
 * 2. Index captured physical source ownership, with and without an output list.
 * 3. Assert each lookup returns its own output or `null`.
 *
 * @evidence contracts/testing.md#behavioral-verification EmitOwnershipIndex pairs captured source coordinates with their recorded output, rejects unrecorded or external writes, and preserves a recorded output after its file disappears. Output-directory aliases must resolve to the same writer without changing the source owner.
 * @evidence contracts/testing.md#independent-expectations Authored source-to-output records define each owner independently of the index. Native realpath identifies equivalent writer aliases; distinct realpaths remain different files, and literal null/error expectations forbid guessed ownership.
 * @evidence contracts/testing.md#distinguishing-cases Same-stem siblings, declaration files, outside-root sources, linked directories, extension pairs, absent recorded outputs and unrecorded late writes retain their original controls. A linked writer alias with the same captured owner is accepted; conflicting owner rows for that same native writer reject both lookups. Case spellings are equivalent only when the native filesystem confirms identity.
 * @evidence contracts/testing.md#execution-ownership This exported source unit calls EmitOwnershipIndex directly on an isolated TestProject.tmpdir fixture. It creates source/output files and directory junctions but never builds, installs or starts a compiler. Every case runs in this one entry; the file-symlink lookup, which needs a privilege Windows may withhold, lives in its own sibling entry so that a refusal is reported as a skipped test.
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
    fs.symlinkSync(
      path.join(root, "real"),
      path.join(root, "alias"),
      "junction",
    );
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

    const emittedSources: Record<string, string[]> = Object.fromEntries([
      ["a/index.ts", "a/index.js"], ["real/aliased.ts", "alias/aliased.js"],
      ["modules/esm.mts", "modules/esm.mjs"], ["modules/cjs.cts", "modules/cjs.cjs"],
      ["view/page.tsx", "view/page.jsx"], ["solo/widget.tsx", "solo/widget.js"],
      ["both/twin.ts", "both/twin.js"],
    ].map(([source, output]) => [path.join(emit, output!), [fs.realpathSync.native(path.join(root, source!))]]));
    const createIndex = () => new EmitOwnershipIndex({ emitDir: emit, rootDir: root, emittedSources });
    const index = createIndex();
    const found = (source: string): string | null =>
      index.find(path.join(root, source));
    const emitted = (output: string): string => path.join(emit, output);

    const linkedEmit = path.join(base, "linked-emit");
    fs.symlinkSync(emit, linkedEmit, "junction");
    const physicalOutput = fs.realpathSync.native(emitted("a/index.js"));
    const sourceOwner = fs.realpathSync.native(path.join(root, "a/index.ts"));
    const writerAliases = [path.join(linkedEmit, "a/index.js")];
    const caseAlias = emitted("a/INDEX.js");
    if (fs.existsSync(caseAlias) && fs.realpathSync.native(caseAlias) === physicalOutput)
      writerAliases.push(caseAlias);
    const volumeAlias = physicalOutput.replace(/^[A-Z]:/, (root) => root.toLowerCase());
    if (volumeAlias !== physicalOutput && fs.realpathSync.native(volumeAlias) === physicalOutput)
      writerAliases.push(volumeAlias);
    for (const writer of writerAliases) {
      assert.equal(fs.realpathSync.native(writer), physicalOutput);
      const aliased = new EmitOwnershipIndex({
        emitDir: linkedEmit,
        rootDir: root,
        outputs: ["a/index.js"],
        emittedSources: { [writer]: [sourceOwner] },
      });
      assert.equal(aliased.find(path.join(root, "a/index.ts")), physicalOutput);
    }
    const sharedWriter = writerAliases[0]!;
    const repeatedOwner = new EmitOwnershipIndex({
      emitDir: emit,
      rootDir: root,
      outputs: ["a/index.js"],
      emittedSources: {
        [physicalOutput]: [sourceOwner],
        [sharedWriter]: [sourceOwner],
      },
    });
    assert.equal(repeatedOwner.find(path.join(root, "a/index.ts")), physicalOutput);
    const contradictoryOwners = new EmitOwnershipIndex({
      emitDir: emit,
      rootDir: root,
      outputs: ["a/index.js"],
      emittedSources: {
        [physicalOutput]: [sourceOwner],
        [sharedWriter]: [fs.realpathSync.native(path.join(root, "b/index.ts"))],
      },
    });
    for (const source of ["a/index.ts", "b/index.ts"])
      assert.throws(() => contradictoryOwners.find(path.join(root, source)),
        /multiple source owners|ownership is ambiguous/);
    const outsideOutput = path.join(base, "outside-output.js");
    write(outsideOutput);
    assert.throws(() => new EmitOwnershipIndex({
      emitDir: emit,
      rootDir: root,
      outputs: ["a/index.js"],
      emittedSources: { [outsideOutput]: [sourceOwner] },
    }), /provenance escapes its output directory/);
    assert.throws(() => new EmitOwnershipIndex({
      emitDir: emit,
      rootDir: root,
      outputs: ["a/index.js"],
      emittedSources: { [emitted("modules/esm.mjs")]: [sourceOwner] },
    }), /provenance names an unrecorded output/);
    // A sensitive filesystem keeps this second writer distinct. The native
    // identity observation, rather than the host OS name, owns that premise.
    if (!fs.existsSync(caseAlias)) write(caseAlias, "// distinct writer\n");
    if (fs.realpathSync.native(caseAlias) !== physicalOutput) {
      assert.throws(() => new EmitOwnershipIndex({
        emitDir: emit,
        rootDir: root,
        outputs: ["a/index.js"],
        emittedSources: { [caseAlias]: [sourceOwner] },
      }), /provenance names an unrecorded output/);
    }

    assert.equal(found("a/index.ts"), emitted("a/index.js"));
    assert.equal(found("b/index.ts"), null, "a same-named file elsewhere");
    assert.equal(found("real/aliased.ts"), emitted("alias/aliased.js"));
    assert.equal(found("alias/aliased.ts"), emitted("alias/aliased.js"));
    assert.equal(found("types/value.d.ts"), null, "a declaration file");
    assert.equal(found("modules/esm.mts"), emitted("modules/esm.mjs"));
    assert.equal(found("modules/cjs.cts"), emitted("modules/cjs.cjs"));
    assert.equal(found("view/page.tsx"), emitted("view/page.jsx"));
    assert.equal(found("solo/widget.tsx"), emitted("solo/widget.js"));
    // The producer recorded twin.ts; a same-stem sibling was not compiled.
    assert.equal(found("both/twin.ts"), emitted("both/twin.js"));
    assert.equal(found("both/twin.tsx"), null, "the lower-precedence twin");
    // The producer records pair.tsx, independently of its optional source map.
    write(path.join(root, "mapped/pair.ts"));
    write(path.join(root, "mapped/pair.tsx"));
    write(path.join(emit, "mapped/pair.js"));
    write(
      path.join(emit, "mapped/pair.js.map"),
      JSON.stringify({
        version: 3,
        sources: [
          path
            .relative(
              path.join(emit, "mapped"),
              path.join(root, "mapped/pair.tsx"),
            )
            .split(path.sep)
            .join("/"),
        ],
        mappings: "",
      }),
    );
    emittedSources[path.join(emit, "mapped/pair.js")] = [fs.realpathSync.native(path.join(root, "mapped/pair.tsx"))];
    const mapped = createIndex();
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
    emittedSources[path.join(emit, "preserved/doc.js")] = [fs.realpathSync.native(path.join(root, "preserved/doc.ts"))];
    emittedSources[path.join(emit, "preserved/doc.jsx")] = [fs.realpathSync.native(path.join(root, "preserved/doc.tsx"))];
    const preserved = createIndex();
    assert.equal(
      preserved.find(path.join(root, "preserved", "doc.ts")),
      emitted("preserved/doc.js"),
    );
    assert.equal(
      preserved.find(path.join(root, "preserved", "doc.tsx")),
      emitted("preserved/doc.jsx"),
    );
    write(path.join(base, "outside.ts"));
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
      emittedSources,
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
      emittedSources: { [path.join(emit, "a/index.js")]: emittedSources[path.join(emit, "a/index.js")]! },
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
    fs.symlinkSync(
      path.join(root, "real"),
      path.join(emit, "linked"),
      "junction",
    );
    write(path.join(root, "real", "stray.js"));
    assert.equal(
      EmitOwnershipIndex.listOutputs(emit).some((output) =>
        output.startsWith("linked/"),
      ),
      false,
    );
  };
