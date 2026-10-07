import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { ResidentTransformProcess } from "../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";
import {
  TtscCompiler,
  TtscService,
} from "../../../../packages/ttsc/lib/index.js";
import { observeResidentTransformClose } from "../internal/ttsc/internal/observeResidentTransformClose";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Exercise actual public resident requests together on one native host.
 *
 * The authored project is staged with the shared corpus before any consumer.
 * Buffer edits do not alter its disk bytes. An independent caller directory
 * distinguishes project-relative executable selection from process cwd.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual one-shot and resident outputs carry exactly one banner naming the physical Node executable. Repeated, concurrent missing/present, nested/root-link, accepted update, rejected update and terminal requests use real public APIs; a test-only structural read joins the already-created resident child.
 * @evidence contracts/testing.md#independent-expectations Authored SERVICE_BEFORE/SERVICE_AFTER strings, the independently resolved native executable, exact original disk bytes and undefined absence determine answers rather than predicted compiler counts.
 * @evidence contracts/testing.md#distinguishing-cases Present versus missing requests and logical versus physical link paths share one initial generation. A successful overlay contrasts with a type-invalid update that must keep its preceding output. Disposal is distinguished from an actual child-close receipt.
 * @evidence contracts/testing.md#execution-ownership The selected esbuild batch invokes this body once. One public transform and one additional actual resident host use the same upfront project/cache; no host is created per request, alias or assertion. Accepted and rejected updates retain their native generation costs.
 * @evidence contracts/e2e.md#necessary-boundary Real native FIFO replies, compiler-backed updates, executable cwd resolution and filesystem link adaptation cannot be established by reply-parser or path-policy units alone.
 * @evidence contracts/e2e.md#shared-execution One resident owns the whole compatible request matrix. One-shot transformation remains a distinct native connection because that public entry point has different assembly.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The source stays byte-identical while resident-only overlays change. Aliases belong to this cache/project and retire only after actual child close. Close failure retains the shared workspace and prevents later reuse; body and cleanup errors are collected.
 * @evidence contracts/e2e.md#preserved-coverage Restores actual public service repeat/absence/FIFO/update/link/terminal and relative-runtime connections. It does not authenticate failed initial startup, exact native process totals or every old plugin combination.
 */
export async function serviceCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/service");
  const main = path.join(root, "src/main.ts");
  const original = fs.readFileSync(main);
  const nestedAlias = path.join(root, "linked-src");
  const externalAlias = path.join(root, "external-src");
  const rootAlias = path.join(workspace.cache, "service-linked-root");
  fs.symlinkSync(path.join(root, "src"), nestedAlias, "junction");
  fs.symlinkSync(
    path.join(workspace.root, "tools/service-outside"),
    externalAlias,
    "junction",
  );
  fs.symlinkSync(root, rootAlias, "junction");
  const executable = fs.realpathSync.native(process.execPath);
  const relativeNode = path.join("runtime-node", path.basename(executable));
  assert.equal(
    fs.realpathSync.native(path.join(root, relativeNode)),
    executable,
  );
  assert.notEqual(path.resolve(workspace.root, relativeNode), executable);
  const context = {
    cwd: workspace.root,
    projectRoot: rootAlias,
    tsconfig: path.join(rootAlias, "tsconfig.json"),
    env: {
      ...process.env,
      TTSC_CACHE_DIR: workspace.cache,
      TTSC_NODE_BINARY: relativeNode,
    },
  };
  const banner = (text: string): void => {
    assert.equal(
      text.split(executable).length - 1,
      1,
      "the real banner sidecar must resolve its executable against the project root exactly once",
    );
  };
  const failures: unknown[] = [];
  try {
    const transformed = new TtscCompiler(context).transform();
    assert.equal(transformed.type, "success", JSON.stringify(transformed));
    if (transformed.type !== "success")
      throw new Error("one-shot service corpus transform failed");
    const oneShot = transformed.typescript["src/main.ts"];
    assert.ok(oneShot);
    banner(oneShot);
  } catch (error) {
    failures.push(error);
  }
  let service: TtscService | undefined;
  let close: (() => Promise<void>) | undefined;
  let closed = false;
  try {
    service = new TtscService(context);
    close = observeResidentTransformClose(
      (service as unknown as { readonly resident: ResidentTransformProcess })
        .resident,
    );
    const first = await service.transformFile(main, {
      signal: new AbortController().signal,
    });
    assert.ok(first);
    banner(first);
    assert.match(first, /SERVICE_BEFORE/);
    assert.equal(await service.transformFile("src/main.ts"), first);
    assert.equal(
      await service.transformFile(path.join(rootAlias, "src/main.ts")),
      first,
    );
    const [again, missing] = await Promise.all([
      service.transformFile("src/main.ts"),
      service.transformFile("absent.ts"),
    ]);
    assert.equal(again, first);
    assert.equal(missing, undefined);
    assert.equal(
      await service.transformFile(path.join(nestedAlias, "main.ts")),
      first,
    );
    assert.equal(
      await service.transformFile(path.join(externalAlias, "absent.ts")),
      undefined,
    );
    assert.equal(
      await service.updateFile(
        path.join(nestedAlias, "main.ts"),
        'export const marker: string = "SERVICE_AFTER";\n',
      ),
      true,
    );
    const after = await service.transformFile("src/main.ts");
    assert.ok(after);
    banner(after);
    assert.match(after, /SERVICE_AFTER/);
    assert.doesNotMatch(after, /SERVICE_BEFORE/);
    assert.equal(await service.transformFile(main), after);
    assert.equal(
      await service.updateFile(
        main,
        'export const marker: number = "SERVICE_INVALID";\n',
      ),
      false,
    );
    assert.equal(await service.transformFile(main), after);
    service.dispose();
    await assert.rejects(service.transformFile(main));
  } catch (error) {
    failures.push(error);
  } finally {
    if (close !== undefined) {
      try {
        await close();
        closed = true;
      } catch (error) {
        failures.push(error);
        BatchWorkspace.retain(
          "public service child closure remained unresolved",
        );
      }
    }
    if (service === undefined || closed) {
      for (const alias of [nestedAlias, externalAlias, rootAlias]) {
        try {
          fs.unlinkSync(alias);
        } catch (error) {
          failures.push(error);
        }
      }
    }
    try {
      assert.deepEqual(
        fs.readFileSync(main),
        original,
        "resident buffer edits must not mutate authored source bytes",
      );
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "public service corpus failures");
}
