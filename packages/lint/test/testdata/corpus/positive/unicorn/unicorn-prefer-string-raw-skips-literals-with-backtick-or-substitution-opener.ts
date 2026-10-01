// expect: unicorn/prefer-string-raw error
const dollar = "a\\b$c";
const backtick = "a\\b`c";
const opener = "a\\b${c}";
const templateBacktick = `a\\b\`c`;
const templateOpener = `a\\b\${c}`;
