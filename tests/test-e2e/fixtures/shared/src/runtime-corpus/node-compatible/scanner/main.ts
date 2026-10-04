// @ts-ignore Preserve the original extensionless edge under the shared NodeNext checker.
import { message } from "./helper";
// @ts-ignore The runtime hook, not TypeScript resolution, owns this original edge.
const dynamic = await import("./dynamic");
// @ts-ignore Preserve the original import inside template interpolation.
const interpolation = `${(await import("./dynamic")).dynamic}`;
const ordinary = "from './helper'";
const template = `import('./dynamic')`;
const regex = /import\('\.\/helper'\)/;
// from './helper'
export const observed = { message, dynamic: dynamic.dynamic, interpolation, ordinary, template, regex: regex.source };
