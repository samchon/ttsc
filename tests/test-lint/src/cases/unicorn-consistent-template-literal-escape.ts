// expect: unicorn/consistent-template-literal-escape error
const braceEscaped = `link $\{target}`;
// expect: unicorn/consistent-template-literal-escape error
const bothEscaped = `link \$\{target}`;
// expect: unicorn/consistent-template-literal-escape error
// expect: unicorn/consistent-template-literal-escape error
const mixedElements = `$\{head}${braceEscaped}$\{tail}`;
// expect: unicorn/consistent-template-literal-escape error
type BraceEscapedType = `$\{value}${string}`;
// expect: unicorn/consistent-template-literal-escape error
const multiline = `first ${braceEscaped}
second $\{closing}`;
const canonical = `use \${target} with ${bothEscaped}`;
const escapedBackslash = `keep \\\${mixedElements}`;
const tagged = String.raw`$\{canonical}` as BraceEscapedType;
const plainString = "$\{escapedBackslash}" + tagged + multiline;
export default plainString;
