require.config({
  baseUrl: '../src',
  paths: {
    lib: '../lib',
    test: '../test'
  }
});

require([
  'lib/prod'
], function(prod) {
  var logger;
  var phantom = navigator.userAgent.match(/PhantomJS/);
  if (phantom) {
    logger = new prod.ConsoleLogger(console);
  }
  else {
    logger = new prod.HtmlLogger(document);
  }
  var runner = new prod.Runner(logger);

  require([
    'test/test_util',
  ], function() {
    for (var i = 0; i < arguments.length; i++) {
      runner.addSuite(arguments[i]);
    }
    runner.run(function() {
      if (phantom) {
        console.log("QUIT"); // tell phantom to stop
      }
    });
  });
});
