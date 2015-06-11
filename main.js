(function () {
    "use strict";

    var ISSUES_PER_PAGE = 100,
        COMMENTS_PER_PAGE = 100,
        MAX_CONCURRENCY = 6;

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
        _getComments = Promise.promisify(api.issues.getComments, api.issues),
        _createIssue = Promise.promisify(api.issues.create, api.issues),
        _createComment = Promise.promisify(api.issues.createComment, api.issues);

    var getIssuePage = function (page) {
        return _repoIssues({
            user: config.readOrg,
            repo: config.readRepo,
            state: "all",
            direction: "asc",
            "per_page": ISSUES_PER_PAGE,
            page: page
        });
    };

    var getCommentPage = function (issue, page) {
        return _getComments({
            user: config.readOrg,
            repo: config.readRepo,
            number: issue,
            "per_page": COMMENTS_PER_PAGE,
            page: page
        });
    };

    var createIssue = function (title, body, assignee, labels) {
        return _createIssue({
            user: config.writeOrg,
            repo: config.writeRepo,
            title: title,
            body: body,
            assignee: assignee,
            labels: labels
        });    
    };

    var createComment = function (issue, body) {
        return _createIssue({
            user: config.writeOrg,
            repo: config.writeRepo,
            number: issue,
            body: body
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

    var REPLACEMENT_URL = "http://s.mlkshk.com/r/Y7SS";

    var sanitizeText = function (text) {
        return text;
    };

    var getIssueBody = function (issue) {
        return sanitizeText(issue.body);
    };

    var getCommentBody = function (comment) {
        return sanitizeText(comment.body);
    }

    var createIssue = function (issue, comments) {

    };

    var writeIssues = function (issues) {

    };

    getIssues()
        .map(function (issue) {
            return getComments(issue.number)
                .then(function (comments) {
                    console.log("got %d comments for issue %d", comments.length, issue.number)
                    return {
                        issue: issue,
                        comments: comments
                    }
                });
        }, { concurrency: MAX_CONCURRENCY })
        .each(function (result) {
            console.log("Issue %d with %d comments", result.issue.number, result.comments.length);

            return Promise.delay(3000);
        });
}());
