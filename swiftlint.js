#!/usr/bin/env jjs -scripting
if (!this.ctx) ctx = { done: function(o) { print(JSON.stringify(o, null, 2)); } };

(function(ctx) {
    var warnings = JSON.parse(`swiftlint lint --reporter json --quiet`);

    function getStatus(warnings) {
        var count = warnings.length;
        var description;
        var state;

        if (count == 0) {
            state = "success";
            description = "Swiftlint found no style violations";
        } else {
            state = "failure";
            description = "Swiftlint found ${count} violations";
        }
        
        return {
            state: state,
            description: description,
            target_url: "",
            context: 'Swiftlint'
        };
    }

    function getComments(warnings) {
        var sliceIdx = `pwd`.trim().length + 1;
        return warnings.map(function(warning) {
            var path = warning.file.slice(sliceIdx); // remove absolute path prefix
            var line = warning.line;
            var body = warning.reason;
            return { path: path, line: line, body: body };
        });
    }

    function getMetadata(warnings) {
        return { warningCount: warnings.length };
    }

    ctx.done({
        status: getStatus(warnings),
        comments: getComments(warnings),
        metadata: getMetadata(warnings)
    });
})(ctx);
