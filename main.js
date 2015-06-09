(function () {
    "use strict";

    var config = require("./config"),
        Github = require("github");

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


    api.issues.repoIssues({
        user: config.repoUser,
        repo: config.repoName
    }, function (err, result) {
        console.log(JSON.stringify({
            err: err,
            result: result
        }, null, "  "));
    });

}());
