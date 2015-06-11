(function () {
    "use strict";

    var urlRE = new RegExp(// protocol identifier
        "(?:(?:https?|ftp)://)" +
        // user:pass authentication
        "(?:\\S+(?::\\S*)?@)?" +
        "(?:" +
          // IP address exclusion
          // private & local networks
          "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
          "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
          "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
          // IP address dotted notation octets
          // excludes loopback network 0.0.0.0
          // excludes reserved space >= 224.0.0.0
          // excludes network & broacast addresses
          // (first & last IP address of each class)
          "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
          "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
          "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
        "|" +
          // host name
          "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
          // domain name
          "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
          // TLD identifier
          "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
        ")" +
        // port number
        "(?::\\d{2,5})?" +
        // resource path
        "(?:/\\S*)?" +
        "$",
        "gim"
    );

    var ISSUES_PER_PAGE = 100,
        COMMENTS_PER_PAGE = 100,
        MAX_CONCURRENCY = 6,
        PULL_REQUEST_LABEL = "__PULL_REQUEST__";

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
        _editIssue = Promise.promisify(api.issues.edit, api.issues),
        _createComment = Promise.promisify(api.issues.createComment, api.issues);

    var getIssuePage = function (page) {
        return _repoIssues({
            user: config.readOrg,
            repo: config.readRepo,
            state: "all",
            direction: "asc",
            sort: "created",
            "per_page": ISSUES_PER_PAGE,
            page: page
        });
    };

    var getCommentPage = function (issueNumber, page) {
        return _getComments({
            user: config.readOrg,
            repo: config.readRepo,
            number: issueNumber,
            "per_page": COMMENTS_PER_PAGE,
            page: page
        });
    };

    var createIssue = function (title, body, assignee, labels) {
        var msg = {
            user: config.writeOrg,
            repo: config.writeRepo,
            title: title,
            body: body,
            labels: labels
        };

        if (assignee) {
            msg.assignee = assignee;
        }

        console.log("creating issue", JSON.stringify(msg, null, "  "));

        return _createIssue(msg);
    };

    var closeIssue = function (issueNumber) {
        return _editIssue({
            user: config.writeOrg,
            repo: config.writeRepo,
            number: issueNumber,
            state: "closed"
        });
    };

    var createComment = function (issueNumber, body) {
        var msg = {
            user: config.writeOrg,
            repo: config.writeRepo,
            number: issueNumber,
            body: body
        };

        console.log("creating comment", JSON.stringify(msg, null, "  "));

        return _createComment(msg);
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
        var urls = text.match(urlRE) || [];

        urls.forEach(function (url) {
            // The URL RE correctly matches trailing parentheses and brackets,
            // but Markdown uses these ambiguously as part of its own syntax.
            if (url[url.length - 1] === ")" || url[url.length - 1] === "]") {
                url = url.substring(0, url.length - 1);
            }
            
            text = text.replace(url, REPLACEMENT_URL);
        });

        return text;
    };

    var getIssueBody = function (issue) {
        var body = sanitizeText(issue.body),
            user = issue.user.login,
            created = issue["created_at"];

        return body + "\n\n-- @" + user + " at " + created;
    };

    var getCommentBody = function (comment) {
        var body = sanitizeText(comment.body),
            user = comment.user.login,
            created = comment["created_at"];

        return body + "\n\n-- @" + user + " at " + created;
    }

    var writeIssue = function (issue) {
        console.log("writing issue %d", issue.number);

        var title = sanitizeText(issue.title),
            body = getIssueBody(issue),
            closed = issue.state === "closed",
            assignee = issue.assignee && issue.assignee.login,
            labels = !issue.labels ? [] : issue.labels.map(function (label) {
                return label.name;
            }),
            pullRequest = !!(issue["pull_request"]);

        if (pullRequest) {
            labels.push("__PULL_REQUEST__");
        }

        return createIssue(title, body, assignee, labels)
            .then(function (issue) {
                if (closed) {
                    return closeIssue(issue.number).return(issue);
                } else {
                    return issue;
                }
            })
    };

    var writeComment = function (issue, comment) {
        console.log("writing comment %d on issue %d", issue.number, comment.id);

        var body = getCommentBody(comment);

        return createComment(issue.number, body);
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

            return writeIssue(result.issue)
                .then(function (createdIssue) {
                    return Promise.resolve(result.comments)
                        .each(writeComment.bind(null, createdIssue))
                })
        })
        .then(function () {

        })
}());
