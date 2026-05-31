import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://pirate-arcade.com",
  output: "static",
  integrations: [sitemap()],
});
