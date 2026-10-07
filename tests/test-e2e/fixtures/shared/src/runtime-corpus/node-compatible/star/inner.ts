export type Hidden = string;
// export const commentedGhost: string = "nope";
const decoy: string = "export const stringGhost: string = 'nope';";
// exports.commentAssignGhost = 1;
/* module.exports.blockAssignGhost = 2; */
const stringAssign: string = "exports.stringAssignGhost = 3;";
const templateAssign: string = `module.exports.templateAssignGhost = 4;`;
const renamed: string = "renamed-ok";
export const foo: string = "foo-ok";
export function bar(): string {
  return "bar-ok";
}
export { renamed as qux };
export const decoyLength: number = decoy.length + stringAssign.length + templateAssign.length;
