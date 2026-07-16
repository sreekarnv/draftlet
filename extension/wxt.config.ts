import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Draftlet Gmail Capture",
    description: "Capture selected Gmail text into the local Draftlet runtime.",
    permissions: ["activeTab", "scripting"],
    host_permissions: ["http://127.0.0.1:8000/*", "https://mail.google.com/*"],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  }),
});
