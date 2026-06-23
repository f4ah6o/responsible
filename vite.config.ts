import { defineConfig } from "vite-plus";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/responsible/" : "/",
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  build: {
    target: "es2022",
  },
  lint: {
    ignorePatterns: ["dist/**"],
  },
  fmt: {
    semi: true,
    singleQuote: false,
  },
});
