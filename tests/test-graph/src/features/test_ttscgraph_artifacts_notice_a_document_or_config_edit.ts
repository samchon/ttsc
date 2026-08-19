import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const graphLib = path.dirname(require.resolve("@ttsc/graph"));
const { artifactsAreStale, fingerprintInputs } = require(
  path.join(graphLib, "model", "publishedArtifacts.js"),
) as {
  artifactsAreStale(published: {
    file: string;
    inputs: IArtifactInputs;
    fingerprint: string;
  }): boolean;
  fingerprintInputs(inputs: IArtifactInputs): string;
};

interface IArtifactInputs {
  files: string[];
  directories: string[];
}

/**
 * Verifies the published artifact set goes stale on the edits that move it, and
 * only on those.
 *
 * A resident session is invalidated by the compiler's build universe, and the
 * documents behind an artifact are deliberately not in it — that is the property
 * that keeps renaming a Markdown heading from costing a typecheck. The cost is
 * that no compiler input moves when the heading does, so unless something else
 * watches those paths, the graph answers with the heading the document used to
 * have for as long as the editor stays open.
 *
 * Both halves are asserted, because both halves are defects. Missing an edit
 * leaves a stale graph; reporting one that did not happen re-runs the publisher
 * on every request, which is a sidecar spawn per graph call for a project that
 * changed nothing.
 *
 * The added and deleted cases are the reason directories are walked rather than
 * files listed: a per-file state cannot notice a document that did not exist
 * when the list was taken.
 *
 * 1. Build a project with a lint configuration and a document tree.
 * 2. Take the state, and require it fresh against itself.
 * 3. Edit a document, add one, delete one, and edit the configuration.
 * 4. Require each to read stale, and an unrelated file's edit not to.
 */
export const test_ttscgraph_artifacts_notice_a_document_or_config_edit =
  (): void => {
    const root = TestProject.tmpdir("ttscgraph-artifact-inputs-");
    const config = path.join(root, "lint.config.ts");
    const docs = path.join(root, "docs");
    const sale = path.join(docs, "sale.md");
    const nested = path.join(docs, "nested", "refund.md");
    const unrelated = path.join(root, "src", "main.ts");

    write(config, "export default { rules: {} };\n");
    write(sale, "# Sale\n\n## Pricing\n");
    write(nested, "# Refund\n");
    write(unrelated, "export const value = 1;\n");

    const inputs: IArtifactInputs = { directories: [docs], files: [config] };
    const published = {
      file: path.join(root, "artifacts.json"),
      fingerprint: fingerprintInputs(inputs),
      inputs,
    };

    assert.equal(
      artifactsAreStale(published),
      false,
      "a set read stale against the very state it was published from; every request would republish it",
    );

    // An unrelated source edit is the compiler's business and not this one's.
    // Reporting it here would tie the publisher's cost to the edit loop it was
    // designed to stay out of.
    write(unrelated, "export const value = 2;\n");
    assert.equal(
      artifactsAreStale(published),
      false,
      "a source edit outside the declared inputs was treated as a document change",
    );

    verifyStale(published, "an edited document", () =>
      write(sale, "# Sale\n\n## Discounts\n"),
    );
    verifyStale(published, "a document added below a declared tree", () =>
      write(path.join(docs, "nested", "coupon.md"), "# Coupon\n"),
    );
    verifyStale(published, "a deleted document", () => fs.rmSync(nested));
    verifyStale(published, "an edited lint configuration", () =>
      write(config, "export default { rules: { evidence: {} } };\n"),
    );
  };

/**
 * Apply one edit, require the set to read stale, then republish so the next
 * case starts from a fresh state and proves its own edit rather than inheriting
 * the previous one's staleness.
 */
function verifyStale(
  published: { inputs: IArtifactInputs; fingerprint: string },
  what: string,
  edit: () => void,
): void {
  edit();
  assert.equal(
    artifactsAreStale(published),
    true,
    `${what} left the published artifacts reading fresh`,
  );
  published.fingerprint = fingerprintInputs(published.inputs);
}

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
}
