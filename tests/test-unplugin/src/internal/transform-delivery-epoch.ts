import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject, projectModules } from "./transform-project-cache";

/**
 * One driven delivery-pass session over a fixture project.
 *
 * Every scenario in this module drives the same shape a bundler with a real
 * `buildStart` drives: `beginTtscTransformBuild` once per pass, then every
 * module delivered inside it. The fixture's Go producer appends one byte per
 * whole-project compile, so `compiles()` counts native host invocations rather
 * than a proxy for them.
 */
interface IDeliveryPassSession {
  /** How many whole-project compiles the fixture plugin has run so far. */
  compiles: () => number;
  /** Deliver one module through the public transform API. */
  deliver: (file: string) => Promise<unknown>;
  /** Absolute module paths of the fixture, sorted. */
  modules: string[];
  /** Open the next delivery pass, as a host's `buildStart` does. */
  pass: () => void;
  /** Absolute path of the project root. */
  root: string;
  /** Discard every generation, as a host's real teardown does. */
  close: () => void;
}

/** Start a session over a fresh graph-bearing fixture project. */
async function startDeliveryPassSession(
  fileCount = 4,
): Promise<IDeliveryPassSession> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount, graphFanout: 1 });
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions();
  return {
    close: () => api.resetTtscTransformCache(cache),
    compiles: () =>
      fs.existsSync(project.runLog)
        ? fs.readFileSync(project.runLog, "utf8").length
        : 0,
    deliver: (file: string) =>
      api.transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        options,
        undefined,
        cache,
        { addWatchFile: () => undefined },
      ),
    modules: projectModules(project.root),
    pass: () => api.beginTtscTransformBuild(cache),
    root: project.root,
  };
}

/** Deliver every module of the session inside one pass. */
async function deliverPass(session: IDeliveryPassSession): Promise<void> {
  session.pass();
  for (const file of session.modules) {
    assert.ok(await session.deliver(file), `expected output for ${file}`);
  }
}

/**
 * Asserts samchon/ttsc#1300: repeated passes over an unchanged project reuse
 * the one generation instead of recompiling per pass.
 *
 * This is the whole defect in one measurement. A pass boundary states that each
 * module is requested at most once inside it; it says nothing about whether the
 * compiled program is still correct, which the generation's own recorded
 * snapshot answers. Destroying the generation to assert the first fact cost a
 * whole-project transform on every rebuild of every watching host.
 */
export async function assertRepeatedPassesReuseOneGeneration(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1, "the cold pass compiles once");
    await deliverPass(session);
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      1,
      "a pass that changed no compiler input must reuse the proven generation",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts a pass that edits a delivered module's own source recompiles exactly
 * once, and that the pass after it reuses the replacement.
 *
 * The negative twin of the reuse case: retention must not outlive the state it
 * was proven against, and the module whose bytes changed is the one input the
 * bundler itself supplies, so it is caught by the source comparison before any
 * proof runs.
 */
export async function assertAPassRecompilesAfterAModuleEdit(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    const edited = session.modules[0]!;
    fs.appendFileSync(edited, "\nexport const added = 1;\n", "utf8");
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      2,
      "an edited module must replace the generation exactly once",
    );

    await deliverPass(session);
    assert.equal(
      session.compiles(),
      2,
      "the pass after the edit must reuse the replacement",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts a pass recompiles when a type-only input changes, even though the
 * bundler never delivers that file.
 *
 * The input class the whole reference graph exists for: a bundler erases a
 * type-only edge from its own module graph, so nothing but the generation's
 * recorded snapshot can notice the edit. A retained generation that missed it
 * would serve generated code compiled against the old type.
 */
export async function assertAPassRecompilesAfterATypeOnlyInputEdit(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    // A sibling reached only through the fixture's graph edges, never through
    // an import the bundler could see, and never delivered in this pass.
    const typeOnly = session.modules[session.modules.length - 1]!;
    fs.appendFileSync(typeOnly, "\nexport const shifted = true;\n", "utf8");

    session.pass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.compiles(),
      2,
      "an edited type-only input must replace the generation before the next pass delivers anything",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts a pass recompiles when project membership changes.
 *
 * A created file is the one change a content comparison cannot see, because it
 * has no recorded entry to differ from. The directory-membership half of the
 * generation's snapshot is what answers for it, and the pass gate has to
 * consult that half rather than the input hashes alone.
 */
export async function assertAPassRecompilesAfterAMembershipChange(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    fs.writeFileSync(
      path.join(session.root, "src", "appeared.ts"),
      "export const appeared = 1;\n",
      "utf8",
    );
    session.pass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.compiles(),
      2,
      "a file entering the project must replace the generation",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts a pass keeps the generation when a project file the compile never
 * consumed changes.
 *
 * A project root is a working directory: logs, coverage reports and generated
 * artifacts are written there constantly. Only a file the generation declares
 * as an input can change an output, so re-proving against the whole walk
 * instead of the declared set would hand back the per-pass recompile this
 * change removes, for a file nothing compiled.
 *
 * This pins the declared-input filter rather than the membership digest, and it
 * held before that digest existed too: rewriting a file in place moves neither
 * the directory's stamp nor its entry list. The digest's own twin is
 * {@link assertAPassIgnoresAnAppearingOutputDirectory}.
 */
export async function assertAPassIgnoresAnUndeclaredProjectFileEdit(): Promise<void> {
  const session = await startDeliveryPassSession();
  const note = path.join(session.root, "src", "build-log.txt");
  fs.writeFileSync(note, "first\n", "utf8");
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    // Rewritten in place: the file already existed when the generation was
    // captured, so membership is unchanged and only its content moves.
    fs.writeFileSync(note, "second, longer than the first\n", "utf8");
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      1,
      "a project file the generation never declared as an input must not cost a compile",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts a pass keeps the generation when a bundler creates its output
 * directory inside the project.
 *
 * The membership proof has to honour the same ignore list the walk does. A
 * directory's own stamp moves whenever any entry is added or removed, including
 * the ones the walk exists to ignore, so comparing raw directory metadata meant
 * a bundler emitting into `dist/` — or merely creating it for the first time —
 * moved the project root's stamp and voided a generation no compiler input had
 * touched. That is not a corner case: it is what every host that writes its
 * bundle into the project does on its first build, which is precisely the build
 * before the first rebuild this whole change exists to make cheap.
 *
 * Its negative twin is {@link assertAPassRecompilesAfterAMembershipChange}: a
 * file the walk does consider must still replace the generation.
 */
export async function assertAPassIgnoresAnAppearingOutputDirectory(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    for (const ignored of ["dist", "out", "coverage", ".cache"]) {
      const directory = path.join(session.root, ignored);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "bundle.js"), "// emitted", "utf8");
    }
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      1,
      "a bundler creating its own output directory must not void the generation",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts a new pass grants an unstable generation one fresh attempt.
 *
 * The two terminal verdict kinds part company across a pass boundary, and this
 * is the half that is easy to lose. A failed _compile_ is the host's answer
 * about inputs it read, so a new pass replays it. An unstable generation is the
 * adapter failing to obtain a coherent snapshot, which is a race it lost and a
 * later attempt may well win, so a new pass has to try again. That fresh
 * attempt is exactly what the per-pass cache clear used to provide for free,
 * and removing the branch that grants it would leave every existing case
 * green.
 *
 * The run log counts attempts rather than deliveries: the compile itself
 * succeeds here, and only the project-walk snapshot around it is torn, so each
 * bounded wave appends two entries.
 */
export async function assertANewPassRetriesAnUnstableGeneration(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const transientDirectory = path.join(project.root, "src", "transient");
  fs.mkdirSync(transientDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(transientDirectory, "hidden.ts"),
    "declare const hiddenDuringSnapshot: string;\n",
    "utf8",
  );
  // The walk of this one directory fails for as long as it stays blocked, so
  // no attempt can ever prove a coherent snapshot and the generation stays
  // terminal without anything else about the project changing.
  let blocked = true;
  const cache = api.createTtscTransformCache({
    readdir: (location: string) => {
      if (
        path.resolve(location) === transientDirectory &&
        blocked &&
        fs.existsSync(project.runLog)
      ) {
        throw new Error("pass-boundary project snapshot failure");
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const modules = projectModules(project.root);
  const options = api.resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  const attempts = () =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );

  try {
    api.beginTtscTransformBuild(cache);
    let terminal: Error | undefined;
    await assert.rejects(
      () => deliver(modules[0]!),
      (error: Error) => {
        terminal = error;
        assert.match(error.message, /after 2 attempts/);
        return true;
      },
    );
    const spent = attempts();
    assert.ok(spent >= 2, "the first pass must spend its bounded attempts");

    // Same pass, unchanged environment: the verdict answers without recompiling.
    await assert.rejects(
      () => deliver(modules[1]!),
      (error: Error) => error === terminal,
    );
    assert.equal(
      attempts(),
      spent,
      "an unchanged environment must not start another wave inside the pass",
    );

    // A new pass is a fresh attempt, even though nothing about the project
    // moved. This is the branch the per-pass clear used to provide.
    api.beginTtscTransformBuild(cache);
    await assert.rejects(() => deliver(modules[0]!), /after 2 attempts/);
    assert.ok(
      attempts() > spent,
      "a new pass must grant an unstable generation a fresh attempt",
    );

    // And recovery still lands once the walk stops failing.
    blocked = false;
    api.beginTtscTransformBuild(cache);
    assert.ok(
      await deliver(modules[0]!),
      "a recovered project walk must produce a real generation",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/**
 * Asserts a pass recompiles when a source leaves the project, or changes kind,
 * and does not when a file that could never enter the program leaves.
 *
 * A removal has no recorded hash to differ from and a kind swap keeps the name,
 * so both are invisible to the content comparison and the digest is the only
 * thing that answers for them. What the digest answers for is program
 * membership, so the two halves of that sentence are not the same file: a
 * source leaving is a membership change, while a stray `.txt` leaving is not,
 * any more than editing one is (samchon/ttsc#1307). Before that the digest
 * recorded every entry name, which made this pair disagree with its own
 * sibling: the same undeclared file was free to edit and cost a whole-project
 * compile to delete.
 */
export async function assertAPassRecompilesAfterAMembershipRemoval(): Promise<void> {
  const session = await startDeliveryPassSession();
  const note = path.join(session.root, "src", "notes.txt");
  fs.writeFileSync(note, "planted before the generation\n", "utf8");
  try {
    await deliverPass(session);
    assert.equal(session.compiles(), 1);

    // A file the program could never contain, and never declared as an input.
    fs.rmSync(note);
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      1,
      "a file that could not enter the program must not cost a compile when it leaves",
    );

    const source = path.join(session.root, "src", "extra.ts");
    fs.writeFileSync(source, "export const extra: number = 1;", "utf8");
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      2,
      "a source entering the project must replace the generation",
    );

    fs.rmSync(source);
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      3,
      "a source leaving the project must replace the generation",
    );

    // Same name, different kind, with both kinds carrying program inputs: a
    // source file becomes a directory holding one. The content comparison
    // cannot see this, since the name's hash simply stops existing and a new
    // one appears elsewhere, so the digest is the only thing that answers.
    fs.writeFileSync(source, "export const extra: number = 2;", "utf8");
    await deliverPass(session);
    assert.equal(session.compiles(), 4, "the source returning is a change too");

    fs.rmSync(source);
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(source, "inner.ts"),
      "export const inner: number = 1;",
      "utf8",
    );
    await deliverPass(session);
    assert.equal(
      session.compiles(),
      5,
      "an entry changing kind must replace the generation",
    );
  } finally {
    session.close();
  }
}

/**
 * Asserts a module delivered twice inside one pass still revalidates on its
 * second delivery.
 *
 * The constant-time shortcut is a statement about a module's _first_ delivery
 * in a pass. A bundler asking again is the one signal the pass itself provides
 * that something may have moved, so the retained generation must not silently
 * answer it from the pass gate.
 */
export async function assertARepeatedDeliveryInsideAPassRevalidates(): Promise<void> {
  const session = await startDeliveryPassSession();
  try {
    const first = session.modules[0]!;
    session.pass();
    assert.ok(await session.deliver(first));
    assert.equal(session.compiles(), 1);

    fs.appendFileSync(
      path.join(session.root, "plugin.cjs"),
      "\n// changed inside the pass\n",
      "utf8",
    );
    assert.ok(await session.deliver(first));
    assert.equal(
      session.compiles(),
      2,
      "a module delivered twice in one pass must validate on its second delivery",
    );
  } finally {
    session.close();
  }
}
