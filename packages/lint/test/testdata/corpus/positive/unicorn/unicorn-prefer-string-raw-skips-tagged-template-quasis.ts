declare const tag: (strings: TemplateStringsArray, value: string) => string;
// expect: unicorn/prefer-string-raw error
const nestedTemplate = tag`${`C:\\Users\\me`}`;
// expect: unicorn/prefer-string-raw error
const nestedString = tag`${"C:\\Users\\me"}`;
