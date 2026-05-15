// expect: no-import-type-side-effects error
import { type Foo, type Bar } from "./types-fixture";
const x: Foo | null = null;
const y: Bar | null = null;
JSON.stringify([x, y]);
