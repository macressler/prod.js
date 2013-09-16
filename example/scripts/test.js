#!/usr/bin/env phantomjs

var Output = function(writer, verbose) {
  this._writer = writer;
  this._verbose = verbose;
  this._level = 0;
  this._callstack = false;
  this._quit = false;
  this._errors = 0;
  this._backtraces = {};
};

Output.prototype = {
  quitReceived: function() {
    return this._quit;
  },

  print: function(msg) {
    this._writer.write(msg);
  },

  println: function(msg) {
    this.print(this.indent(msg) + "\n");
  },

  indent: function(msg) {
    var str = '';
    for (var i = 0; i < this._level; i++) {
      str += '    ';
    }
    return str + msg;
  },

  start: function() {
    this.print("Running tests:\n");
  },

  process: function(msg) {
    if (msg == "QUIT") {
      if (!this._verbose) {
        this.println("");
        if (this._errors == 0) {
          this.println("Success!");
        }
        else {
          for (var name in this._backtraces) {
            this.println("Error: " + name);
            this._level++;

            var bt = this._backtraces[name];
            for (var i = 0; i < bt.length; i++) {
              this.println(bt[i]);
            }
            this._level--;
            this.println('');
          }
        }
      }
      this._quit = true;
      return;
    }

    if (this._callstack) {
      if (msg.match(/^at /)) {
        if (this._verbose) {
          this.println(msg);
        }
        else {
          this._backtraces[this._fullName].push(msg);
        }
        return;
      }
      else {
        this._callstack = false;
        this._level--;
      }
    }

    var parts = msg.split(/: +/);
    if (parts[0] == 'suite') {
      this._suiteName = parts[1];
      if (this._verbose) {
        this.println(msg);
      }
      this._level++;
    }
    else if (parts[0] == 'finished') {
      this._level--;
      this._suiteName = null;
    }
    else if (md = parts[0].match(/^test (.+)$/)) {
      this._testName = md[1];
      if (this._verbose) {
        this.println(msg);
      }
      if (parts[1] == 'failed') {
        this._errors++;
        if (!this._verbose) {
          this.print('F');
          this._fullName = this._suiteName + '/' + this._testName;
          this._backtraces[this._fullName] = [];
        }
        this._level++;
        this._callstack = true;
      }
      else {
        if (!this._verbose) {
          this.print('.');
        }
      }
    }
  },

  error: function(msg, trace) {
    this.println('ERROR: ' + msg);
    this._level++;
    if (trace && trace.length) {
      trace.forEach(function(t) {
        this.println('-> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
      }, this);
    }
    this._level--;
  }
};

var Runner = function(relPath) {
  var system = require('system');
  this._relPath = relPath;
  this._processArgs(system.args);
  this._output = new Output(system.stdout, this._verbose);
};

Runner.prototype = {
  _processArgs: function(args) {
    var fs = require('fs');
    var relativePath = args[0];
    var absolutePath = fs.absolute(relativePath);
    var absoluteDir = absolutePath.substring(0, absolutePath.lastIndexOf('/'));
    this._url = 'file://' + absoluteDir + '/' + this._relPath
    this._verbose = args[1] == "-v";
  },

  onConsoleMessage: function(msg, lineNum, sourceId) {
    this._output.process(msg);
    if (this._output.quitReceived()) {
      phantom.exit();
    }
  },

  onError: function(msg, trace) {
    this._output.error(msg, trace);
    phantom.exit();
  },

  run: function() {
    var self = this;
    this._page = require('webpage').create();
    this._page.onConsoleMessage = function() {
      self.onConsoleMessage.apply(self, arguments);
    }
    this._page.onError = function() {
      self.onError.apply(self, arguments);
    }
    this._page.open(this._url, function(status) {
      if (status == 'fail') {
        self._output.println("failed to load the test page!");
        phantom.exit();
      }
      else {
        self._output.start();
      }
    });
  }
};

var runner = new Runner('../test/test.html');
runner.run();
