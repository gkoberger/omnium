#!/usr/bin/env node

"use strict";

var Fs = require("fs");
var Path = require("path");
var Exec = require("child_process").exec;
var Mkdirp = require("mkdirp");
var Sqwish = require("sqwish");
var UglifyJS = require("uglify-js");
var Optimist = require("optimist");

var FILETYPE_PATTERN = /js|css$/;
var TARGETS = ["jetpack", "greasemonkey"];

var argv = Optimist
    .usage("$0 [options] [project]")
    .describe("minify-js", "Minify Javascript that is embedded in the generated add-ons.")
    .describe("combine-js", "Combine Javascript files into one. Only applicable for 'jetpack' targets.")
    .describe("target", "The target to build. Possible options are:\n"
                      + "- \"jetpack\", to only build the Jetpack/ add-on SDK target.\n"
                      + "- \"greasemonkey\", to only build the Greasemonkey target.\n"
                      + "- \"all\", to build the Jetpack AND Greasemonkey targets.")
    .describe("open", "Open the installer web page when the build has finished.")

    .alias("m", "minify-js")
    .alias("c", "combine-js")
    .alias("t", "target")
    .alias("o", "open")

    .boolean("minify-js")
    .boolean("combine-js")
    .boolean("open")
    .string("targets")

    .default("minify-js", false)
    .default("combine-js", false)
    .default("target", "all")
    .default("open", true)

    .wrap(80)

    .argv;

var rmTree = function(path) {
    if (!Fs.existsSync(path))
        return;
 
    var files = Fs.readdirSync(path);
    if (!files.length) {
        Fs.rmdirSync(path);
        return;
    } else {
        files.forEach(function(file) {
            var fullName = Path.join(path, file);
            if (Fs.statSync(fullName).isDirectory()) {
                rmTree(fullName);
            } else {
                Fs.unlinkSync(fullName);
            }
        });
    }
    Fs.rmdirSync(path);
};

function copyFile(from, to) {
    Fs.writeFileSync(to, Fs.readFileSync(from));
}

function template(content, replacements) {
    return content.replace(/\%\(([^)]*)\)s?/g, function(m, tag) {
        if (replacements[tag]) {
            return typeof replacements[tag] != "string" 
                ? JSON.stringify(replacements[tag]) : replacements[tag];
        }
        return "";
    });
}

function getFiles(settings, target) {
    var files = []
    // Use the user specified loading order.
    if (Array.isArray(settings.load_order)) {
        settings.load_order.forEach(function(file) {
            if (FILETYPE_PATTERN.test(file))
                files.push(file);
        });
    }
    // If none is specified, do it ourselves.
    else {
        // TODO: This should be sorted per the README.
        Fs.readFirSync(Path.join(folder, "includes")).forEach(function(file) {
            if (FILETYPE_PATTERN.test(file))
                files.push(file);
        });
    }

    // Strip out targeted files for other targets.
    var files_clean = [];
    files.forEach(function(file) {
        for (var i = 0, l = TARGETS.length; i < l; ++i) {
            if (file.indexOf(TARGETS[i] + "_") === 0 && target != TARGETS[i])
                return;
        }
        files_clean.push(file);
    });

    return files_clean;
}

function greasemonkey(settings) {
    var target = "greasemonkey";
    var files = getFiles(settings, target);

    var output = Path.join(__dirname, settings.folder, "output", "omnium", settings.folder + ".user.js");

    console.log("GENERATING " + target.toUpperCase() + " SCRIPT");

    // We're going to build up the file in memory to keep the process synchronous.
    // This is not something that needs to be maintained and may change to using
    // Streams in the future.
    console.log("\tCreating userscript skeleton...");

    var included_urls = "";
    if (!Array.isArray(settings.included_urls))
        settings.included_urls = [settings.included_urls];
    settings.included_urls.forEach(function(url) {
        included_urls += "// @include       " + url + "\n"
    });
    settings.includes = included_urls;

    var excluded_urls = "";
    // TODO: Implement excluded
    settings.excludes = excluded_urls;

    var header = template(
        Fs.readFileSync(Path.join(__dirname, ".builder", target, "header.js"), "utf8"),
        settings
    );

    console.log("\tAdding files...");
    // Bootstrap file
    var bootstrap = Fs.readFileSync(Path.join(__dirname, ".builder", "omnium_bootstrap.js"), "utf8");
    console.log("\t+ omnium_bootstrap.js");

    // User created files
    var data = [header, bootstrap];
    files.forEach(function(file) {
        var content = Fs.readFileSync(Path.join(settings.folder, "includes", file), "utf8");
        // TODO: compress JS/ CSS
        var ext = Path.extname(file);
        if (ext == ".css")
            content = Sqwish.minify(content);
        else if (ext == ".js" && settings.minifyJS)
            content = UglifyJS.minify(content, {fromString: true}).code;
        data.push(content);
        console.log("\t+ " + file);
    });

    // Footer
    data.push(template(
        Fs.readFileSync(Path.join(__dirname, ".builder", target, "footer.js"), "utf8"),
        settings
    ));

    console.log("\n\tOutputted to " + output + "\n\n");
    Fs.writeFileSync(output, data.join(""), "utf8");
}

function jetpack(settings, callback) {
    var target = "jetpack";
    console.log("GENERATING " + target.toUpperCase() + " SCRIPT");
    console.log("\tCopying scripts...");

    // TODO: Make sure folder is always lowercase
    var output = Path.join(settings.folder, "output", "omnium", settings.folder + ".xpi");

    // Create the folder (use `_` to avoid collision).
    var jp_folder = Path.join(__dirname, ".builder", "jetpack-sdk", "_" + settings.folder);
    Mkdirp.sync(jp_folder);
    Mkdirp.sync(Path.join(jp_folder, "data"));
    Mkdirp.sync(Path.join(jp_folder, "lib"));
    Mkdirp.sync(Path.join(jp_folder, "tests"));

    // Copy jetpack_wrapper.js
    copyFile(
        Path.join(__dirname, ".builder", "jetpack", "wrapper.js"),
        Path.join(jp_folder, "data", "jetpack_bootstrap.js")
    );
    console.log("\t+ omnium_bootstrap.js");

    // Copy bootstrap.js
    copyFile(
        Path.join(__dirname, ".builder", "omnium_bootstrap.js"),
        Path.join(jp_folder, "data", "omnium_bootstrap.js")
    );
    console.log("\t+ omnium_bootstrap.js");

    // Copy all scripts to builder/jetpack/___/data
    var files = getFiles(settings, target);

    // TODO: Deal with the user using subfolders. Loops and recursion!
    var filesToInclude = [];
    var cssContent = "";
    var jsContent = "";
    var featureCount = 0;
    files.forEach(function(file) {
        var content = Fs.readFileSync(Path.join(settings.folder, "includes", file), "utf8");
        var ext = Path.extname(file);
        if (ext == ".css") {
            cssContent += " " + content;
            // CSS files we be combined into one, so we use the escape hatch here
            return;
        } else if (ext == ".js") {
            // HACK: This is probably way too specific for BugzillaJS :S
            if (content.indexOf(".addFeature(") > -1)
                featureCount++;
            if (settings.minifyJS)
                content = UglifyJS.minify(content, {fromString: true}).code;
            if (settings.combineJS) {
                jsContent += " " + content;
                // JS files we be combined into one, so we use the escape hatch here
                return;
            }
        }
        filesToInclude.push(file);
        Fs.writeFileSync(Path.join(jp_folder, "data", file), content, "utf8");
        console.log("\t+ " + file);
    });

    if (cssContent.length) {
        var cssFile = "omnium_combined.css";
        filesToInclude.push(cssFile)
        Fs.writeFileSync(Path.join(jp_folder, "data", cssFile),
            "omnium_addCss('" + Sqwish.minify(cssContent) + "');", "utf8");
        console.log("\t+ " + cssFile);
    }
    if (settings.combineJS) {
        var jsFile = "omnium_combined.js";
        filesToInclude.push(jsFile);
        Fs.writeFileSync(Path.join(jp_folder, "data", jsFile), jsContent, "utf8");
        console.log("\t+ " + jsFile);
    }

    // Process Worker scripts, if any
    var workers = [];
    if(settings.workers) {
        Object.keys(settings.workers).forEach(function(workerFile) {
            var content = Fs.readFileSync(Path.join(settings.folder, "includes", workerFile), "utf8");
            // Collect the scripts to embed:
            var scripts = "";
            settings.workers[workerFile].forEach(function(workerScript) {
                scripts += Fs.readFileSync(Path.join(settings.folder, "includes", workerScript), "utf8");
            });
            content = template(content, { scripts: scripts });
            if (settings.minifyJS)
                content = UglifyJS.minify(content, {fromString: true}).code;
            Fs.writeFileSync(Path.join(jp_folder, "data", workerFile), content, "utf8");
            workers.push(workerFile);
        });
    }

    // Generate a build file
    console.log("\tCreating basic build files...");
    // TODO: Don't allow quotes in author or description
    var package_json = {
        fullName: settings.name,
        description: settings.description,
        author: settings.author,
        version: settings.version,
        preferences: settings.preferences
    };

    if (settings.jetpack_id)
        package_json.id = settings.jetpack_id;

    Fs.writeFileSync(Path.join(jp_folder, "package.json"), JSON.stringify(package_json, null, 4), "utf8");
    console.log("\t+ package.json");

    // Create a main.js file
    var included = settings.included_urls;
    if (Array.isArray(included) && included.length == 1)
        included = included[0];
    // TODO: Deal with mulitple *'s in included URLs.
    var scripts = "[" + ["omnium_bootstrap.js", "jetpack_bootstrap.js"]
        .concat(filesToInclude).map(function(file) {
            return "data.url(\"" + file + "\")";
        }).join(", ") + "]";
    var main_vars = {
        included: included,
        scripts: scripts,
        featurecount: featureCount,
        workers: "[" + workers.map(function(file) {
                     return "data.url(\"" + file + "\")";
                 }).join(", ") + "]"
    }
    var main = Fs.readFileSync(Path.join(__dirname, ".builder", "jetpack", "main.js"), "utf8");
    Fs.writeFileSync(Path.join(jp_folder, "lib", "main.js"), template(main, main_vars), "utf8");

    console.log("\t+ main.js");

    var sdk_dir = Path.join(__dirname, ".builder", "jetpack-sdk");

    function generate_xpi() {
        // TODO: make this compatible with windows envs
        var child = Exec(
            "source bin/activate; cfx xpi --pkgdir='_" + settings.folder + "'",
            { cwd: sdk_dir },
            function(err, stdout, stderr) {
                if (err)
                    return callback(err);

                if (stderr) {
                    // First time? We need to save the key and do it again.
                    if (stderr.indexOf("No 'id' in package.json") > -1) {
                        // We need to save the ID for next time
                        console.log("\t+ Creating a new key (first run)");

                        var package_json = JSON.parse(Fs.readFileSync(
                            Path.join(sdk_dir, "_" + settings.folder, "package.json")
                        ));
                        var build_file = Path.join(__dirname, settings.folder, "build.json");
                        var build_json = JSON.parse(Fs.readFileSync(build_file));

                        build_json.jetpack_id = package_json.id;
                        Fs.writeFileSync(build_file, JSON.stringify(build_json, null, 4), "utf8");

                        //TODO: This could get us into an infinite loop..
                        generate_xpi();
                    } else {
                        callback(stderr);
                    }
                } else {
                    // TODO: This assumes no errors, which is way too optimistic
                    console.log("\t+ Generated xpi");

                    copyFile(Path.join(sdk_dir, "_" + settings.folder + ".xpi"), output);
                    console.log("\t+ Copied to " + settings.folder + ".xpi");

                    console.log("\n\tOutputted to " + output + "!\n\n");
                    callback();
                }
            }
        );
    }

    generate_xpi();
}

function widget(settings) {
    console.log("GENERATING SITE WIDGET");

    console.log("\tCreating files...");

    var output = Path.join(__dirname, settings.folder, "output");

    var index_in = Fs.readFileSync(Path.join(__dirname, ".builder", "index.html"), "utf8");
    Fs.writeFileSync(Path.join(output, "index.html"), template(index_in, settings), "utf8");
    console.log("\t+ index.html");

    copyFile(Path.join(__dirname, ".builder", "omnium_widget.js"),
        Path.join(output, "omnium", "omnium_widget.js"));
    console.log("\t+ omnium_widget.js")

    copyFile(Path.join(__dirname, ".builder", "omnium_widget.css"),
        Path.join(output, "omnium", "omnium_widget.css"));
    console.log("\t+ omnium_widget.css");

    console.log("\n\tOpening in browser!");
    Exec("open '" + Path.join(output, "index.html") + "'");
}

function main(folder, args) {
    folder = (folder || "").replace(/^[\/\\]+|[\/\\]+$/, "");
    if (!folder) {
        console.log(Optimist.help());
        process.exit(1);
    }

    // Load settings file
    var settings = JSON.parse(Fs.readFileSync(Path.join(__dirname, folder, "build.json")));
    settings.folder = folder;
    settings.minifyJS = args["minify-js"];
    settings.combineJS = args["combine-js"];
    settings.openInBrowser = args.open;

    // Remove the output.
    rmTree(Path.join(__dirname, folder, "output"));

    // We may not want to do this...
    rmTree(Path.join(__dirname, ".builder", "jetpack-sdk", "_" + folder));

    // Make the output foder
    Mkdirp.sync(Path.join(__dirname, folder, "output", "omnium"));

    var target = argv.target;
    var doAll = (target == "all");
    if (doAll || target == "greasemonkey")
        greasemonkey(settings);
    if (doAll || target == "jetpack")
        jetpack(settings, done);
    else
        done();

    function done(err) {
        if (err)
            throw err;

        if (settings.openInBrowser)
            widget(settings);
    }
}

if (argv.h || argv.help) {
    console.log(Optimist.help());
    process.exit(0);
}
main(argv._[0], argv);
