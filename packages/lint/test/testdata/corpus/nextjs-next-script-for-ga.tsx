import Script from "next/script";

// Positive: hand-written Google Analytics `<script>` tag.
const a = (
  // expect: nextjs/next-script-for-ga error
  <script
    async
    src="https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID"
  />
);

// Negative: the imported `next/script` component is not a native script tag.
const b = (
  <Script
    src="https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID"
  />
);

JSON.stringify({ a, b });
