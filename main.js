(function () {
    "use strict";

    var ISSUES_PER_PAGE = 100;

    var config = require("./config"),
        Github = require("github"),
        Promise = require("bluebird");

    var api = new Github({
        version: "3.0.0",
        debug: config.debug || false,
        protocol: config.protocol || "https",
        host: config.host || "api.github.com", 
        pathPrefix: config.pathPrefix || undefined,
        timeout: config.timeout || 5000,
        headers: config.headers || {}
    });

    api.authenticate({
        type: "basic",
        username: config.username,
        password: config.password
    });


    var repoIssues = Promise.promisify(api.issues.repoIssues, api.issues);

    var getIssuePage = function (n) {
        return repoIssues({
            user: config.repoUser,
            repo: config.repoName,
            state: "closed",
            direction: "asc",
            "per_page": ISSUES_PER_PAGE,
            page: n
        });
    };

    var getAllIssues = function () {
        var all = [];

        var getAllIssuesHelper = function (page) {
            return getIssuePage(page).then(function (result) {
                all = all.concat(result);
                if (result.length > 0) {
                    return getAllIssuesHelper(page + 1);
                } else {
                    return all;
                }
            });
        };

        return getAllIssuesHelper(1);
    };

    getAllIssues().then(function (result) {
        console.log("got %d issues", result.length);
    });

}());
