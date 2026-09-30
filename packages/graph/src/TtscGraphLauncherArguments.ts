import {
  type IProjectOptions,
  PROJECT_OPTIONS,
  nonNegativeIntegerOption,
  parseLauncherOptions,
  positiveIntegerOption,
  projectOptions,
} from "./launcherArgs";

/**
 * Project, viewer and dump argument contracts consumed by the real launchers.
 *
 * @evidence contracts/common.md#principled-implementation Existing explicit grammar and typed validators qualify project coordinates before real launch work; dump tokens and completion preserve the native contract.
 * @evidence contracts/common.md#clear-and-simple-design This namespace owns launcher grammar, dump launch-vector construction and completion mapping; native process execution remains with runGraph/view.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual facades consume these operations without alternate test entrypoints, executable stand-ins or weakened grammar.
 * @evidence contracts/common.md#meaningful-documentation Member prose identifies coordinate defaults, argv preservation and native completion ownership needed by the facades.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The namespace groups contracts; its members own native path and process-value representation.
 */
export namespace TtscGraphLauncherArguments {
  /**
   * Parse MCP project coordinates with the shared cwd/config defaults.
   *
   * @evidence contracts/common.md#principled-implementation The shared PROJECT_OPTIONS grammar rejects unknown or incomplete tokens before projectOptions supplies its supported defaults.
   * @evidence contracts/common.md#clear-and-simple-design Only the shared project grammar is selected; startServer retains lazy native lifetime ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing public flag and result contracts are used by actual facades without fixture branches or a synthetic producer.
   * @evidence contracts/common.md#meaningful-documentation The native headline states this operation's input/result ownership and relevant absence/default meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Project normalization delegates to Node path.resolve; selected config spelling remains intact, with no shell or separator rewriting.
   */
  export function project(argv: readonly string[]): IProjectOptions {
    return projectOptions(parseLauncherOptions(argv, PROJECT_OPTIONS));
  }

  /**
   * Parse dump project coordinates without altering forwarded tokens.
   *
   * @evidence contracts/common.md#principled-implementation The original dump grammar accepts its cwd/config aliases, pretty booleans and help flags, rejecting incomplete or unknown options before resolution.
   * @evidence contracts/common.md#clear-and-simple-design Dump validation returns coordinates; dumpVector separately preserves the caller tokens actually sent to the producer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing public flag and result contracts are used by actual facades without fixture branches or a synthetic producer.
   * @evidence contracts/common.md#meaningful-documentation The native headline states this operation's input/result ownership and relevant absence/default meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Project normalization delegates to Node path.resolve; selected config spelling remains intact, with no shell or separator rewriting.
   */
  export function dump(argv: readonly string[]): IProjectOptions {
    return projectOptions(parseLauncherOptions(argv, DUMP_OPTIONS));
  }

  /**
   * Parse viewer coordinates and bounded numeric options with existing defaults.
   *
   * @evidence contracts/common.md#principled-implementation The original viewer grammar plus safe integer validators retains port zero through 65,535 and positive maxNodes through Number.MAX_SAFE_INTEGER before graph work.
   * @evidence contracts/common.md#clear-and-simple-design Project defaults and numeric policy share existing owners; the viewer retains build, reduction and HTTP lifetime.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing public flag and result contracts are used by actual facades without fixture branches or a synthetic producer.
   * @evidence contracts/common.md#meaningful-documentation The native headline states this operation's input/result ownership and relevant absence/default meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Project normalization delegates to Node path.resolve; selected config spelling remains intact, with no shell or separator rewriting.
   */
  export function view(argv: readonly string[]): IViewOptions {
    const values = parseLauncherOptions(argv, [
      { key: "cwd", flags: ["--cwd"], kind: "value" },
      { key: "tsconfig", flags: ["--tsconfig", "-p"], kind: "value" },
      { key: "port", flags: ["--port"], kind: "value" },
      { key: "open", flags: ["--no-open"], kind: "flag" },
      { key: "max_nodes", flags: ["--max-nodes"], kind: "value" },
    ]);
    return {
      ...projectOptions(values),
      port: values.has("port") === true ? nonNegativeIntegerOption(values, "port", 65_535) : 0,
      open: values.get("open") !== true,
      maxNodes: values.has("max_nodes") === true ? positiveIntegerOption(values, "max_nodes", Number.MAX_SAFE_INTEGER) : 1200,
    };
  }

  /**
   * Preserve native dump argv, adding only a present published-artifact path.
   *
   * @evidence contracts/common.md#principled-implementation The dump token precedes the unmodified caller vector; a null publication adds no overlay coordinate.
   * @evidence contracts/common.md#clear-and-simple-design One vector owner is consumed by the actual dump spawn; resident serve/lint vectors remain distinct in their existing owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing public flag and result contracts are used by actual facades without fixture branches or a synthetic producer.
   * @evidence contracts/common.md#meaningful-documentation The native headline states this operation's input/result ownership and relevant absence/default meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Separate argv elements preserve path and equals-form spelling exactly for Node spawn, without shell quoting.
   */
  export function dumpVector(argv: readonly string[], artifacts: string | null): string[] {
    return ["dump", ...argv, ...(artifacts === null ? [] : ["--artifacts", artifacts])];
  }

  /**
   * Map native completion to its exit code and optional owned spawn diagnostic.
   *
   * @evidence contracts/common.md#principled-implementation Actual spawn errors return code one with the existing owned prefix; normal status passes through exactly, and absent status remains failure one.
   * @evidence contracts/common.md#clear-and-simple-design The actual dump facade writes only the returned diagnostic and returns this code; completion decides no process timing or retry.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing public flag and result contracts are used by actual facades without fixture branches or a synthetic producer.
   * @evidence contracts/common.md#meaningful-documentation The native headline states this operation's input/result ownership and relevant absence/default meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Node error and nullable numeric status are preserved as native result representations, with no platform shell exit interpretation.
   */
  export function dumpCompletion(result: { error?: Error; status: number | null }): { code: number; diagnostic?: string } {
    if (result.error) return { code: 1, diagnostic: `@ttsc/graph: ${result.error.message}\n` };
    return { code: result.status ?? 1 };
  }

}

interface IViewOptions extends IProjectOptions {
  port: number;
  open: boolean;
  maxNodes: number;
}

const DUMP_OPTIONS = [
  { key: "cwd", flags: ["--cwd", "-cwd"], kind: "value" },
  { key: "tsconfig", flags: ["--tsconfig", "-tsconfig"], kind: "value" },
  { key: "pretty", flags: ["--pretty", "-pretty"], kind: "boolean" },
  { key: "help", flags: ["--help", "-help", "-h"], kind: "flag" },
] as const;
