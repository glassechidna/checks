#!/usr/bin/env jjs -scripting
if (!this.ctx) ctx = { done: function(o) { print(JSON.stringify(o, null, 2)); } };

(function(ctx) {
    // `xcodebuild ... | xcpretty -f \`bundle exec xcpretty-json-formatter\``
    var report = JSON.parse(readFully('build/reports/errors.json'));

    function getStatus() {
        var description;
        var state;
        var metadata = getMetadata();

        if (metadata.warningCount + metadata.errorCount == 0) {
            state = "success";
            description = "xcodebuild ran without warnings or errors";
        } else {
            state = "failure";
            description = "xcodebuild had ${metadata.warningCount} warnings and ${metadata.errorCount} errors";
        }
        
        return {
            state: state,
            description: description,
            target_url: "",
            context: 'xcodebuild'
        };
    }

    function getComments() {
        var sliceIdx = `pwd`.trim().length + 1;

        var compile_output = function(output_obj) {
            var base_and_line = output_obj.file_path.slice(sliceIdx);
            var parts = base_and_line.split(":");
            var path = parts[0];
            var line = Number(parts[1]);
            var body = "```\n${output_obj.line}\n${output_obj.cursor}\n```\n**Reason:** ${output_obj.reason}";

            return { path: path, line: line, body: body };
        }
        
        var w1 = report.warnings;
        var w2 = report.ld_warnings;
        var w3 = report.compile_warnings.map(compile_output);

        var e1 = report.errors;
        var e2 = report.compile_errors.map(compile_output);
        var e3 = report.file_missing_errors.map(function(e) { 
            return { body: "**File missing:** ${e.file_path}: ${e.reason}" };
        });
        var e4 = report.undefined_symbols_errors.map(function(e) {

        });
        var e5 = report.duplicate_symbols_errors.map(function(e) {

        });
        // var e6 = report.tests_failures.map(function(e) {
        //
        // });

        return w1.concat(w2, w3, e1, e2, e3, e4, e5);
    }

    function getMetadata() {
        var wc = report.warnings.length +
            report.ld_warnings.length +
            report.compile_warnings.length;
    
        var ec = report.errors.length + 
            report.compile_errors.length +
            report.file_missing_errors.length +
            report.undefined_symbols_errors.length +
            report.duplicate_symbols_errors.length;

        return { warningCount: wc, errorCount: ec };
    }

    ctx.done({
        status: getStatus(),
        comments: getComments(),
        metadata: getMetadata()
    });
})(ctx);
