import nextra from "nextra";

// KaTeX renders the coverage composition on the evidence benchmark page. The
// figure published there is only checkable if the fold is legible as the
// arithmetic it is, rather than as a code block imitating one.
const withNextra = nextra({ latex: true });

export default withNextra({
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
});
