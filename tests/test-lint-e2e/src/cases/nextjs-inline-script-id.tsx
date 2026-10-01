import Script from "next/script";

// Positive: inline `<Script>` with no `id` attribute.
const a = (
  // expect: nextjs/inline-script-id error
  <Script>{`console.log("hi")`}</Script>
);

// Negative: inline `<Script>` with an `id`.
const b = (
  <Script id="say-hi">{`console.log("hi")`}</Script>
);

JSON.stringify({ a, b });
