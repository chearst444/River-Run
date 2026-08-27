import { defineConfig } from "vite";

// Served from a GitHub Pages project site at
// https://chearst444.github.io/River-Run/, so assets need that subpath
// baked in. This also shifts the local dev server to serve from
// /River-Run/ instead of / — see the printed URL when `npm run dev` starts.
export default defineConfig({
  base: "/River-Run/",
});
