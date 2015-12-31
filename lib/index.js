/**
 * Expose `JSON`.
 */
var util = require('util'),
    fs   = require('fs'),
    os   = require('os');

var mocha = require('mocha');
var Base = mocha.reporters.Base
    , cursor = Base.cursor
    , color = Base.color;

module.exports = JSONFileReporter;

function new_suite(title, file) {
  return {
    title: title,
    file: file,
    started: undefined,
    ended: undefined,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      pending: 0,
      duration: 0
    },
    rollup: {
      total: 0,
      passed: 0,
      failed: 0,
      pending: 0,
      duration: 0
    },
    test_results: [],
    suites: []
  }
}

function error_result(error) {
  if (!error) return undefined;

  var message = error.message || '';
  var trace = error.stack || message;

  var index = trace.indexOf(message);
  if (index > -1) {
    index += message.length;
    message = trace.slice(0, index);
    trace = trace.slice(index + 1);
  }

  if (error.uncaught) {
    message = 'Uncaught ' + message;
  }

  return {
    message: message,
    stack: trace
  }
}

function null_to_zero(val) {
  return val ? val : 0;
}

function test_results(test, error) {
  return {
    title: test.title,
    fullTitle: test.fullTitle(),
    file: test.file,
    pending: test.pending,
    duration: null_to_zero(test.duration),
    state: test.state,
    speed: test.speed,
    err: error_result(error)
  }
}

function rollup_stats(source_stats, destination_stats) {
  destination_stats.total += source_stats.total;
  destination_stats.passed += source_stats.passed;
  destination_stats.failed += source_stats.failed;
  destination_stats.pending += source_stats.pending;
  destination_stats.duration += source_stats.duration;
}

/**
 * Initialize a new `JSON` reporter.
 *
 * @param {Runner} runner
 * @api public
 */

function JSONFileReporter(runner) {
  Base.call(this, runner);

  var top_suite = undefined;
  var current_suite = undefined;
  var suite_stack = [];

  runner.on('test', function(test) {
    console.log(" *** Start test: " + test.title + " (" + test.file + ")");
  });

  runner.on('pass', function(test, error){
    console.log(" *** Test passed: " + test.title + " (" + test.file + ")");

    var suite_to_update = current_suite ? current_suite : top_suite;
    suite_to_update.summary.total++;
    suite_to_update.summary.passed++;
    suite_to_update.summary.duration += null_to_zero(test.duration);
    suite_to_update.test_results.push(test_results(test, error));
  });

  runner.on('fail', function(test, error){
    console.log(" *** Test fail: " + test.title + " (" + test.file + ")");

    var suite_to_update = current_suite ? current_suite : top_suite;
    suite_to_update.summary.total++;
    suite_to_update.summary.failed++;
    suite_to_update.summary.duration += null_to_zero(test.duration);
    suite_to_update.test_results.push(test_results(test, error));
  });

  runner.on('pending', function(test, error){
    console.log(" *** Test pending: " + test.title + " (" + test.file + ")");

    var suite_to_update = current_suite ? current_suite : top_suite;
    suite_to_update.summary.total++;
    suite_to_update.summary.pending++;
    suite_to_update.summary.duration += null_to_zero(test.duration);
    suite_to_update.test_results.push(test_results(test, error));
  });

  runner.on('suite', function(suite) {
    console.log(" *** Suite begin: " + suite.title + " (" + suite.file + ")");

    var suite_title = suite.title;
    if (!suite_title) {
      // if there is not yet a top suite, then name it 'TOP'; else 'NO TITLE'
      suite_title = top_suite ? 'NO TITLE' : 'TOP';
    }

    // create the new suite, and assign it to top if there isn't one already
    var next_suite = new_suite(suite_title, suite.file);
    if (!top_suite) {
      top_suite = next_suite;
    }

    // update the current suite to add the new suite as a child, and push the parent on to the stack
    if (current_suite) {
      current_suite.suites.push(next_suite);
      suite_stack.push(current_suite);
    }

    // make the new suite the current suite
    current_suite = next_suite;
    current_suite.started = new Date();
  });

  runner.on('suite end', function(suite) {
    console.log(" *** Suite end: " + suite.title + " (" + suite.file + ")");

    current_suite.ended = new Date();

    // rollup into myself
    rollup_stats(current_suite.summary, current_suite.rollup);

    // pop
    var child_suite = current_suite;
    current_suite = suite_stack.pop();

    // rollup into parent
    if (current_suite) {
      rollup_stats(child_suite.rollup, current_suite.rollup);
    }
  });

  runner.on('end', function(){
    var version = process.env.APPLICATION_VERSION ? process.env.APPLICATION_VERSION : 'UNKNOWN';

    var results = {
      version: version,
      host:    os.hostname(),
      started: top_suite.started,
      ended:   top_suite.ended,
      results: top_suite
    };

    var jsonOutput = JSON.stringify(results, null, 2);

    var out_file_name = "./report.json";
    if(process.env.MOCHA_REPORT_FILE){
      out_file_name = process.env.MOCHA_REPORT_FILE;
    }

      try {
          util.print("\nGenerating JSON test report...")

          var out  = fs.openSync(out_file_name, "w");

          fs.writeSync(out, jsonOutput);
          fs.close(out);
          util.print("\nGenerated JSON test report to "+out_file_name+"\n")
      } catch (error) {
          util.print("\nError: Unable to write to file "+out_file_name+"\n");
      }
  });
}

/**
 * Return a plain-object representation of `test`
 * free of cyclic properties etc.
 *
 * @param {Object} test
 * @return {Object}
 * @api private
 */

function clean(test) {
  return {
      title: test.title
    , fullTitle: test.fullTitle()
    , duration: test.duration
  }
}