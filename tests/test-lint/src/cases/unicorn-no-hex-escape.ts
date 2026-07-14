// expect: unicorn/no-hex-escape error
const s = "\xA9";
// expect: unicorn/no-hex-escape error
const oddBackslashRun = "\\\x41";
// expect: unicorn/no-hex-escape error
const head = `\xA9${s}`;
// expect: unicorn/no-hex-escape error
const middle = `${s}\xA9${s}`;
// expect: unicorn/no-hex-escape error
const tail = `${s}\xA9`;
const escapedBackslash = "\\x64";
const evenBackslashRun = "\\\\x64";
const unicodeEscape = "\u00A9";
const codePointEscape = "\u{1F600}";
const tagged = String.raw`\xA9`;
export default [
  s,
  oddBackslashRun,
  head,
  middle,
  tail,
  escapedBackslash,
  evenBackslashRun,
  unicodeEscape,
  codePointEscape,
  tagged,
];
