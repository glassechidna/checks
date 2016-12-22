#!/usr/bin/env jjs -scripting

function githubApi(endpoint, token) {
    return function(method, path, body, raw, additionalArgs) {
        var url = endpoint + path;
        var args = [
            "-s",
            "-u ${token}:x-oauth-basic",
            "-X ${method}",
            body ? "-d @-" : ""
        ];

        if (additionalArgs) args.push(additionalArgs);
        var joined = args.join(" ");

        var cmd = "curl ${joined} ${url}";
        if (body) {
            var data = raw ? body : JSON.stringify(body, null, 2); 
            $EXEC(cmd, data);
        } else {
            $EXEC(cmd);
        }

        return raw ? $OUT : JSON.parse($OUT);
    };
}

function changedLinesInDiff(diff) {
    var rangeInfoLine = new RegExp("^@@ .+\\+(\\d+),");
    var modifiedLine = new RegExp("^\\+(?!\\+|\\+)");
    var notRemovedLine = new RegExp("^ ");
    var filenameLine = new RegExp("^\\+\\+\\+ b/(.+)");
    
    var lines = diff.split("\n");
    var lineNumber = 0;
    var position = 0;
    var path = "";
    
    var changes = [];

    lines.forEach(function(line) {
        var match = line.match(rangeInfoLine);
        if (match) {
            lineNumber = Number(match[1]);
        }

        match = line.match(modifiedLine);
        if (match) {
            changes.push({ path: path, lineNumber: lineNumber, position: position });
            lineNumber += 1;
        }

        match = line.match(notRemovedLine);
        if (match) {
            lineNumber += 1;
        }

        position += 1;

        match = line.match(filenameLine);
        if (match) {
            path = match[1].trim();
            position = 0;
        }
    });

    return changes;
}

function onlyRelevantComments(comments, changes, extant) {
    return comments.reduce(function(memo, comment) {
        var foundChange = changes.find(function(change) {
            return change.path == comment.path && change.lineNumber == comment.line;
        });

        if (foundChange) {
            var relevantComment = {
                path: comment.path,
                position: foundChange.position,
                body: comment.body
            };
            var foundExtant = extant.find(function(extantComment) {
                return extantComment.path  == relevantComment.path && 
                    extantComment.position == relevantComment.position &&
                    extantComment.body     == relevantComment.body;
            });
            if (!foundExtant) memo.push(relevantComment);
        }
        return memo;
    }, []);
}

function postCheck(github, owner, repo, pr, sha, check) {
    github('POST', "repos/${owner}/${repo}/statuses/${sha}", check.status);

    var diff = github('GET', "repos/${owner}/${repo}/pulls/${pr}.diff", null, true, "-H 'Accept: application/vnd.github.v3.diff'");
    var changes = changedLinesInDiff(diff);

    var prCommentsUrl = "repos/${owner}/${repo}/pulls/${pr}/comments";
    var extantComments = github('GET', prCommentsUrl);

    var relevant = onlyRelevantComments(check.comments, changes, extantComments);
    relevant.forEach(function(comment) {
        comment.commit_id = sha;
        github('POST', prCommentsUrl, comment);
    });

    // TODO: post metadata
}

function localChanges(reference) {
    return `git diff @{upstream}`
}

if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, 'find', {
    value: function(predicate) {
     'use strict';
     if (this == null) {
       throw new TypeError('Array.prototype.find called on null or undefined');
     }
     if (typeof predicate !== 'function') {
       throw new TypeError('predicate must be a function');
     }
     var list = Object(this);
     var length = list.length >>> 0;
     var thisArg = arguments[1];
     var value;

     for (var i = 0; i < length; i++) {
       value = list[i];
       if (predicate.call(thisArg, value, i, list)) {
         return value;
       }
     }
     return undefined;
    }
  });
}

function getConfigFromJenkins() {
    var changeUrl = $ENV['CHANGE_URL']; // TODO: only works for forks? see JENKINS-39838
    var regex = new RegExp("(.+)/(.+)/(.+)/pull/(\\d+)")
    var match = changeUrl.match(regex);
    var baseUrl = match[1];
    var user = match[2];
    var repo = match[3];
    var pr = match[4];
    
    var commit = `git rev-parse HEAD`.trim();
    
    // jenkins continuously integrates (get it?) PRs into their target branch. if it's 
    // not a fast-forward merge, then HEAD will be referring to a commit that isn't yet 
    // on github. we only want to comment on the PR commit that we're currently looking at.
    var parents = `git log --pretty=%P -n 1`.trim().split(' ');
    if (parents.length > 1) {
        commit = parents[0];
    }

    var token = $ENV['CHECKS_GITHUB_TOKEN'];
    // var apiUrl = baseUrl + "/api/v3/"; // TODO: this would be for ghe
    var apiUrl = "https://api.github.com/";

    return {
        apiUrl: apiUrl,
        token: token,
        user: user,
        repo: repo,
        pr: pr,
        commit: commit
    }
}

function isPR() {
    return !!$ENV['CHANGE_URL'];
}

var ctx = {};

if (isPR()) {
    var config = getConfigFromJenkins();
    var github = githubApi(config.apiUrl, config.token);

    ctx.done = function(checkOutput) {
        print(JSON.stringify(checkOutput, null, 2));
        postCheck(github, config.user, config.repo, config.pr, config.commit, checkOutput);
    };
} else {
    ctx.done = function(checkOutput) {
        print(JSON.stringify(checkOutput, null, 2));
    };
}

load($ARG[0]);

