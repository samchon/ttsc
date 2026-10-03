export * from "./runtime";
const MARKER = process.env.TTSC_DESC_MARKER ?? "unset";
export default () => ({ name: "context-env-descriptor", source: "absent-" + MARKER });
