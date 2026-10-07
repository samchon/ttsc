import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectMembershipDigest } from "../../../../../packages/unplugin/src/core/transform/project/projectMembershipDigest";
import { walkProjectInputs } from "../../../../../packages/unplugin/src/core/transform/project/walkProjectInputs";
import type { TtscWatchInput } from "../../../../../packages/unplugin/src/core/transform/watch/TtscWatchInput";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { createViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/createViteServeInputWatch";
import { TestProject } from "../../../../utils/src/TestProject";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";

/**
 * Verifies a root file appearing is heard as a membership change when the event
 * names it under the project's physical directory while the project was
 * registered under a link to it (samchon/ttsc#1461).
 *
 * A backend that reports physical paths, FSEvents on macOS, names a project
 * reached through a link by its target, every macOS temporary directory among
 * them. The membership entry carries the root as the host named it, and the
 * event was compared to it by string, so no new root file under a linked root
 * ever reached its importers on macOS: measured on the host matrix, where
 * Rollup on a linked root never recompiled for a new root file there. The event
 * is now placed under the root's own name, under either spelling, before its
 * policy is asked.
 *
 * 1. Register a project's membership through a link, and emit a rename for a new
 *    declaration under the physical directory; assert the importer is
 *    invalidated.
 * 2. Emit a rename under the physical directory for a file no program admits, and
 *    assert nothing happens.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Registers project membership under a linked root, injects physical-path rename events and checks new declarations invalidate while unrelated text remains quiet.
 * @evidence contracts/testing.md#independent-expectations
 *   Linked and physical spellings name one project. The admitted declaration changes membership independently of its event spelling; notes.txt cannot change membership.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Includes initially quiet state, physical-path admitted declaration and subsequent non-program text after updated membership proof, catching both missed positive and spurious negative notifications.
 * @evidence contracts/testing.md#execution-ownership
 *   test_vite_compiler_watch_places_a_physical_membership_event_under_the_root calls createViteServeInputWatch.attach/replace over a real temporary link or junction and injects physical-path events; it owns admitted/text outcomes and disposes in finally without a Vite host.
 */
export async function test_vite_compiler_watch_places_a_physical_membership_event_under_the_root(): Promise<void> {
  const physical = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-membership-link-"),
  );
  TestProject.writeFiles(physical, {
    "src/main.ts": "export const value = 1;\n",
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
  });
  const linked = path.join(TestProject.tmpdir("ttsc-link-"), "project");
  fs.symlinkSync(
    physical,
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  const importer = path.join(linked, "src", "main.ts").replace(/\\/g, "/");
  const policy = readProjectMembershipPolicy(
    path.join(linked, "tsconfig.json"),
  );
  const walked = walkProjectInputs(linked, undefined, policy);
  const membership: TtscWatchInput = {
    evidence: {
      identity: linked,
      missing: false,
      state: {
        codec: "membership",
        digest: projectMembershipDigest(policy, walked.directories),
        directories: walked.directories.map((directory) => directory.path),
        policy,
      },
    },
    file: linked,
  };
  const invalidated: string[] = [];
  let emit: ((eventType: string, file: string | null) => void) | undefined;
  const watch = createViteServeInputWatch({
    poll: () => ({ close: () => undefined }),
    watch: (_scope, listener) => {
      emit = listener;
      return { close: () => undefined };
    },
  });
  // The scope is the directory holding the link, as a build bridge opens it
  // on the host's working directory, so the link lies inside it.
  watch.attach({
    config: { root: path.dirname(linked) },
    moduleGraph: {
      getModulesByFile: (file: string) =>
        file === importer ? new Set([{ file }]) : undefined,
      invalidateModule: (node: object) =>
        invalidated.push((node as { file: string }).file),
    },
  });
  try {
    watch.replace(importer, [membership]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(invalidated, [], "an unchanged project is quiet");

    fs.writeFileSync(
      path.join(physical, "src", "globals.d.ts"),
      "declare const extra: number;\n",
    );
    emit?.("rename", path.join(physical, "src", "globals.d.ts"));
    await waitFor(
      () => invalidated.length === 1,
      "a root file reported under the physical directory to invalidate the importer",
    );
    assert.deepEqual(invalidated, [importer]);

    invalidated.length = 0;
    watch.replace(importer, [
      {
        ...membership,
        evidence: {
          ...membership.evidence!,
          state: {
            ...membership.evidence!.state!,
            digest: projectMembershipDigest(
              policy,
              walkProjectInputs(linked, undefined, policy).directories,
            ),
          },
        } as TtscWatchInput["evidence"],
      },
    ]);
    fs.writeFileSync(
      path.join(physical, "src", "notes.txt"),
      "not a program input\n",
    );
    emit?.("rename", path.join(physical, "src", "notes.txt"));
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.deepEqual(
      invalidated,
      [],
      "a file no program admits is not membership under either spelling",
    );
  } finally {
    await watch.dispose();
  }
}
