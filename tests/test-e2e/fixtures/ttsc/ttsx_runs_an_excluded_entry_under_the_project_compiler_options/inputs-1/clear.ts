declare const __dirname: string;

const value: string | undefined = "aliased";
if (value === undefined) throw new Error("unreachable");
const narrowed: string = value;

console.log(narrowed, typeof __dirname === "string" ? "cjs" : "esm");
