/**
 * Props for the Monaco-based source editor. The site provides `extraLibs` —
 * typically the typia `.d.ts` pack and any installed npm package `.d.ts` files
 * — and the editor mounts them via
 * `monaco.languages.typescript.typescriptDefaults.addExtraLib`.
 */
export interface ISourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Map of file path → declaration text. Mounted into Monaco's TypeScript
   * extra-libs registry. Hot-replaceable: the editor disposes the previous libs
   * and re-mounts when the map identity changes.
   */
  extraLibs?: Record<string, string>;
  /** Editor model URI. Defaults to `file:///src/playground.ts`. */
  path?: string;
}
