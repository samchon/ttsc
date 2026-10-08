import path from "node:path";
import { pathToFileURL } from "node:url";

import { TestProject } from "../TestProject";

/**
 * Runtime import helpers for the built @ttsc/unplugin package.
 *
 * Adapter tests import the compiled ESM entrypoints through file URLs so they
 * validate the package output exactly as Node will load it after a build.
 *
 * @evidence contracts/common.md#principled-implementation Built package paths become native file URLs before Node imports the real compiled entrypoints.
 * @evidence contracts/common.md#clear-and-simple-design A single namespace groups path selection and the two public import shapes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual emitted package executes; source APIs and fabricated adapter exports are not substituted.
 * @evidence contracts/common.md#meaningful-documentation The paragraph states built-artifact verification through Node ESM loading.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and pathToFileURL separate filesystem spelling from URL encoding, including Windows drives.
 * @evidence contracts/performance.md#efficient-algorithms Path selection is proportional to supplied path text; module loading costs belong to Node and the imported module.
 * @evidence contracts/performance.md#reuse-equivalent-work Node shares modules only by its resolved URL identity; this helper does not reset module state or cache outcomes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Module instances persist in Node's module cache for the process; this owner exposes no module eviction and opens no independent handle.
 */
export namespace TestUnpluginRuntime {
  /**
   * Convert a built unplugin entrypoint into a dynamic-importable file URL.
   *
   * @evidence contracts/common.md#principled-implementation pathToFileURL encodes the native built path as a valid import URL.
   * @evidence contracts/common.md#clear-and-simple-design It delegates built-path selection and owns only filesystem-to-URL conversion.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Node's URL conversion supplies escaping; hand-built URL strings do not substitute native paths.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the dynamic-importable result.
   * @evidence contracts/portability.md#os-neutral-implementation Native drive and separator spelling is converted by pathToFileURL rather than slash replacement.
   * @evidence contracts/performance.md#efficient-algorithms Conversion processes the path text once.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This conversion has no shared request or cached import result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned URL string is allocated; no handle or task is retained.
   */
  export function libUrl(entrypoint: string): string {
    return pathToFileURL(libPath(entrypoint, "mjs")).href;
  }

  /**
   * Resolve a built CommonJS or ESM entrypoint under packages/unplugin/lib.
   *
   * @evidence contracts/common.md#principled-implementation Native resolve anchors a caller-selected built entry and JS module extension to the checkout output directory.
   * @evidence contracts/common.md#clear-and-simple-design One path constructor is shared by file-URL conversion and direct built-file consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The path addresses actual built files; it does not replace missing output or fabricate a module.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the built CommonJS/ESM directory and accepted extension choice.
   * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve handles platform separators; this trusted test helper does not treat entrypoint as an untrusted containment boundary.
   * @evidence contracts/performance.md#efficient-algorithms A constant number of path operations process the supplied entrypoint text.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work No filesystem observation or completed import is cached by this path constructor.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned string carries no retained handle or task.
   */
  export function libPath(entrypoint: string, extension: "js" | "mjs"): string {
    return path.resolve(
      TestProject.WORKSPACE_ROOT,
      "packages/unplugin/lib",
      `${entrypoint}.${extension}`,
    );
  }

  /**
   * Load the built public transform API entrypoint.
   *
   * @evidence contracts/common.md#principled-implementation Dynamic import evaluates the actual api.mjs output and returns its module namespace.
   * @evidence contracts/common.md#clear-and-simple-design The fixed public API entry uses the shared URL owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The api entry is the package contract; no source substitute or expected exports are manufactured.
   * @evidence contracts/common.md#meaningful-documentation The headline states that the public built transform API is loaded.
   * @evidence contracts/portability.md#os-neutral-implementation The delegated file URL preserves native filesystem addressing under Node ESM.
   * @evidence contracts/performance.md#efficient-algorithms One import request delegates module loading and evaluation to Node.
   * @evidence contracts/performance.md#reuse-equivalent-work Node's ESM cache shares the same resolved URL; callers needing fresh mutable module state cannot obtain it from repeated calls.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The import promise settles with Node loading; imported module state persists for the process and has no eviction here.
   */
  export async function loadUnpluginApi(): Promise<any> {
    return import(libUrl("api"));
  }

  /**
   * Load a built adapter entrypoint and return its default plugin factory.
   *
   * @evidence contracts/common.md#principled-implementation The actual selected built module is imported and its default export is returned as the adapter factory.
   * @evidence contracts/common.md#clear-and-simple-design Entry selection and import share the existing URL owner, with one projection of the module namespace.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No adapter stub or source import hides a packaging failure.
   * @evidence contracts/common.md#meaningful-documentation The headline specifies built adapter selection and the default-export result.
   * @evidence contracts/portability.md#os-neutral-implementation The delegated pathToFileURL conversion supplies valid Windows and POSIX import URLs.
   * @evidence contracts/performance.md#efficient-algorithms One import and one property read delegate loading costs to Node.
   * @evidence contracts/performance.md#reuse-equivalent-work The same ESM URL shares its evaluated module; changing entrypoint selects a different module and execution outcomes are not cached.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Module state is Node-process retained; this helper acquires no separately releasable handle or background process.
   */
  export async function loadUnpluginAdapter(entrypoint: string): Promise<any> {
    const mod = await import(libUrl(entrypoint));
    return mod.default;
  }
}
