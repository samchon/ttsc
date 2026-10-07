// @ttsc-corpus-filename: src/pages/index.tsx

const analytics = "https://www.google-analytics.com/analytics.js";
const overrides = { __html: analytics };
const htmlKey = "__html";

export default function Page() {
  return (
    <>
      // expect: nextjs/next-script-for-ga error
      <script dangerouslySetInnerHTML={{ __html: "https://www.google-analytics.com/analytics.js" }} />
      <script dangerouslySetInnerHTML={{ __html: analytics }} />

      // expect: nextjs/next-script-for-ga error
      <script dangerouslySetInnerHTML={{ ...overrides, __html: "https://www.google-analytics.com/analytics.js" }} />
      <script dangerouslySetInnerHTML={{ __html: "https://www.google-analytics.com/analytics.js", ...overrides }} />

      // expect: nextjs/next-script-for-ga error
      <script dangerouslySetInnerHTML={{ [htmlKey]: analytics, __html: "https://www.google-analytics.com/analytics.js" }} />
      <script dangerouslySetInnerHTML={{ __html: "https://www.google-analytics.com/analytics.js", [htmlKey]: analytics }} />

      // expect: nextjs/next-script-for-ga error
      <script dangerouslySetInnerHTML={{ __html: analytics, __html: "https://www.google-analytics.com/analytics.js" }} />
      <script dangerouslySetInnerHTML={{ __html: "https://www.google-analytics.com/analytics.js", __html: analytics }} />
    </>
  );
}
