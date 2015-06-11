module.exports = {
    debug: true,
    protocol: "https",
    host: "api.github.com",
    // pathPrefix: "/api/v3", // for some GHEs; none for GitHub
    timeout: 5000,
    headers: {
        "user-agent": "github-issue-rewriter" // GitHub is happy with a unique user agent
    },
    username: "joerlrbrandt",
    password: "password",
    readOrg: "joelrbrandt",
    readRepo: "github-issue-rewriter",
    writeOrg: "iwehrman",
    writeRepo: "github-issue-rewriter"
};
