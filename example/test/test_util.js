define([
  'lib/prod',
  'util'
], function(prod, util) {
  return new prod.Suite('util', {
    "camelize": function() {
      this.assertEquals("FooBar", util.camelize("foo_bar"));
    },

    "capitalize": function() {
      this.assertEquals("Huge", util.capitalize("huge"));
    },

    "numProperties": function() {
      this.assertEquals(util.numProperties({}), 0);
      this.assertEquals(util.numProperties({foo: 'bar'}), 1);

      var foo = function() {
        this.foo = 'bar';
      };
      var bar = function() {
        this.bar = 'baz';
      }
      bar.prototype = new foo();

      this.assertEquals(1, util.numProperties(new bar()));
    },

    "clearProperties": function() {
      var obj = {foo: 123, bar: 456};
      util.clearProperties(obj);
      this.assertEquals('undefined', typeof(obj.foo));
      this.assertEquals('undefined', typeof(obj.bar));
    },
  });
});
