import assert from "node:assert/strict";
import path from "node:path";

import { projectInputMembershipInvalidatesProgram } from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies project-input membership invalidates only possible Program modules.
 *
 * JSON may be both Swagger data and a `resolveJsonModule` source. Its
 * create/delete transitions therefore require a cold Program, while an in-place
 * edit and Markdown/YAML population changes retain warm reuse. A filename-less
 * membership transition is conservatively invalidating because the watcher
 * cannot attribute the delta to a safe filename.
 *
 * 1. Classify JSON and compiler-source population additions/removals.
 * 2. Keep content-only and data-only transitions warm.
 * 3. Require conservative invalidation for an unattributed population change.
 */
export const test_project_input_membership_classifies_program_topology =
  (): void => {
    const root = path.resolve("project-input-membership");
    const json = path.join(root, "api", "openapi.json");
    const typescript = path.join(root, "generated", "contract.ts");
    const javascript = path.join(root, "generated", "contract.mjs");
    const markdown = path.join(root, "docs", "spec.md");
    const packageJson = path.join(root, "package.json");
    const yaml = path.join(root, "api", "openapi.yaml");
    const empty = new Map<string, string>();
    const population = (...locations: string[]): Map<string, string> =>
      new Map(locations.map((location) => [location, location]));

    assert.equal(
      projectInputMembershipInvalidatesProgram({
        changed: json,
        next: population(json),
        previous: empty,
      }),
      true,
      "created JSON may satisfy a resolveJsonModule import",
    );
    assert.equal(
      projectInputMembershipInvalidatesProgram({
        changed: json,
        next: empty,
        previous: population(json),
      }),
      true,
      "deleted JSON may remove a resolveJsonModule import",
    );
    assert.equal(
      projectInputMembershipInvalidatesProgram({
        changed: json,
        changedInputs: [json],
        contentChanged: true,
        next: population(json),
        previous: population(json),
      }),
      false,
      "content-only JSON edits preserve membership and the warm Program",
    );
    assert.equal(
      projectInputMembershipInvalidatesProgram({
        changed: packageJson,
        changedInputs: [packageJson],
        contentChanged: true,
        next: population(packageJson),
        previous: population(packageJson),
      }),
      true,
      "package metadata content must invalidate module resolution",
    );
    for (const source of [typescript, javascript]) {
      assert.equal(
        projectInputMembershipInvalidatesProgram({
          changed: source,
          next: population(source),
          previous: empty,
        }),
        true,
        `${path.extname(source)} membership may reshape the Program`,
      );
    }
    for (const data of [markdown, yaml]) {
      assert.equal(
        projectInputMembershipInvalidatesProgram({
          changed: data,
          next: population(data),
          previous: empty,
        }),
        false,
        `${path.extname(data)} remains a data-only external input`,
      );
    }
    assert.equal(
      projectInputMembershipInvalidatesProgram({
        next: population(markdown),
        previous: empty,
      }),
      true,
      "filename-less membership changes must invalidate conservatively",
    );
  };
