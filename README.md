prod.js
=======

prod.js is a simple AMD javascript testing library.

Test Example
------------

    define([
      'lib/prod',
      'util'
    ], function(prod, util) {
      return new prod.Suite('util', {
        "camelize": function() {
          this.assertEquals(util.camelize("foo_bar"), "FooBar");
        },

        "capitalize": function() {
          this.assertEquals(util.capitalize("huge"), "Huge");
        },

        "numProperties": function() {
          this.assertEquals(0, util.numProperties({}));
          this.assertEquals(1, util.numProperties({foo: 'bar'}));

          var foo = function() {
            this.foo = 'bar';
          };
          var bar = function() {
            this.bar = 'baz';
          }
          bar.prototype = new foo();

          this.assertEquals(util.numProperties(new bar()), 1);
        },

        "clearProperties": function() {
          var obj = {foo: 123, bar: 456};
          util.clearProperties(obj);
          this.assertEquals(typeof(obj.foo), 'undefined');
          this.assertEquals(typeof(obj.bar), 'undefined');
        },
      });
    });

Example Project
---------------

Check out the example project in the example directory of this
repository. If you have phantomjs installed, you can run the tests
by running:

    phantomjs scripts/test.js
