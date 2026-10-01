import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

/**
 * Scenarios for the out-of-walk cache validation
 * (`TtscCachedProjectTransform.externalInputHashes`, samchon/ttsc#721).
 *
 * The project-walk snapshot cannot see inputs outside the project root or under
 * ignored directories, yet the reference graph and the plugin-reported
 * dependencies prove they feed the transform. Hosts without a per-build cache
 * boundary (Metro workers and the Turbopack loader) keep one cache for the
 * process lifetime, so validation itself must re-hash those inputs.
 */

/** Create a project plus a transform input file outside its root. */
export function createProjectWithExternalInput(content: string): {
  external: string;
  relative: string;
  root: string;
} {
  const shared = TestProject.tmpdir("ttsc-unplugin-external-");
  const external = path.join(shared, "helper.ts");
  fs.writeFileSync(external, content, "utf8");
  const root = TestUnpluginProject.createProject({ plugins: [] });
  return {
    external,
    relative: path.relative(root, external).split(path.sep).join("/"),
    root,
  };
}
