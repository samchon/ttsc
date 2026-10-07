import cjs from "cjs-dep";
import { greet } from "esm-dep";
export const observed = `${cjs.answer}:${cjs.echo(7)}:${greet()}`;
