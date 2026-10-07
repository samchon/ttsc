// unicorn/text-encoding-identifier-case corpus. Upstream's canonical form is
// the dash-less `utf8` by default; the dashed `utf-8` is enforced only where a
// context demands it (here `new TextDecoder(...)`). Only `utf-8`/`utf8` and
// `ascii` are handled — every other encoding label passes through untouched.

// expect: unicorn/text-encoding-identifier-case error
const dashed = "utf-8";
const dashless = "utf8";
// expect: unicorn/text-encoding-identifier-case error
const upperAscii = "ASCII";
const lowerAscii = "ascii";
const latin = "latin1";
const utf16 = "UTF-16LE";
// expect: unicorn/text-encoding-identifier-case error
const decoder = new TextDecoder("utf8");
const dashedDecoder = new TextDecoder("utf-8");
void [dashed, dashless, upperAscii, lowerAscii, latin, utf16, decoder, dashedDecoder];
