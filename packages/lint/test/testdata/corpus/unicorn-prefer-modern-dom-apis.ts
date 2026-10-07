declare const parent: Element;
declare const ref: Element;
declare const node: Element;
// expect: unicorn/prefer-modern-dom-apis error
parent.insertBefore(node, ref);
