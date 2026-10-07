// expect: unicorn/escape-case error
const s = "\xa9";
// expect: unicorn/escape-case error
const lowercaseUnicode = "\uabcd";
// expect: unicorn/escape-case error
const lowercaseCodePoint = "\u{1f600}";
// expect: unicorn/escape-case error
const oddBackslashRun = "\\\xa9";
// expect: unicorn/escape-case error
const head = `\xa9${s}`;
// expect: unicorn/escape-case error
const middle = `${s}\xa9${s}`;
// expect: unicorn/escape-case error
const tail = `${s}\xa9`;
const canonicalHex = "\xA9";
const canonicalUnicode = "\uABCD";
const canonicalCodePoint = "\u{1F600}";
const boundedHex = "\x41bcd";
const boundedUnicode = "\uABCDdef";
const escapedBackslash = "\\xa9";
const evenBackslashRun = "\\\\xa9";
const tagged = String.raw`\xa9`;
export default [
  s,
  lowercaseUnicode,
  lowercaseCodePoint,
  oddBackslashRun,
  head,
  middle,
  tail,
  canonicalHex,
  canonicalUnicode,
  canonicalCodePoint,
  boundedHex,
  boundedUnicode,
  escapedBackslash,
  evenBackslashRun,
  tagged,
];
