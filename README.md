# Checks

These are sanity checks for your codebase. They wrap up lint tools, health checks, 
compiler warnings, dependency vulnerability checkers, etc into a common format to 
output to GitHub Commit Statuses.

The checks are written in Javascript and executed by the Nashorn Javascript VM 
included in JDK 8. This was chosen because the Jenkins build agents necessarily 
have Java on them, so it was easy. Essentially scripts are written in regular ES5.1
with some special helpers explained [here](http://www.n-k.de/riding-the-nashorn/).

Scripts should look for an optional global named `ctx` and if it exists, pass their
JS output object to `ctx.done()`. If it's not defined, it is recommended that they
include a polyfill like the sample template below.

## Sample template

```javascript
#!/usr/bin/env jjs -scripting
if (!this.ctx) ctx = { done: function(o) { print(JSON.stringify(o, null, 2)); } };

(function(ctx) {
    var warnings = JSON.parse(`some-shell-command --json-output`);

    ctx.done({
        status: {
            state: state,
            description: description,
            target_url: "",
            context: 'Swiftlint'
        },
        comments: [
            { path: 'path/to/file.swift', line: 16, body: 'This line is lame' }
        ],
        metadata: { warnings: 7 }
    });
})(ctx);
```
