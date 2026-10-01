// expect: unicorn/prefer-string-raw error
const p = "C:\\Users\\me";
// expect: unicorn/prefer-string-raw error
const backslashThenLetter = "\\n";
// expect: unicorn/prefer-string-raw error
const multilineTemplate = `C:\\Users
D:\\Data`;
const otherEscape = "\\d\t";
const trailingBackslash = "C:\\Users\\";
const backtick = "a\\b`c";
const substitutionOpener = "a\\b${c}";
const continuedLine = "C:\\Users\\\
me";
const tagged = String.raw`C:\\Users\\me`;
const noBackslash = "C:/Users/me";
export default [
  p,
  backslashThenLetter,
  multilineTemplate,
  otherEscape,
  trailingBackslash,
  backtick,
  substitutionOpener,
  continuedLine,
  tagged,
  noBackslash,
];
