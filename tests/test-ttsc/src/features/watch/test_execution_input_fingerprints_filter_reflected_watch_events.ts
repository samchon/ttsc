import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  executionInputEventShouldNotify,
  fingerprintExecutionInputs,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies source-plugin events are reconciled against one build generation.
 *
 * 1. Drop delayed file and filename-less events for bytes already consumed.
 * 2. Detect a real post-boundary edit through the O(file) path.
 * 3. Coalesce its duplicate native notification.
 * 4. Detect subtree membership while leaving unrelated siblings quiet.
 */
export const test_execution_input_fingerprints_filter_reflected_watch_events =
  (): void => {
    const root = TestProject.tmpdir("ttsc-execution-input-fingerprint-");
    const source = path.join(root, "plugin");
    const main = path.join(source, "main.go");
    const nested = path.join(source, "internal", "helper.go");
    const unrelated = path.join(root, "README.md");
    fs.mkdirSync(path.dirname(nested), { recursive: true });
    fs.writeFileSync(main, "package main\n", "utf8");
    fs.writeFileSync(nested, "package internal\n", "utf8");
    fs.writeFileSync(unrelated, "outside\n", "utf8");

    const fingerprints = fingerprintExecutionInputs([source]);
    const notify = (changed?: string, watchRoot = source): boolean =>
      executionInputEventShouldNotify({
        changed,
        fingerprints,
        inputs: [source],
        watchRoot,
      });

    assert.equal(notify(main), false, "a reflected file event must be dropped");
    assert.equal(
      notify(undefined),
      false,
      "a reflected filename-less root event must be dropped",
    );
    assert.equal(
      notify(unrelated),
      false,
      "an event outside the declared execution input must stay quiet",
    );

    fs.writeFileSync(main, "package main\n\nvar generation = 2\n", "utf8");
    assert.equal(notify(main), true, "a post-boundary edit must reload");
    assert.equal(notify(main), false, "its duplicate event must be coalesced");

    const created = path.join(source, "internal", "created.go");
    fs.writeFileSync(created, "package internal\n", "utf8");
    assert.equal(
      notify(undefined, path.dirname(created)),
      true,
      "a filename-less subtree event must detect new membership",
    );
    fs.rmSync(created);
    assert.equal(
      notify(path.dirname(created)),
      true,
      "a directory event must detect removed membership",
    );
  };
