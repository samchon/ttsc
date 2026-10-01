// @ttsc-corpus-clean: unicorn/prefer-string-raw
declare const dedent: (strings: TemplateStringsArray) => string;
const raw = String.raw`C:\\Users\\me`;
const trimmed = dedent`C:\\Users\\me`;
