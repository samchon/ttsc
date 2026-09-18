import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startMembershipSession } from "../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies an overlay `outDir` replaces the inherited directory exclusion and
 * that validation reads only what it compares.
 *
 * Two properties in one session, because both are about the effective program.
 * The replacement directory must remain outside the walk while the inherited
 * one becomes eligible again. A directory the walk enters must still not cost a
 * read per irrelevant file: validation compares content over the generation's
 * declared inputs alone, so reading anything else is wasted work.
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
