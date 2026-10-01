// expect: unicorn/prefer-string-raw error
const backslashOnly = "\\n";
const tab = "\\d\t";
const hex = "\\d\x41";
const newline = "\\d\n";
const template = `\\d\t`;
