const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    reporter: "list",
    use: {
        baseURL: "http://127.0.0.1:4173",
        trace: "retain-on-failure"
    },
    projects: [
        { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "mobile-chromium", use: { ...devices["iPhone 13"] } }
    ],
    webServer: {
        command: "node tests/server.js",
        url: "http://127.0.0.1:4173/Index.html",
        reuseExistingServer: !process.env.CI,
        timeout: 15_000
    }
});
