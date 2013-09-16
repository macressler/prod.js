define(function() {
  var test = {};

  /* source: http://stackoverflow.com/questions/9382167/serializing-object-that-contains-cyclic-object-value */
  test.serialize = function(obj) {
    seen = []
    return JSON.stringify(obj, function(key, val) {
      if (typeof val == "object") {
        if (seen.indexOf(val) >= 0)
          return
        seen.push(val)
      }
      return val
    });
  };

  /* Suite */
  test.Suite = function(name, options) {
    this._name = name;
    this._tests = {};
    this._testNames = [];
    this._lastError = null;
    for (var key in options) {
      if (key == "setUp" || key == "tearDown") {
        this['_' + key] = options[key];
      }
      else if (key in this._tests) {
        throw('test "' + key + '" already exists for suite "' + name + '"');
      }
      else {
        this._tests[key] = options[key];
        this._testNames.push(key);

        if (options[key] instanceof test.Suite) {
          options[key].wrapSetUp(this._setUp);
          options[key].wrapTearDown(this._tearDown);
        }
      }
    }
  };

  test.Suite.prototype.getName = function() {
    return this._name;
  };

  test.Suite.prototype.wrapSetUp = function(f) {
    if (this._setUp) {
      var original = this._setUp;
      this._setUp = function() {
        f.apply(this);
        original.apply(this);
      };
    }
    else {
      this._setUp = f;
    }
  };

  test.Suite.prototype.wrapTearDown = function(f) {
    if (this._tearDown) {
      var original = this._tearDown;
      var self = this;
      this._tearDown = function() {
        f.apply(self);
        original.apply(self);
      };
    }
    else {
      this._tearDown = f;
    }
  };

  test.Suite.prototype.run = function(callbacks) {
    callbacks.beforeRun(this);
    return this._runTest(0, callbacks);
  };

  test.Suite.prototype._runTest = function(index, callbacks) {
    if (index >= this._testNames.length) {
      callbacks.afterFinish(this);
      return;
    }

    var name = this._testNames[index];
    var t = this._tests[name];
    if (t instanceof test.Suite) {
      var self = this;
      t.run({
        beforeRun: callbacks.beforeRun,
        beforeTest: callbacks.beforeTest,
        afterTest: callbacks.afterTest,
        afterFinish: function() {
          callbacks.afterFinish(t);
          self._runTest(index + 1, callbacks);
        }
      });
    }
    else {
      //console.log("running test " + index);
      var context = new Context();
      var queue = [];

      if (this._setUp) {
        queue.push(this._setUp);
      }
      queue.push(t);
      if (this._tearDown) {
        queue.push(this._tearDown);
      }

      callbacks.beforeTest(name);
      this._call(queue, context, index, callbacks);
    }
  };

  test.Suite.prototype._call = function(queue, context, index, callbacks) {
    if (queue.length == 0) {
      /* run next test */
      index++;

      var self = this;
      setTimeout(function() {
        callbacks.afterTest(self._lastError);
        self._runTest(index, callbacks);
      }, 0);
    }
    else {
      var f;
      var t = queue.shift();
      var async = t.length > 0;
      var self = this;

      if (async) {
        f = function() {
          var timerId = setTimeout(function() {
            try {
              throw new Error("timed out");
            }
            catch (e) {
              self._lastError = e;
            }

            //console.log("test " + index + ": timed out");
            self._call(queue, context, index, callbacks);
          }, 150);

          var done = function(d) {
            if (typeof(d) == "function") {
              return function() {
                clearTimeout(timerId);
                try {
                  d.apply(context, arguments);
                }
                catch (e) {
                  self._lastError = e;
                }
                //console.log("test " + index + ": finished");
                self._call(queue, context, index, callbacks);
              }
            }
            else {
              clearTimeout(timerId);
              self._call(queue, context, index, callbacks);
            }
          };

          t.call(context, done);
        };
      }
      else {
        f = t;
      }

      setTimeout(function() {
        try {
          f.apply(context);
        }
        catch (e) {
          self._lastError = e;
          queue = [];
        }

        if (!async) {
          self._call(queue, context, index, callbacks);
        }
      }, 0);
    }
  };

  /* AssertionError */
  test.AssertionError = function(message) {
    Error.apply(this, arguments);
    this.message = message;
  };

  test.AssertionError.prototype = new Error();

  /* Context */
  var Context = function() {
  };

  Context.prototype.assert = function(value, message) {
    if (!value) {
      throw(new test.AssertionError(message ? message : "assertion failed"));
    }
  };

  Context.prototype.assertSame = function(expected, actual, message) {
    if (typeof(message) == "undefined") {
      message = "expected: " + test.serialize(expected) + ", got: " + test.serialize(actual);
    }
    this.assert(actual === expected, message);
  };

  Context.prototype.assertEquals = function(expected, actual, message) {
    if (typeof(message) == "undefined") {
      message = "expected: " + test.serialize(expected) + ", got: " + test.serialize(actual);
    }
    this.assert(typeof(actual) == typeof(expected), message)
    if (typeof(expected) == "object") {
      var actualKeys = [];
      for (var key in actual) {
        actualKeys.push(key);
      }

      for (var key in expected) {
        var index = actualKeys.indexOf(key);
        if (index < 0) {
          this.assert(false, message);
        }
        this.assertEquals(actual[key], expected[key]);
        actualKeys.splice(index, 1);
      }
      if (actualKeys.length > 0) {
        this.assert(false, message);
      }
    }
    else {
      this.assert(actual == expected, message);
    }
  };

  Context.prototype.assertException = function(f, message) {
    var thrown = false;
    try {
      f();
    }
    catch (e) {
      thrown = true;
    }

    if (typeof(message) == "undefined") {
      message = "expected function to throw an exception";
    }
    this.assert(thrown, message);
  };

  Context.prototype.assertCalled = function(spy, num, message) {
    var result;
    if (typeof(num) == "undefined") {
      result = spy.callCount > 0;
      if (!result && typeof(message) == "undefined") {
        message = "expected function to be called, but wasn't";
      }
    }
    else {
      result = spy.callCount == num;
      if (!result && typeof(message) == "undefined") {
        message = "expected call count: " + num + ", actual: " + spy.callCount;
      }
    }
    if (!result) {
      assert(false, message);
    }
  };

  Context.prototype.assertCalledWith = function(spy) {
    var args = [];
    for (var i = 1; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    var result = spy.calledWith.apply(spy, args);
    this.assert(result, "expected function to be called with " + test.serialize(args));
  };

  Context.prototype.refute = function(value, message) {
    this.assert(!value, message);
  };

  Context.prototype.refuteCalled = function(spy, num, message) {
    var result;
    if (typeof(num) == "undefined") {
      result = spy.callCount == 0;
      if (!result && typeof(message) == "undefined") {
        message = "expected function to not be called";
      }
    }
    else {
      result = spy.callCount != num;
      if (!result && typeof(message) == "undefined") {
        message = "expected call count to not be " + num;
      }
    }
    if (!result) {
      assert(false, message);
    }
  };

  /* Runner */
  test.Runner = function(logger) {
    this._logger = logger;
    this._suites = [];
  };

  test.Runner.prototype.discover = function(dir, pattern, callback) {
    var self = this;
    require(['fs'], function(fs) {
      self._walk(fs, dir, pattern, function(err, files) {
        if (err) {
          throw(err);
        }
        require(files, function() {
          for (var key in arguments) {
            self.addSuite(arguments[key]);
          }
          callback();
        });
      });
    });
  };

  test.Runner.prototype.addSuite = function(suite) {
    this._suites.push(suite);
  };

  test.Runner.prototype.run = function(callback) {
    this._runSuite(0, callback);
  };

  test.Runner.prototype._runSuite = function(index, callback) {
    if (index == this._suites.length) {
      callback();
    }
    else {
      var mainSuite = this._suites[index];
      var self = this;
      mainSuite.run({
        beforeRun: function(suite) {
          self._logger.run(suite.getName());
        },

        beforeTest: function(name) {
          self._logger.start(name);
        },

        afterTest: function(error) {
          if (error) {
            self._logger.failure(error);
          }
          else {
            self._logger.success();
          }
        },

        afterFinish: function(suite) {
          self._logger.finish();
          if (suite === mainSuite) {
            self._runSuite(index + 1, callback);
          }
        }
      });
    }
  };

  /* source: http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search */
  test.Runner.prototype._walk = function(fs, dir, pattern, callback) {
    var results = [];
    var self = this;
    fs.readdir(dir, function(err, list) {
      if (err) {
        return callback(err);
      }

      var pending = list.length;
      if (!pending) {
        return callback(null, results);
      }

      list.forEach(function(basename) {
        var path = dir + '/' + basename;
        fs.stat(path, function(err, stat) {
          if (stat && stat.isDirectory()) {
            self._walk(fs, path, pattern, function(err, res) {
              results = results.concat(res);
              if (!--pending) {
                callback(null, results);
              }
            });
          }
          else {
            if (basename.match(pattern)) {
              results.push(path);
            }
            if (!--pending) {
              callback(null, results);
            }
          }
        });
      });
    });
  };

  /* Logger (abstract) */
  var Logger = function() {
    this._level = 0;
  };

  Logger.prototype.print = function(info) {
    throw("not implemented");
  }

  Logger.prototype.run = function(suiteName) {
    this._level++;
    this.print({
      name: suiteName,
      type: 'run'
    });
    this._suiteName = suiteName;
  };

  Logger.prototype.start = function(testName) {
    this.print({
      name: testName,
      type: 'start'
    });
    this._testName = testName;
  };

  Logger.prototype.success = function() {
    this.print({
      type: 'success'
    });
    this._testName = null;
  };

  Logger.prototype.failure = function(error) {
    var callstack = [];
    var lines = error.stack.split('\n');
    for (var i = 0, len = lines.length; i < len; i++) {
      var md;
      if (lines[i].match(/^\s+at/)) {
        callstack.push(lines[i].replace(/^\s*/, ""));
      }
      else if (md = lines[i].match(/^([^@]+)?@(.+?:\d+)$/)) {
        callstack.push("at " + md[2]);
      }
      else {
        callstack.push(lines[i]);
      }
    }
    this.print({
      type: 'failure',
      callstack: callstack
    });
    this._testName = null;
  };

  Logger.prototype.finish = function() {
    this.print({
      type: 'finish',
    });
    this._level--;
    this._suiteName = null;
  };

  /* ConsoleLogger */
  test.ConsoleLogger = function(console) {
    Logger.apply(this);
    this._console = console;
  };

  test.ConsoleLogger.prototype = new Logger();

  test.ConsoleLogger.prototype.print = function(info) {
    switch (info.type) {
      case 'run':
        this._console.log("suite: " + info.name);
        this._console.group()
        break;

      case 'start':
        break;

      case 'success':
        this._console.log('test ' + this._testName + ': success');
        break;

      case 'failure':
        this._console.log('test ' + this._testName + ': failed');
        this._console.group();
        info.callstack.forEach(function(line) {
          this._console.log(line);
        }, this);
        this._console.groupEnd();
        break;

      case 'finish':
        this._console.groupEnd();
        this._console.log("finished: " + this._suiteName);
        break;
    }
  };

  /* HtmlLogger */
  test.HtmlLogger = function(document, container) {
    Logger.apply(this);
    this._document = document;
    this._containers = [container || document.body];
  };

  test.HtmlLogger.prototype = new Logger();

  test.HtmlLogger.prototype._container = function() {
    return this._containers[this._containers.length - 1];
  };

  test.HtmlLogger.prototype._pushContainer = function(container) {
    var c = this._container();
    c.appendChild(container);
    this._containers.push(container);
  };

  test.HtmlLogger.prototype.print = function(info) {
    switch (info.type) {
      case 'run':
        var section = this._document.createElement('SECTION');
        section.setAttribute('class', 'suite');
        var header = this._document.createElement('HEADER');
        var h = this._document.createElement('H' + (this._level + 1));
        h.innerHTML = "Suite: " + info.name;
        header.appendChild(h);
        section.appendChild(header);
        this._pushContainer(section);
        break;

      case 'start':
        var div = this._document.createElement('DIV');
        div.setAttribute('class', 'test');

        var p = this._document.createElement('P');
        p.appendChild(this._document.createTextNode('Test: '));

        var span = this._document.createElement('SPAN');
        span.setAttribute('class', 'name');
        span.innerHTML = info.name;
        p.appendChild(span);

        div.appendChild(p);
        this._pushContainer(div);
        break;

      case 'success':
        var c = this._container();
        c.setAttribute('class', 'test success');
        this._containers.pop();
        break;

      case 'failure':
        var c = this._container();
        c.setAttribute('class', 'test failure');

        var div = this._document.createElement('DIV');
        div.setAttribute('class', 'callstack');
        c.appendChild(div);

        info.callstack.forEach(function(line) {
          var p = this._document.createElement('P');
          p.innerHTML = line;
          div.appendChild(p);
        }, this);

        this._containers.pop();
        break;

      case 'finish':
        this._containers.pop();
        break;
    }
  };

  return test;
});
