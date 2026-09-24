import fs from "node:fs";
import path from "node:path";

import { fixture } from "./common.mjs";
import { restartContract, restartCycle } from "./restarts.mjs";

/**
 * The restart contract where the host's record directory cannot be written: a
 * file stands where `.ttsc/records` would be in the host's root, which makes
 * the record's write fail on every platform without relying on permissions
 * (samchon/ttsc#1480). The rest of `.ttsc` stays a directory: the fixture's
 * plugin counts its compiles in `.ttsc/contract-runs`, and a file standing for
 * all of `.ttsc` failed every compile before any record was written.
 *
 * A module handed to a host without its project's record depends on its own
 * bytes alone, so the adapter keeps one elsewhere, by what the host accepts:
 *
 * - Webpack takes a record anywhere spelled as its root is, so the record lives
 *   in the fallback below the user's temporary directory, and the whole restart
 *   contract holds as it does over a writable root: the compile bound, inputs
 *   edited while stopped, and the tsconfig edited while the session runs.
 * - Farm takes one it can relate to its root. Where the temporary directory
 *   shares the root's drive the fallback serves, and a session restarted after
 *   an input edited while stopped serves the edit. Where it does not, a Windows
 *   runner with the checkout on another drive, no record can exist: the adapter
 *   turns Farm's persistent cache off and says so, and a watching session
 *   refuses its modules, naming the directory. Which of the two the adapter
 *   found is what it reports, and the session holds it to that
 *   (`restart-cycle.mjs`).
 * - Turbopack takes none outside its root, so a development session refuses its
 *   modules rather than serve output it cannot keep current.
 *
 * @param host One of `webpack`, `farm`, `next-turbopack`.
 */
export async function unwritableContract(host) {
  const project = fixture(`${host}-unwritable`, { plugin: "linked" });
  fs.mkdirSync(path.join(project.root, ".ttsc"), { recursive: true });
  fs.writeFileSync(
    path.join(project.root, ".ttsc", "records"),
    "not a directory\n",
  );
  if (host === "next-turbopack") {
    await restartCycle(project, host, "an unwritable tool directory", {
      kind: "failed",
      pattern: "cannot be written",
    });
    return;
  }
  if (host === "farm") {
    await restartCycle(project, host, "an unwritable tool directory", {
      kind: "settled",
      refusedWithoutRecords: true,
      store: true,
      value: "FIRST",
    });
    project.change("SECOND");
    await restartCycle(project, host, "input edited while stopped", {
      kind: "settled",
      refusedWithoutRecords: true,
      value: "SECOND",
    });
    return;
  }
  await restartContract(project, host);
}
