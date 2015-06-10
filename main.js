(function () {
    "use strict";

    var ISSUES_PER_PAGE = 100,
        COMMENTS_PER_PAGE = 100;

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


    var _repoIssues = Promise.promisify(api.issues.repoIssues, api.issues),
        _getComments = Promise.promisify(api.issues.getComments, api.issues);

    var getIssuePage = function (page) {
        return _repoIssues({
            user: config.repoUser,
            repo: config.repoName,
            state: "all",
            direction: "asc",
            "per_page": ISSUES_PER_PAGE,
            page: page
        });
    };

    var getCommentPage = function (issue, page) {
        return _getComments({
            user: config.repoUser,
            repo: config.repoName,
            number: issue,
            "per_page": COMMENTS_PER_PAGE,
            page: page
        });
    };

    var getIssues = function () {
        var all = [];

        var getIssuesHelper = function (page) {
            return getIssuePage(page)
                .then(function (issues) {
                    all = all.concat(issues);
                    if (issues.length === ISSUES_PER_PAGE) {
                        return getIssuesHelper(page + 1);
                    } else {
                        return all;
                    }
                });
        };

        return getIssuesHelper(1);
    };

    var getComments = function (issue) {
        var all = [];

        var getCommentsHelper = function (page) {
            return getCommentPage(issue, page)
                .then(function (comments) {
                    all = all.concat(comments);
                    if (comments.length === COMMENTS_PER_PAGE) {
                        return getCommentsHelper(page + 1);
                    } else {
                        return all;
                    }
                });
        };

        return getCommentsHelper(1);
    };

    getIssues().then(function (issues) {
        console.log("got %d issues", issues.length);

        return Promise.all(issues.map(function (issue) {
            return getComments(issue.number)
                .then(function (comments) {
                    console.log("got %d comments for issue %d", comments.length, issue.number)
                    return {
                        issue: issue,
                        comments: comments
                    }
                });
        }))
    });
}());
