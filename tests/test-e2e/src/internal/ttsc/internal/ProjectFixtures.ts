import { TestProject } from "@ttsc/testing";
import path from "node:path";

/**
 * Copies a static authored project into a fresh temporary directory.
 *
 * Authored ttsc E2E projects live under `fixtures/ttsc/projects`. The Go source
 * plugin projects belong to the Go package that owns their sources and live
 * under `packages/ttsc/test`, so the lookup names them explicitly instead of
 * guessing from a missing directory.
 */
export namespace ProjectFixtures {
  const PACKAGE_OWNED = new Set([
    "go-source-plugin",
    "go-source-plugin-managed-replace",
    "go-driver-emit-plugin",
  ]);

  /**
   * Copy the named project to a tracked temporary directory and return it.
   *
   * @evidence contracts/common.md#principled-implementation The copy is the checked-in project byte for byte through the existing directory copier, so scenarios start from authored inputs and only add their own links and edits.
   * @evidence contracts/common.md#clear-and-simple-design One lookup rule selects between the two owners of authored projects; callers pass only a name.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No expected output is stored with a project and no name is special-cased beyond the explicit package-owned list.
   * @evidence contracts/common.md#meaningful-documentation Explains the two fixture owners and the explicit list.
   * @evidence contracts/portability.md#os-neutral-implementation Node path joins and the shared copier produce native paths; symbolic links are not part of these projects and scenarios create their own.
   * @evidence contracts/performance.md#efficient-algorithms Visits each fixture file once.
   * @evidence contracts/performance.md#reuse-equivalent-work Copying is required because each scenario mutates or builds inside its own copy; expensive native builds come from the content-keyed shared cache, not from here.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The destination is a tracked temporary directory removed at process exit unless a scenario retains it for a live process through TestProject.
   */
  export function copy(name: string): string {
    const source = PACKAGE_OWNED.has(name)
      ? path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "test", name)
      : path.resolve(import.meta.dirname, "../../../../fixtures/ttsc/projects", name);
    const root = TestProject.tmpdir(`ttsc-${name}-`);
    TestProject.copyDirectory(source, root);
    return root;
  }
}
