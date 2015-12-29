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

function new_suite(title) {
  return {
    title: title,
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

function test_results(test) {
  return {
    title: test.title,
    fullTitle: test.fullTitle(),
    pending: test.pending,
    duration: test.duration,
    state: test.state,
    speed: test.speed,
    err: test.err
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
  var self = this;
  Base.call(this, runner);

  var top_suite = new_suite('TOP');
  var current_suite = undefined;
  var suite_stack = [];

  var started_on = new Date();

  runner.on('pass', function(test){
    var suite_to_update = current_suite ? current_suite : top_suite;
    suite_to_update.summary.total++;
    suite_to_update.summary.passed++;
    suite_to_update.summary.duration += test.duration;
    suite_to_update.test_results.push(test_results(test));
  });

  runner.on('fail', function(test){
    var suite_to_update = current_suite ? current_suite : top_suite;
    suite_to_update.summary.total++;
    suite_to_update.summary.failed++;
    suite_to_update.summary.duration += test.duration;
    suite_to_update.test_results.push(test_results(test));
  });

  runner.on('pending', function(test){
    var suite_to_update = current_suite ? current_suite : top_suite;
    suite_to_update.summary.total++;
    suite_to_update.summary.pending++;
    suite_to_update.summary.duration += test.duration;
    suite_to_update.test_results.push(test_results(test));
  });

  runner.on('suite', function(suite) {
    var next_suite = current_suite ? new_suite(suite.title) : top_suite;
    if (current_suite) {
      current_suite.suites.push(next_suite);
      suite_stack.push(current_suite);
    }
    current_suite = next_suite;
    current_suite.started = new Date();
  });

  runner.on('suite end', function() {
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