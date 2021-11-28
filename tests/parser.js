import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import glob from "glob";
import diff from "../util/diff.js";
import * as colorsUtil from "../util/colors.js";
import * as optionsUtil from "../util/options.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  "create": {
    "description": [
      "Recreates the fixture for the specified test(s)",
      "or all the fixtures if no specific test is given."
    ],
    "type": "b"
  },
  "help": {
    "description": "Prints this message and exits.",
    "type": "b",
    "alias": "h"
  }
};
const opts = optionsUtil.parse(process.argv.slice(2), config);
const args = opts.options;
const argv = opts.arguments;

if (args.help) {
  console.log([
    colorsUtil.stdout.white("SYNTAX"),
    "  " + colorsUtil.stdout.cyan("npm run test:parser --") + " [test1, test2 ...] [options]",
    "",
    colorsUtil.stdout.white("OPTIONS"),
    optionsUtil.help(config)
  ].join(os.EOL) + os.EOL);
  process.exit(0);
}

const basedir = path.join(__dirname, "parser");

// Get a list of all tests
var tests = glob.sync("**/!(_*).ts", { cwd: basedir });

// Run specific tests only if arguments are provided
if (argv.length) {
  tests = tests.filter(filename => argv.indexOf(filename.replace(/\.ts$/, "")) >= 0);
  if (!tests.length) {
    console.error("No matching tests: " + argv.join(" "));
    process.exit(1);
  }
}

import { Program, Options, ASTBuilder } from "../index.js";

var failures = 0;

tests.forEach(filename => {
  if (filename.charAt(0) == "_" || filename.endsWith(".fixture.ts")) return;

  console.log(colorsUtil.stdout.white("Testing parser/" + filename));

  var failed = false;
  var program = new Program(new Options());
  var parser = program.parser;
  var sourceText = fs.readFileSync(basedir + "/" + filename, { encoding: "utf8" }).replace(/\r?\n/g, "\n");
  parser.parseFile(sourceText, filename, true);
  var serializedSourceText = ASTBuilder.build(program.sources[0]);
  var actual = serializedSourceText + parser.diagnostics.map(diagnostic => "// " + diagnostic +"\n").join("");
  var fixture = filename + ".fixture.ts";

  if (args.create) {
    fs.writeFileSync(basedir + "/" + fixture, actual, { encoding: "utf8" });
    console.log("Created\n");
  } else {
    var expected = fs.readFileSync(basedir + "/" + fixture, { encoding: "utf8" }).replace(/\r\n/g, "\n");
    var diffs = diff("parser/" + fixture, expected, actual);
    if (diffs !== null) {
      failed = true;
      console.log(diffs);
      console.log(colorsUtil.stdout.red("diff ERROR"));
    } else {
      console.log(colorsUtil.stdout.green("diff OK"));
    }
  }

  console.log();
  if (failed) ++failures;
});

if (failures) {
  process.exitCode = 1;
  console.log(colorsUtil.stdout.red("ERROR: ") + failures + " parser tests failed");
} else {
  console.log("[ " + colorsUtil.stdout.white("SUCCESS") + " ]");
}
