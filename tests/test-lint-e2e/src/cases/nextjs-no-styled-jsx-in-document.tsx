// @ttsc-corpus-filename: src/pages/_document.tsx
// Positive: `styled-jsx` tag inside `pages/_document.tsx`.
const a = (
  <div>
    {/* expect: nextjs/no-styled-jsx-in-document error */}
    <style jsx>{`div { color: red }`}</style>
  </div>
);

// Negative: nothing styled-jsx in the document.
const b = <div />;

JSON.stringify({ a, b });
