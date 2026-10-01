import { identity as a } from "./a/index";
import { identity as b } from "./b/index";
declare const require: (id: string) => { identity: string };
declare const __dirname: string;
const dynamic: string[] = ["a", "b", "../tools"].map(
  (name) => require(__dirname + "/" + name + "/index.ts").identity,
);
console.log([a, b, ...dynamic].join(","));
