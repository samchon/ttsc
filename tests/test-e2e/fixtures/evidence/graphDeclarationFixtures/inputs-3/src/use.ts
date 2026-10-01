import { Ambient } from "./contracts.js";

const input: Ambient.Input = { id: "member" };
Ambient.run(input);
Ambient.Nested.work();
export const state: string = Ambient.state;
