/** Identifies a type or value declared in a project file. */
export interface ITtscLintFileTypeOrValueSpecifier {
  /** Select project-file declarations. */
  from: "file";
  /** Match one or more declared names. */
  name: string | readonly string[];
  /** Restrict the match to this project-relative declaration file. */
  path?: string;
}

/** Identifies a type or value declared by TypeScript's default libraries. */
export interface ITtscLintLibTypeOrValueSpecifier {
  /** Select TypeScript default-library declarations. */
  from: "lib";
  /** Match one or more declared names. */
  name: string | readonly string[];
}

/** Identifies a type or value declared by an installed package. */
export interface ITtscLintPackageTypeOrValueSpecifier {
  /** Select package declarations. */
  from: "package";
  /** Match one or more declared names. */
  name: string | readonly string[];
  /** Require declarations from this package or ambient module. */
  package: string;
}

/** Identifies a type or value by name and, preferably, declaration source. */
export type TtscLintTypeOrValueSpecifier =
  | string
  | ITtscLintFileTypeOrValueSpecifier
  | ITtscLintLibTypeOrValueSpecifier
  | ITtscLintPackageTypeOrValueSpecifier;

/** Options for `typescript/no-floating-promises`. */
export interface ITtscLintTypeScriptNoFloatingPromisesRuleOptions {
  /** Functions whose returned Promises may be discarded safely. */
  allowForKnownSafeCalls?: readonly TtscLintTypeOrValueSpecifier[];
  /** Promise types whose values may be discarded safely. */
  allowForKnownSafePromises?: readonly TtscLintTypeOrValueSpecifier[];
  /** Also inspect catchable structural thenables. Defaults to `false`. */
  checkThenables?: boolean;
  /** Ignore immediately invoked function-expression results. Defaults to `false`. */
  ignoreIIFE?: boolean;
  /** Treat `void` as an explicit discard marker. Defaults to `true`. */
  ignoreVoid?: boolean;
}
