declare const process: { argv: string[] };
const metadata: ImportMeta & { main?: boolean } = import.meta;
const typedValue: string = "typed";

// This dependency runs inside the existing runtime.mts host. It observes real
// post-entry argv rather than replaying the launcher's option parser.
export const cliPolicyRuntime = {
  argv: process.argv.slice(2),
  value: typedValue,
  dependencyMain: "main" in metadata ? metadata.main : null,
};
