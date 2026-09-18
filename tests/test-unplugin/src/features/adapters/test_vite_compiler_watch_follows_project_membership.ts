import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectMembershipDigest } from "../../../../../packages/unplugin/lib/core/transform/project/projectMembershipDigest.js";
import { walkProjectInputs } from "../../../../../packages/unplugin/lib/core/transform/project/walkProjectInputs.js";
import type { TtscWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.js";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.js";
import { createViteServeInputWatch } from "../../../../../packages/unplugin/lib/core/vite/createViteServeInputWatch.js";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";

/**
 * Verifies the compiler-input watcher hears a new root file the tsconfig
 * includes, and nothing else, and invalidates its importers without an HMR
 * update (samchon/ttsc#1419).
 *
 * The compiler reports no listing of the directories `include` expands, so a
 * new global declaration changed no compiler input, and neither the dev server
 * nor a watching build's bridge ever re-ran the modules whose generated code it
 * changes. A project's root-file membership is now one input: its events are
 * judged by the transform's own membership rule, and its check re-walks the
 * project. Most new files change no other module, so the importers are only
 * invalidated, and the next request re-transforms them.
 *
 * 1. Register a project's membership, then create a bundle in an excluded output
 *    directory, a file no program admits, and an edit to a source, and assert
 *    none invalidates anything.
 * 2. Create a declaration in the included directory and assert every environment
 *    invalidates the importer, with no reload and no message.
 * 3. Re-register, create an empty subdirectory and assert nothing happens, then
 *    create a source inside it and assert the importer is invalidated again.
 */
export async function test_vite_compiler_watch_follows_project_membership(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-membership-"),
  );
  TestProject.writeFiles(root, {
    "dist/.keep": "",
    "src/main.ts": "export const value = 1;\n",
    "tsconfig.json": JSON.stringify({
      compilerOptions: { outDir: "dist" },
      include: ["src"],
    }),
  });
  const at = (...segments: string[]): string => path.join(root, ...segments);
  const importer = at("src", "main.ts").replace(/\\/g, "/");
  const policy = readProjectMembershipPolicy(at("tsconfig.json"));
  const membership = (): TtscWatchInput => {
    const walked = walkProjectInputs(root, undefined, policy);
    return {
      evidence: {
        identity: root,
        missing: false,
        state: {
          codec: "membership",
          digest: projectMembershipDigest(policy, walked.directories),
          directories: walked.directories.map((directory) => directory.path),
          policy,
        },
      },
      file: root,
    };
  };

  const invalidated: string[] = [];
  const reloaded: string[] = [];
  const messages: string[] = [];
  let emit: ((eventType: string, file: string | null) => void) | undefined;
  const environment = (name: string) => ({
    hot: { send: (payload: { type: string }) => messages.push(payload.type) },
    moduleGraph: {
      getModulesByFile: (file: string) =>
        file === importer ? new Set([{ file, name }]) : undefined,
      invalidateModule: (node: object) =>
        invalidated.push((node as { name: string }).name),
    },
    reloadModule: async (node: object) => {
      reloaded.push((node as { name: string }).name);
    },
  });
  const watch = createViteServeInputWatch({
    poll: () => ({ close: () => undefined }),
    watch: (_scope, listener) => {
      emit = listener;
      return { close: () => undefined };
    },
  });
  watch.attach({
    config: { root },
    environments: { client: environment("client"), ssr: environment("ssr") },
  });
  /** Let the watcher's flush run, then report what it did. */
  const settled = async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { invalidated: [...invalidated].sort(), messages, reloaded };
  };
  const none = { invalidated: [], messages: [], reloaded: [] };
  try {
    watch.replace(importer, [membership()]);
    assert.deepEqual(await settled(), none, "an unchanged project is quiet");

    fs.writeFileSync(at("dist", "main.js"), "export {};\n");
    emit?.("rename", at("dist", "main.js"));
    fs.writeFileSync(at("src", "notes.txt"), "not a program input\n");
    emit?.("rename", at("src", "notes.txt"));
    fs.writeFileSync(at("src", "main.ts"), "export const value = 2;\n");
    emit?.("change", at("src", "main.ts"));
    assert.deepEqual(
      await settled(),
      none,
      "output, a file no program admits, and an edit are not membership",
    );

    fs.writeFileSync(
      at("src", "globals.d.ts"),
      "declare const extra: number;\n",
    );
    emit?.("rename", at("src", "globals.d.ts"));
    await waitFor(
      () => invalidated.length === 2,
      "the importer to be invalidated",
    );
    assert.deepEqual(await settled(), {
      invalidated: ["client", "ssr"],
      messages: [],
      reloaded: [],
    });

    invalidated.length = 0;
    watch.replace(importer, [membership()]);
    fs.mkdirSync(at("src", "feature"));
    emit?.("rename", at("src", "feature"));
    assert.deepEqual(
      await settled(),
      none,
      "an empty directory holds no root file yet",
    );
    fs.writeFileSync(at("src", "feature", "view.ts"), "export {};\n");
    emit?.("rename", at("src", "feature", "view.ts"));
    await waitFor(
      () => invalidated.length === 2,
      "a source in the new directory to invalidate the importer",
    );
  } finally {
    await watch.dispose();
  }
}
