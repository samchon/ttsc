import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { linkVirtualEntry } from "../../../../../packages/ttsc/src/launcher/internal/linkVirtualEntry";
import { CompilerArchives } from "../../../../test-e2e/src/batch/CompilerArchives";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verify ordinary E2E archive borrowing against real small file populations.
 *
 * These cases prove generation/content ownership decisions without pretending
 * to verify pnpm publication or installed compiler behavior. The actual E2E
 * runner retains those independent installation and generated-backend
 * boundaries.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual filesystem inputs and archive bytes exercise the owner, producer, borrowers and release callback; fresh generations run their normal producers after source/config/manifest changes, exact immutable generations remain explicit, and missing/corrupt/replaced archives or failed release cannot grant reuse or cleanup.
 * @evidence contracts/testing.md#independent-expectations Literal distinct payloads, independent SHA-256, explicit producer/release counts and authored failure objects define expected outcomes without deriving them from the owner's verdict. Actual corrupt, equal-byte replaced and metadata-only archive mutations independently determine which finite refusal facts must appear in CI stderr and the error cause.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged two-consumer reuse differs from new-owner production, new production after same-size/restored-mtime source changes, configuration/package selection and environment changes, missing/corrupt/replaced archives, metadata-only refusal distinct from changed bytes, malformed or missing borrowed/remaining package manifests, retained readers and producer/release failures. Actual runtime entry mirroring contrasts a root archive's native hardlink transition with an opaque archive directory; mirror removal preserves isolated borrowing, while replacing that directory with an alias refuses reuse and deletion.
 * @evidence contracts/testing.md#execution-ownership The existing test-ttsc runner discovers this utility test; explicit producer/release callbacks operate only small authored allocations without native builds, packs, installs or foreign-method replacement.
 */
export async function test_e2e_compiler_archives_preserve_run_authority(): Promise<void> {
  const failures: unknown[] = [];
  const check = (label: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(label, { cause }));
    }
  };
  const seed = () => {
    const repository = TestProject.tmpdir("compiler-archive-unit-");
    const output = TestProject.tmpdir("compiler-archive-output-");
    const source = path.join(repository, "packages/compiler");
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(source, "package.json"),
      '{"name":"unit-compiler","version":"1.0.0"}',
    );
    fs.writeFileSync(path.join(source, "input.js"), "first input");
    fs.writeFileSync(
      path.join(repository, "pnpm-workspace.yaml"),
      'packages:\n  - "packages/*"\n',
    );
    const optional = path.join(repository, ".npmrc");
    let environment = "original";
    let produced = 0;
    let retained = 0;
    const props = {
      repository,
      output,
      directories: ["packages/compiler"],
      produce: (_directory: string, archive: string) => {
        produced++;
        fs.writeFileSync(archive, "authored archive", { flag: "wx" });
      },
      retain: (_reason: string) => {
        retained++;
      },
    };
    return {
      repository,
      output,
      source,
      optional,
      props,
      counts: () => ({ produced, retained }),
      inputPayload: () =>
        JSON.stringify({
          source: fs.existsSync(path.join(source, "input.js"))
            ? fs.readFileSync(path.join(source, "input.js"), "utf8")
            : null,
          manifest: fs.readFileSync(path.join(source, "package.json"), "utf8"),
          added: fs.existsSync(path.join(source, "new.js")),
          configuration: fs.existsSync(optional)
            ? fs.readFileSync(optional, "utf8")
            : null,
          workspaceDependency: fs.existsSync(
            path.join(repository, "packages/dependency/package.json"),
          ),
          environment,
        }),
      changeEnvironment: () => {
        environment = "changed";
      },
    };
  };
  const archiveState = (archive: string) => {
    const stat = fs.statSync(archive, { bigint: true });
    return {
      dev: stat.dev,
      ino: stat.ino,
      nlink: stat.nlink,
      size: stat.size,
      mode: stat.mode,
      mtimeNs: stat.mtimeNs,
      ctimeNs: stat.ctimeNs,
    };
  };
  for (const isolated of [false, true])
    check(
      "runtime mirroring " + (isolated ? "isolated directory" : "root file"),
      () => {
        const fixture = seed();
        const root = TestProject.tmpdir("compiler-archive-project-");
        const output = isolated ? path.join(root, ".compiler-archives") : root;
        if (isolated) fs.mkdirSync(output);
        const owner = CompilerArchives.create({ ...fixture.props, output });
        const initial = owner.borrow();
        const artifact = initial.artifacts[0]!;
        initial.release();
        const before = archiveState(artifact.archive);
        const virtual = TestProject.tmpdir("compiler-archive-virtual-");
        const entry = fs.readdirSync(root, { withFileTypes: true })[0]!;
        assert.equal(entry.name, isolated ? ".compiler-archives" : "compiler.tgz");
        const mirrored = path.join(virtual, entry.name);
        linkVirtualEntry(path.join(root, entry.name), mirrored, entry);
        const after = archiveState(artifact.archive);
        assert.equal(
          crypto
            .createHash("sha256")
            .update(fs.readFileSync(artifact.archive))
            .digest("hex"),
          crypto.createHash("sha256").update("authored archive").digest("hex"),
        );
        if (isolated) {
          assert.equal(fs.lstatSync(mirrored).isSymbolicLink(), true);
          assert.equal(
            fs.realpathSync.native(mirrored),
            fs.realpathSync.native(output),
          );
          assert.deepEqual(after, before);
          const loan = owner.borrow();
          assert.throws(
            () => owner.close(() => assert.fail("active mirror borrower")),
            /borrowers/,
          );
          fs.unlinkSync(mirrored);
          assert.deepEqual(archiveState(artifact.archive), before);
          loan.assertAvailable();
          loan.release();
          const next = owner.borrow();
          next.release();
          owner.close(() => fs.rmSync(root, { recursive: true, force: true }));
          assert.equal(fs.existsSync(root), false);
        } else {
          const target = fs.statSync(mirrored, { bigint: true });
          if (target.dev === before.dev && target.ino === before.ino) {
            assert.equal(after.nlink, before.nlink + 1n);
            if (after.ctimeNs !== before.ctimeNs)
              assert.throws(
                () => owner.borrow(),
                /Compiler archive changed before reuse/,
              );
            else {
              // Native timestamp resolution can coalesce adjacent operations.
              const loan = owner.borrow();
              loan.release();
            }
          } else {
            // The actual helper can copy when the filesystem refuses hardlinks.
            assert.deepEqual(after, before);
            const loan = owner.borrow();
            loan.release();
          }
          fs.unlinkSync(mirrored);
          if (archiveState(artifact.archive).ctimeNs !== before.ctimeNs)
            assert.throws(
              () => owner.borrow(),
              /Compiler archive changed before reuse/,
            );
          owner.close(() => fs.rmSync(root, { recursive: true, force: true }));
          assert.equal(fs.existsSync(root), false);
        }
      },
    );
  check("isolated archive directory alias refuses reuse and removal", () => {
    const fixture = seed();
    const root = TestProject.tmpdir("compiler-archive-island-");
    const output = path.join(root, ".compiler-archives");
    fs.mkdirSync(output);
    const owner = CompilerArchives.create({ ...fixture.props, output });
    const moved = path.join(root, "moved");
    fs.renameSync(output, moved);
    fs.symlinkSync(moved, output, "junction");
    assert.throws(() => owner.borrow(), /allocation was replaced/);
    assert.throws(
      () => owner.close(() => assert.fail("aliased removal")),
      /allocation was replaced/,
    );
    assert.equal(
      fs.readFileSync(path.join(moved, "compiler.tgz"), "utf8"),
      "authored archive",
    );
  });
  check("unchanged borrowing and release", () => {
    const fixture = seed();
    const observed: { phase: string; files?: number; bytes?: number }[] = [];
    const owner = CompilerArchives.create({
      ...fixture.props,
      observe: (event) => observed.push(event),
    });
    assert.equal(
      observed.filter((event) => event.phase === "qualify-inputs").length,
      0,
    );
    assert.equal(
      observed.find((event) => event.phase === "qualify-archive")!.bytes,
      Buffer.byteLength("authored archive"),
    );
    const first = owner.borrow();
    const second = owner.borrow();
    assert.equal(fixture.counts().produced, 1);
    assert.equal(
      first.artifacts[0]!.sha256,
      crypto.createHash("sha256").update("authored archive").digest("hex"),
    );
    assert.equal(first.artifacts[0]!.archive, second.artifacts[0]!.archive);
    assert.throws(
      () => owner.close(() => assert.fail("premature removal")),
      /borrowers/,
    );
    first.assertAvailable();
    first.release();
    second.release();
    assert.throws(() => first.assertAvailable(), /released/);
    assert.throws(() => first.retain("late caller"), /released/);
    let released = 0;
    owner.close(() => {
      released++;
    });
    owner.close(() => {
      released++;
    });
    assert.equal(released, 1);
    assert.throws(() => owner.borrow(), /closed/);
    const next = seed();
    const nextOwner = CompilerArchives.create(next.props);
    assert.equal(next.counts().produced, 1);
    assert.notEqual(
      nextOwner.borrow().artifacts[0]!.archive,
      first.artifacts[0]!.archive,
    );
  });
  const sourceMutations: [
    string,
    (fixture: ReturnType<typeof seed>, archive: string) => void,
  ][] = [
    [
      "same-size source",
      ({ source }) => {
        const file = path.join(source, "input.js");
        const stat = fs.statSync(file);
        fs.writeFileSync(file, "other input");
        fs.utimesSync(file, stat.atime, stat.mtime);
      },
    ],
    [
      "added source",
      ({ source }) => fs.writeFileSync(path.join(source, "new.js"), "added"),
    ],
    [
      "missing source",
      ({ source }) => fs.unlinkSync(path.join(source, "input.js")),
    ],
    [
      "package name",
      ({ source }) =>
        fs.writeFileSync(path.join(source, "package.json"), '{"name":"other"}'),
    ],
    [
      "new publication configuration",
      ({ optional }) => fs.writeFileSync(optional, "access=public"),
    ],
    [
      "workspace dependency",
      ({ repository }) => {
        const sibling = path.join(repository, "packages/dependency");
        fs.mkdirSync(sibling);
        fs.writeFileSync(
          path.join(sibling, "package.json"),
          '{"name":"dependency","version":"2"}',
        );
      },
    ],
    ["environment", (fixture) => fixture.changeEnvironment()],
  ];
  for (const [label, mutate] of sourceMutations)
    check("new generation after " + label, () => {
      const fixture = seed();
      const owner = CompilerArchives.create(fixture.props);
      const loan = owner.borrow();
      const before = fixture.inputPayload();
      mutate(fixture, loan.artifacts[0]!.archive);
      const changed = fixture.inputPayload();
      assert.notEqual(changed, before);
      // An explicit existing generation remains its exact published bytes.
      loan.assertAvailable();
      assert.equal(
        fs.readFileSync(loan.artifacts[0]!.archive, "utf8"),
        "authored archive",
      );
      const output = TestProject.tmpdir("compiler-archive-next-generation-");
      const next = CompilerArchives.create({
        ...fixture.props,
        output,
        produce: (directory, archive) => {
          fixture.props.produce(directory, archive);
          fs.writeFileSync(archive, fixture.inputPayload());
        },
      });
      assert.equal(fixture.counts().produced, 2);
      const nextLoan = next.borrow();
      assert.equal(
        fs.readFileSync(nextLoan.artifacts[0]!.archive, "utf8"),
        changed,
      );
      assert.notEqual(nextLoan.artifacts[0]!.sha256, loan.artifacts[0]!.sha256);
      assert.notEqual(
        nextLoan.artifacts[0]!.archive,
        loan.artifacts[0]!.archive,
      );
      nextLoan.release();
      loan.release();
    });
  const mutations: [
    string,
    (fixture: ReturnType<typeof seed>, archive: string) => void,
  ][] = [
    ["missing archive", (_fixture, archive) => fs.unlinkSync(archive)],
    [
      "metadata-only archive change",
      (_fixture, archive) => {
        const stat = fs.statSync(archive);
        fs.utimesSync(archive, stat.atime, new Date(stat.mtimeMs + 2_000));
      },
    ],
    [
      "corrupt archive same size",
      (_fixture, archive) => {
        const stat = fs.statSync(archive);
        fs.writeFileSync(archive, "corrupt! archive");
        fs.utimesSync(archive, stat.atime, stat.mtime);
      },
    ],
    [
      "replaced equal archive",
      (_fixture, archive) => {
        const replacement = archive + ".replacement";
        fs.writeFileSync(replacement, "authored archive");
        fs.unlinkSync(archive);
        fs.renameSync(replacement, archive);
      },
    ],
  ];
  for (const [label, mutate] of mutations)
    check(label, () => {
      const fixture = seed();
      const owner = CompilerArchives.create(fixture.props);
      const borrower = owner.borrow();
      mutate(fixture, borrower.artifacts[0]!.archive);
      const refusal =
        label === "missing archive" ? /ENOENT/ : /changed before reuse/;
      assert.throws(() => owner.borrow(), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, refusal);
        if (label !== "missing archive") {
          const details = error.cause as {
            expected: { physical: string; identity: string; sha256: string };
            current: { physical: string; identity: string; sha256: string };
            changed: { physical: boolean; identity: boolean; sha256: boolean };
          };
          assert.ok(
            details,
            "A rejected archive must expose its actual mismatch",
          );
          assert.equal(
            details.expected.physical,
            borrower.artifacts[0]!.physical,
          );
          assert.equal(
            details.expected.sha256,
            crypto.createHash("sha256").update("authored archive").digest("hex"),
          );
          assert.equal(
            details.current.physical,
            fs.realpathSync.native(borrower.artifacts[0]!.archive),
          );
          assert.equal(
            details.current.sha256,
            crypto
              .createHash("sha256")
              .update(fs.readFileSync(borrower.artifacts[0]!.archive))
              .digest("hex"),
          );
          assert.deepEqual(details.changed, {
            physical: false,
            identity: true,
            sha256: label === "corrupt archive same size",
          });
          assert.notEqual(details.expected.identity, details.current.identity);
          assert.ok(
            error.message.includes(JSON.stringify(details)),
            "CI stderr must retain the finite mismatch facts",
          );
        }
        return true;
      });
      assert.throws(() => borrower.assertAvailable(), refusal);
      borrower.release();
    });
  check("producer failure and preexisting destination", () => {
    const fixture = seed();
    const failure = new Error("authored producer failure");
    assert.throws(
      () =>
        CompilerArchives.create({
          ...fixture.props,
          produce: () => {
            throw failure;
          },
        }),
      (error) => error === failure,
    );
    CompilerArchives.create(fixture.props);
    assert.throws(
      () => CompilerArchives.create(fixture.props),
      /existing destination/,
    );
    assert.equal(fixture.counts().produced, 1);
  });
  check("retention stays sticky when delegate fails", () => {
    const fixture = seed();
    const failure = new Error("authored retention failure");
    const owner = CompilerArchives.create({
      ...fixture.props,
      retain: () => {
        throw failure;
      },
    });
    const loan = owner.borrow();
    assert.throws(
      () => loan.retain("unknown child"),
      (error) => error === failure,
    );
    assert.throws(() => loan.release(), /retained/);
    assert.throws(() => owner.borrow(), /retained/);
    assert.throws(
      () => owner.close(() => assert.fail("retained removal")),
      /retained/,
    );
    assert.ok(fs.existsSync(loan.artifacts[0]!.archive));
  });
  check("release failure preserves original failure and retention", () => {
    const fixture = seed();
    const owner = CompilerArchives.create(fixture.props);
    const failure = new Error("authored release failure");
    assert.throws(
      () =>
        owner.close(() => {
          throw failure;
        }),
      (error) => error === failure,
    );
    assert.equal(fixture.counts().retained, 1);
    assert.throws(() => owner.borrow(), /retained/);
    assert.throws(
      () => owner.close(() => assert.fail("second removal")),
      /retained/,
    );
  });
  check("replaced allocation cannot grant deletion", () => {
    const fixture = seed();
    const owner = CompilerArchives.create(fixture.props);
    const movedRoot = TestProject.tmpdir("compiler-archive-moved-");
    const original = path.join(movedRoot, "original");
    assert.equal(path.dirname(original), movedRoot);
    fs.renameSync(fixture.output, original);
    fs.mkdirSync(fixture.output);
    fs.writeFileSync(path.join(fixture.output, "foreign"), "keep");
    assert.throws(() => owner.borrow(), /allocation was replaced/);
    assert.throws(
      () => owner.close(() => assert.fail("foreign removal")),
      /allocation was replaced/,
    );
    assert.equal(
      fs.readFileSync(path.join(fixture.output, "foreign"), "utf8"),
      "keep",
    );
  });
  const { prepareArtifacts } = createRequire(import.meta.url)(
    "../../../../test-e2e/fixtures/evidence/backend-activation/prepare.cjs",
  ) as {
    prepareArtifacts: (
      request: Record<string, unknown>,
      toolchain: {
        directories: readonly string[];
        pack: (
          repository: string,
          output: string,
        ) => Promise<{ name: string; archive: string }[]>;
        packPackage: (
          repository: string,
          directory: string,
          archive: string,
        ) => Promise<void>;
      },
    ) => Promise<{
      toolchain: { name: string; archive: string }[];
      artifact: { name: string; archive: string };
    }>;
  };
  for (const mode of [
    "standalone",
    "borrow",
    "complete",
    "corrupt",
    "missing",
    "duplicate",
    "foreign",
    "hash",
    "name",
    "manifest",
    "manifest-compiler",
    "manifest-name-missing",
    "manifest-file-missing",
    "manifest-json",
    "replaced",
  ] as const) {
    try {
      const fixture = seed();
      const plugin = path.join(fixture.repository, "packages/plugin");
      fs.mkdirSync(plugin);
      fs.writeFileSync(
        path.join(plugin, "package.json"),
        '{"name":"unit-plugin"}',
      );
      const owner = CompilerArchives.create(fixture.props);
      const loan = owner.borrow();
      const packed: string[] = [];
      const packPackage = async (
        _repository: string,
        directory: string,
        archive: string,
      ): Promise<void> => {
        packed.push(directory);
        fs.writeFileSync(archive, "new " + directory);
      };
      const full = [{ name: "already-packed", archive: "caller-owned" }];
      const artifact = { name: "@ttsc/evidence", archive: "caller-evidence" };
      const request: Record<string, unknown> = {
        repository: fixture.repository,
        root: TestProject.tmpdir("compiler-archive-route-"),
      };
      if (mode === "complete")
        Object.assign(request, { toolchain: full, artifact });
      else if (mode !== "standalone")
        request.borrowedCompilerArchives = loan.artifacts;
      if (mode === "corrupt")
        fs.writeFileSync(loan.artifacts[0]!.archive, "bad");
      if (mode === "missing") fs.unlinkSync(loan.artifacts[0]!.archive);
      if (mode === "duplicate")
        request.borrowedCompilerArchives = [
          loan.artifacts[0],
          loan.artifacts[0],
        ];
      if (mode === "foreign")
        request.borrowedCompilerArchives = [
          { ...loan.artifacts[0], directory: "packages/foreign" },
        ];
      if (mode === "hash")
        request.borrowedCompilerArchives = [
          { ...loan.artifacts[0], sha256: "different authored digest" },
        ];
      if (mode === "name")
        request.borrowedCompilerArchives = [
          { ...loan.artifacts[0], name: "wrong package" },
        ];
      if (mode === "manifest")
        fs.writeFileSync(path.join(plugin, "package.json"), '{"name":42}');
      if (mode === "manifest-compiler")
        fs.writeFileSync(
          path.join(fixture.source, "package.json"),
          '{"name":42}',
        );
      if (mode === "manifest-name-missing")
        fs.writeFileSync(path.join(plugin, "package.json"), "{}");
      if (mode === "manifest-file-missing")
        fs.unlinkSync(path.join(plugin, "package.json"));
      if (mode === "manifest-json")
        fs.writeFileSync(path.join(plugin, "package.json"), "{");
      if (mode === "replaced") {
        const archive = loan.artifacts[0]!.archive;
        const replacement = path.join(fixture.output, "replacement");
        fs.writeFileSync(replacement, "authored archive");
        fs.unlinkSync(archive);
        fs.renameSync(replacement, archive);
      }
      const run = () =>
        prepareArtifacts(request, {
          directories: ["packages/compiler", "packages/plugin"],
          pack: async (_repository, output) => {
            packed.push("whole toolchain");
            return [
              { name: "standalone", archive: path.join(output, "all.tgz") },
            ];
          },
          packPackage,
        });
      if (
        [
          "corrupt",
          "missing",
          "duplicate",
          "foreign",
          "hash",
          "name",
          "manifest",
          "manifest-compiler",
          "manifest-name-missing",
          "manifest-file-missing",
          "manifest-json",
          "replaced",
        ].includes(mode)
      ) {
        await assert.rejects(
          run,
          mode === "manifest-json"
            ? SyntaxError
            : mode === "missing" || mode === "manifest-file-missing"
              ? /ENOENT/
              : /[Bb]orrowed|Duplicate|manifest name/,
        );
        assert.deepEqual(packed, []);
      } else {
        const result = await run();
        if (mode === "complete") {
          assert.deepEqual(result, { toolchain: full, artifact });
          assert.deepEqual(packed, []);
        } else if (mode === "standalone") {
          assert.deepEqual(packed, ["whole toolchain", "packages/evidence"]);
          assert.equal(result.toolchain[0]!.name, "standalone");
        } else {
          assert.deepEqual(packed, ["packages/plugin", "packages/evidence"]);
          assert.deepEqual(result.toolchain[0], {
            name: "unit-compiler",
            archive: loan.artifacts[0]!.archive,
          });
          assert.equal(
            fs.readFileSync(loan.artifacts[0]!.archive, "utf8"),
            "authored archive",
          );
        }
      }
      loan.release();
    } catch (cause) {
      failures.push(new Error("Preparation routing " + mode, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Compiler archive authority failures");
}
