import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startMembershipSession } from "../../../../internal/unplugin/internal/transform-program-membership/startMembershipSession";

/**
 * Verifies an overlay `outDir` replaces the inherited exclusion, and validation
 * reads only what it compares.
 *
 * Both properties are about the effective program. The overlay's directory must
 * stay outside the walk while the inherited one becomes eligible again. A
 * directory the walk enters must still not cost a read per irrelevant file,
 * because validation compares content over the generation's declared inputs
 * alone.
 *
 * 1. Run passes over a project whose inherited `outDir` is `src`, overlaid with
 *    `generated`, and fill `generated` with emitted files.
 * 2. Assert the overlay directory voids nothing and validation reads no file it
 *    never compares.
 * 3. Add, edit, and remove a source under the inherited `outDir`, and assert each
 *    is detected.
 *
 * @evidence contracts/testing.md#behavioral-verification Overlay generated outDir and forty irrelevant JS assets preserve count one/read bound; admitted src source add/edit/remove yields counts two/three/four.
 * @evidence contracts/testing.md#independent-expectations Effective overlay replaces inherited src exclusion; independent native/read counters distinguish ignored traffic and admitted input.
 * @evidence contracts/testing.md#distinguishing-cases Inherited/overlay outDirs, emitted files, non-admitted assets and source creation/edit/deletion.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_the_walk_avoids_work_it_cannot_use is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for inherited/overlay outDirs, emitted files, non-admitted assets and source creation/edit/deletion. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. Session.close runs in finally and resets its cache observers; tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Overlay generated outDir and forty irrelevant JS assets preserve count one/read bound; admitted src source add/edit/remove yields counts two/three/four. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_the_walk_avoids_work_it_cannot_use(): Promise<void> {
  const session = await startMembershipSession(
    { outDir: "src" },
    { outDir: "${configDir}\\generated" },
  );
  try {
    await session.pass();
    await session.pass();
    const settled = session.reads();

    const excluded = path.join(session.root, "generated");
    fs.mkdirSync(excluded, { recursive: true });
    for (let index = 0; index < 40; index += 1) {
      fs.writeFileSync(
        path.join(excluded, `chunk-${index}.js`),
        `// ${index}\n`,
        "utf8",
      );
    }
    fs.writeFileSync(
      path.join(excluded, "emitted.ts"),
      "export const emitted: number = 1;\n",
      "utf8",
    );
    await session.pass();
    assert.equal(
      session.compiles(),
      1,
      "the configured outDir must not void the generation",
    );

    // The inherited outDir no longer excludes this directory after the caller
    // replaces that option. Files this project cannot compile still do not
    // change membership, and validation must not read them.
    const walked = path.join(session.root, "src");
    fs.mkdirSync(walked, { recursive: true });
    const before = session.reads();
    for (let index = 0; index < 40; index += 1) {
      fs.writeFileSync(
        path.join(walked, `asset-${index}.js`),
        `// ${index}\n`,
        "utf8",
      );
    }
    await session.pass();
    assert.equal(
      session.compiles(),
      1,
      "a directory that cannot hold program inputs must not void the generation",
    );
    assert.ok(
      session.reads() - before <= settled,
      `validation must not read files it never compares (read ${session.reads() - before}, settled pass reads ${settled})`,
    );

    // The moment that same directory gains a source, it counts. This is the
    // inherited-output replacement boundary: preserving the old outDir in the
    // merged policy would miss the creation, every later edit, and removal.
    const admitted = path.join(walked, "late.ts");
    fs.writeFileSync(admitted, "export const late: number = 1;", "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      2,
      "a source appearing under the replaced inherited outDir must be detected",
    );

    fs.writeFileSync(admitted, "export const late: number = 2;", "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "editing a source under the replaced inherited outDir must be detected",
    );

    fs.rmSync(admitted);
    await session.pass();
    assert.equal(
      session.compiles(),
      4,
      "removing a source under the replaced inherited outDir must be detected",
    );
  } finally {
    session.close();
  }
}
