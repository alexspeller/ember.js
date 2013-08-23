var Router, App, AppView, templates, router, container, originalTemplates;
var get = Ember.get, set = Ember.set;

function bootApplication() {
  Ember.run(App, 'advanceReadiness');
}

function compile(string) {
  return Ember.Handlebars.compile(string);
}

function handleURL(path) {
  return Ember.run(function() {
    return router.handleURL(path).then(function(value) {
      ok(true, 'url: `' + path + '` was handled');
      return value;
    }, function(reason) {
      ok(false, 'failed to visit:`' + path + '` reason: `' + QUnit.jsDump.parse(reason));
      throw reason;
    });
  });
}

function handleURLAborts(path) {
  Ember.run(function() {
    router.handleURL(path).then(function(value) {
      ok(false, 'url: `' + path + '` was NOT to be handled');
    }, function(reason) {
      ok(reason && reason.message === "TransitionAborted",  'url: `' + path + '` was to be aborted');
    });
  });
}

function shouldNotHappen(error) {
  console.error(error.stack);
  ok(false, "this .then handler should not be called: " + error.message);
}

function handleURLRejectsWith(path, expectedReason) {
  Ember.run(function() {
    router.handleURL(path).then(function(value) {
      ok(false, 'expected handleURLing: `' + path + '` to fail');
    }, function(reason) {
      equal(expectedReason, reason);
    });
  });
}

module("Routing with Query Params", {
  setup: function() {
    Ember.run(function() {
      App = Ember.Application.create({
        name: "App",
        rootElement: '#qunit-fixture'
      });

      App.deferReadiness();

      App.Router.reopen({
        location: 'none'
      });

      Router = App.Router;

      App.LoadingRoute = Ember.Route.extend({
      });

      container = App.__container__;

      originalTemplates = Ember.$.extend({}, Ember.TEMPLATES);
      Ember.TEMPLATES.application = compile("{{outlet}}");
      Ember.TEMPLATES.home = compile("<h3>Hours</h3>");
      Ember.TEMPLATES.homepage = compile("<h3>Megatroll</h3><p>{{home}}</p>");
      Ember.TEMPLATES.camelot = compile('<section><h3>Is a silly place</h3></section>');
    });
    router = container.lookup('router:main');
  },

  teardown: function() {
    Ember.run(function() {
      App.destroy();
      App = null;

      Ember.TEMPLATES = originalTemplates;
    });
  }
});

test("The Homepage with Query Params", function() {
  expect(5);

  Router.map(function() {
    this.route("index", { path: "/", queryParams: ['foo', 'baz'] });
  });

  App.IndexRoute = Ember.Route.extend({
    beforeModel: function(transition, queryParams) {
      deepEqual(queryParams, {foo: 'bar', baz: true}, "beforeModel hook is called with query params");
    },

    model: function(params, transition, queryParams) {
      deepEqual(queryParams, {foo: 'bar', baz: true}, "Model hook is called with query params");
    },

    afterModel: function(resolvedModel, transition, queryParams) {
      deepEqual(queryParams, {foo: 'bar', baz: true}, "afterModel hook is called with query params");
    },

    setupController: function (controller, context, queryParams) {
      deepEqual(queryParams, {foo: 'bar', baz: true}, "setupController hook is called with query params");
    },

    renderTemplate: function (controller, context, queryParams) {
      deepEqual(queryParams, {foo: 'bar', baz: true}, "renderTemplates hook is called with query params");
    }

  });


  router.location.setURL("/?foo=bar&baz");
  bootApplication();
});



asyncTest("Transitioning query params works on the same route", function() {
  expect(25);

  var expectedQueryParams;

  Router.map(function() {
    this.route("home", { path: "/" });
    this.resource("special", { path: "/specials/:menu_item_id", queryParams: ['view'] });
  });

  App.SpecialRoute = Ember.Route.extend({
    beforeModel: function (transition, queryParams) {
      deepEqual(queryParams, expectedQueryParams, "The query params are correct in the beforeModel hook");
    },

    model: function(params, transition, queryParams) {
      deepEqual(queryParams, expectedQueryParams, "The query params are correct in the model hook");
      return {id: params.menu_item_id};
    },

    afterModel: function (resolvedModel, transition, queryParams) {
      deepEqual(queryParams, expectedQueryParams, "The query params are correct in the beforeModel hook");
    },

    setupController: function (controller, context, queryParams) {
      deepEqual(queryParams, expectedQueryParams, "The query params are correct in the setupController hook");
    },

    renderTemplate: function (controller, context, queryParams) {
      deepEqual(queryParams, expectedQueryParams, "The query params are correct in the renderTemplates hook");
    },

    serialize: function (obj) {
      return {menu_item_id: obj.id};
    }
  });


  Ember.TEMPLATES.home = Ember.Handlebars.compile(
    "<h3>Home</h3>"
  );


  Ember.TEMPLATES.special = Ember.Handlebars.compile(
    "<p>{{content.id}}</p>"
  );

  bootApplication();

  var transition = handleURL('/');

  Ember.run(function() {
    transition.then(function() {
      equal(Ember.$('h3', '#qunit-fixture').text(), "Home", "The app is now in the initial state");

      expectedQueryParams = {};
      return router.transitionTo('special', {id: 1});
    }, shouldNotHappen).then(function(result) {
      deepEqual(router.location.path, '/specials/1', "Correct URL after transitioning");

      expectedQueryParams = {view: 'details'};
      return router.transitionTo('special', {queryParams: {view: 'details'}});
    }, shouldNotHappen).then(function (result) {
      deepEqual(router.location.path, '/specials/1?view=details', "Correct URL after transitioning with route name and query params");

      expectedQueryParams = {view: 'other'};
      return router.transitionTo({queryParams: {view: 'other'}});
    }, shouldNotHappen).then(function (result) {
      deepEqual(router.location.path, '/specials/1?view=other', "Correct URL after transitioning with query params only");

      expectedQueryParams = {view: 'three'};
      return router.transitionTo("/specials/1?view=three");
    }, shouldNotHappen).then(function (result) {
      deepEqual(router.location.path, '/specials/1?view=three', "Correct URL after transitioning with url");

      start();
    }, shouldNotHappen);
  });
});


asyncTest("Transitioning query params works on a different route", function() {
  expect(29);

  var expectedQueryParams, expectedOtherQueryParams;

  Router.map(function() {
    this.route("home", { path: "/" });
    this.resource("special", { path: "/specials/:menu_item_id", queryParams: ['view'] });
    this.resource("other", { path: "/others/:menu_item_id", queryParams: ['view', 'lang'] });
  });

  App.SpecialRoute = Ember.Route.extend({
    beforeModel: function (transition, queryParams) {
      deepEqual(queryParams, expectedQueryParams, "The query params are correct in the beforeModel hook");
    },

    model: function(params, transition, queryParams) {
      deepEqual(queryParams, expectedQueryParams, "The query params are correct in the model hook");
      return {id: params.menu_item_id};
    },

    afterModel: function (resolvedModel, transition, queryParams) {
      deepEqual(queryParams, expectedQueryParams, "The query params are correct in the beforeModel hook");
    },

    setupController: function (controller, context, queryParams) {
      deepEqual(queryParams, expectedQueryParams, "The query params are correct in the setupController hook");
    },

    renderTemplate: function (controller, context, queryParams) {
      deepEqual(queryParams, expectedQueryParams, "The query params are correct in the renderTemplates hook");
    },

    serialize: function (obj) {
      return {menu_item_id: obj.id};
    }
  });

  App.OtherRoute = Ember.Route.extend({
    beforeModel: function (transition, queryParams) {
      deepEqual(queryParams, expectedOtherQueryParams, "The query params are correct in the beforeModel hook");
    },

    model: function(params, transition, queryParams) {
      deepEqual(queryParams, expectedOtherQueryParams, "The query params are correct in the model hook");
      return {id: params.menu_item_id};
    },

    afterModel: function (resolvedModel, transition, queryParams) {
      deepEqual(queryParams, expectedOtherQueryParams, "The query params are correct in the beforeModel hook");
    },

    setupController: function (controller, context, queryParams) {
      deepEqual(queryParams, expectedOtherQueryParams, "The query params are correct in the setupController hook");
    },

    renderTemplate: function (controller, context, queryParams) {
      deepEqual(queryParams, expectedOtherQueryParams, "The query params are correct in the renderTemplates hook");
    },

    serialize: function (obj) {
      return {menu_item_id: obj.id};
    }
  });



  Ember.TEMPLATES.home = Ember.Handlebars.compile(
    "<h3>Home</h3>"
  );


  Ember.TEMPLATES.special = Ember.Handlebars.compile(
    "<p>{{content.id}}</p>"
  );

  bootApplication();

  var transition = handleURL('/');

  Ember.run(function() {
    transition.then(function() {
      equal(Ember.$('h3', '#qunit-fixture').text(), "Home", "The app is now in the initial state");

      expectedQueryParams = {};

      return router.transitionTo('special', {id: 1});
    }, shouldNotHappen).then(function(result) {
      deepEqual(router.location.path, '/specials/1', "Correct URL after transitioning");

      expectedQueryParams = {view: 'details'};
      return router.transitionTo('special', {queryParams: {view: 'details'}});
    }, shouldNotHappen).then(function (result) {
      deepEqual(router.location.path, '/specials/1?view=details', "Correct URL after transitioning with route name and query params");

      expectedOtherQueryParams = {view: 'details'};

      return router.transitionTo('other', {id: 2});
    }, shouldNotHappen).then(function (result) {
      deepEqual(router.location.path, '/others/2?view=details', "Correct URL after transitioning to other route");

      expectedOtherQueryParams = {view: 'details', lang: 'en'};
      return router.transitionTo({queryParams: {lang: 'en'}});
    }, shouldNotHappen).then(function (result) {
      deepEqual(router.location.path, '/others/2?view=details&lang=en', "Correct URL after transitioning to other route");

      expectedQueryParams = {view: 'details'};

      return router.transitionTo("special", {id: 2});
    }, shouldNotHappen).then(function (result) {
      deepEqual(router.location.path, '/specials/2?view=details', "Correct URL after back to special route");

      start();
    }, shouldNotHappen);
  });
});



// asyncTest("Transitioning query params works on the same route", function() {
//   expect(3);

//   Router.map(function() {
//     this.route("home", { path: "/" });
//     this.resource("special", { path: "/specials/:menu_item_id" });
//   });

//   App.MenuItem = Ember.Object.extend(Ember.DeferredMixin);

//   App.SpecialRoute = Ember.Route.extend({
//     setupController: function(controller, model) {
//       set(controller, 'content', model);
//     }
//   });

//   Ember.TEMPLATES.home = Ember.Handlebars.compile(
//     "<h3>Home</h3>"
//   );

//   Ember.TEMPLATES.special = Ember.Handlebars.compile(
//     "<p>{{content.id}}</p>"
//   );

//   bootApplication();

//   container.register('controller:special', Ember.Controller.extend());

//   var transition = handleURL('/');

//   Ember.run(function() {
//     transition.then(function() {
//       equal(Ember.$('h3', '#qunit-fixture').text(), "Home", "The app is now in the initial state");

//       var promiseContext = App.MenuItem.create({ id: 1 });
//       Ember.run.later(function() {
//         promiseContext.resolve(promiseContext);
//       }, 1);

//       return router.transitionTo('special', promiseContext);
//     }).then(function(result) {
//       deepEqual(router.location.path, '/specials/1');
//       start();
//     });
//   });
// });

// asyncTest("Nested callbacks are not exited when moving to siblings", function() {
//   Router.map(function() {
//     this.resource("root", { path: "/" }, function() {
//       this.resource("special", { path: "/specials/:menu_item_id" });
//     });
//   });

//   var currentPath;

//   App.ApplicationController = Ember.Controller.extend({
//     currentPathDidChange: Ember.observer(function() {
//       currentPath = get(this, 'currentPath');
//     }, 'currentPath')
//   });

//   var menuItem;

//   App.MenuItem = Ember.Object.extend(Ember.DeferredMixin);
//   App.MenuItem.reopenClass({
//     find: function(id) {
//       menuItem = App.MenuItem.create({ id: id });
//       return menuItem;
//     }
//   });

//   App.LoadingRoute = Ember.Route.extend({

//   });

//   App.RootRoute = Ember.Route.extend({
//     model: function() {
//       rootModel++;
//       return this._super.apply(this, arguments);
//     },

//     serialize: function() {
//       rootSerialize++;
//       return this._super.apply(this, arguments);
//     },

//     setupController: function() {
//       rootSetup++;
//     },

//     renderTemplate: function() {
//       rootRender++;
//     }
//   });

//   App.HomeRoute = Ember.Route.extend({

//   });

//   App.SpecialRoute = Ember.Route.extend({
//     setupController: function(controller, model) {
//       set(controller, 'content', model);
//     }
//   });

//   Ember.TEMPLATES['root/index'] = Ember.Handlebars.compile(
//     "<h3>Home</h3>"
//   );

//   Ember.TEMPLATES.special = Ember.Handlebars.compile(
//     "<p>{{content.id}}</p>"
//   );

//   Ember.TEMPLATES.loading = Ember.Handlebars.compile(
//     "<p>LOADING!</p>"
//   );

//   var rootSetup = 0, rootRender = 0, rootModel = 0, rootSerialize = 0;

//   bootApplication();

//   container.register('controller:special', Ember.Controller.extend());

//   equal(Ember.$('h3', '#qunit-fixture').text(), "Home", "The app is now in the initial state");
//   equal(rootSetup, 1, "The root setup was triggered");
//   equal(rootRender, 1, "The root render was triggered");
//   equal(rootSerialize, 0, "The root serialize was not called");
//   equal(rootModel, 1, "The root model was called");

//   router = container.lookup('router:main');

//   Ember.run(function() {
//     var menuItem = App.MenuItem.create({ id: 1 });
//     Ember.run.later(function() { menuItem.resolve(menuItem); }, 1);

//     router.transitionTo('special', menuItem).then(function(result) {
//       equal(rootSetup, 1, "The root setup was not triggered again");
//       equal(rootRender, 1, "The root render was not triggered again");
//       equal(rootSerialize, 0, "The root serialize was not called");

//       // TODO: Should this be changed?
//       equal(rootModel, 1, "The root model was called again");

//       deepEqual(router.location.path, '/specials/1');
//       equal(currentPath, 'root.special');

//       start();
//     });
//   });
// });

// asyncTest("Events are triggered on the controller if a matching action name is implemented", function() {
//   Router.map(function() {
//     this.route("home", { path: "/" });
//   });

//   var model = { name: "Tom Dale" };
//   var stateIsNotCalled = true;

//   App.HomeRoute = Ember.Route.extend({
//     model: function() {
//       return model;
//     },

//     events: {
//       showStuff: function(obj) {
//         stateIsNotCalled = false;
//       }
//     }
//   });

//   Ember.TEMPLATES.home = Ember.Handlebars.compile(
//     "<a {{action showStuff content}}>{{name}}</a>"
//   );

//   var controller = Ember.Controller.extend({
//     showStuff: function(context) {
//       ok (stateIsNotCalled, "an event on the state is not triggered");
//       deepEqual(context, { name: "Tom Dale" }, "an event with context is passed");
//       start();
//     }
//   });

//   container.register('controller:home', controller);

//   bootApplication();

//   handleURL('/');

//   var actionId = Ember.$("#qunit-fixture a").data("ember-action");
//   var action = Ember.Handlebars.ActionHelper.registeredActions[actionId];
//   var event = new Ember.$.Event("click");
//   action.handler(event);
// });

// asyncTest("Events are triggered on the current state", function() {
//   Router.map(function() {
//     this.route("home", { path: "/" });
//   });

//   var model = { name: "Tom Dale" };

//   App.HomeRoute = Ember.Route.extend({
//     model: function() {
//       return model;
//     },

//     events: {
//       showStuff: function(obj) {
//         ok(this instanceof App.HomeRoute, "the handler is an App.HomeRoute");
//         // Using Ember.copy removes any private Ember vars which older IE would be confused by
//         deepEqual(Ember.copy(obj, true), { name: "Tom Dale" }, "the context is correct");
//         start();
//       }
//     }
//   });

//   Ember.TEMPLATES.home = Ember.Handlebars.compile(
//     "<a {{action showStuff content}}>{{name}}</a>"
//   );

//   bootApplication();

//   container.register('controller:home', Ember.Controller.extend());

//   //var controller = router._container.controller.home = Ember.Controller.create();
//   //controller.target = router;

//   handleURL('/');

//   var actionId = Ember.$("#qunit-fixture a").data("ember-action");
//   var action = Ember.Handlebars.ActionHelper.registeredActions[actionId];
//   var event = new Ember.$.Event("click");
//   action.handler(event);
// });

// asyncTest("Events are triggered on the current state when routes are nested", function() {
//   Router.map(function() {
//     this.resource("root", { path: "/" }, function() {
//       this.route("index", { path: "/" });
//     });
//   });

//   var model = { name: "Tom Dale" };

//   App.RootRoute = Ember.Route.extend({
//     events: {
//       showStuff: function(obj) {
//         ok(this instanceof App.RootRoute, "the handler is an App.HomeRoute");
//         // Using Ember.copy removes any private Ember vars which older IE would be confused by
//         deepEqual(Ember.copy(obj, true), { name: "Tom Dale" }, "the context is correct");
//         start();
//       }
//     }
//   });

//   App.RootIndexRoute = Ember.Route.extend({
//     model: function() {
//       return model;
//     }
//   });

//   Ember.TEMPLATES['root/index'] = Ember.Handlebars.compile(
//     "<a {{action showStuff content}}>{{name}}</a>"
//   );

//   bootApplication();

//   var actionId = Ember.$("#qunit-fixture a").data("ember-action");
//   var action = Ember.Handlebars.ActionHelper.registeredActions[actionId];
//   var event = new Ember.$.Event("click");
//   action.handler(event);
// });

// asyncTest("actions can be triggered with multiple arguments", function() {
//   Router.map(function() {
//     this.resource("root", { path: "/" }, function() {
//       this.route("index", { path: "/" });
//     });
//   });

//   var model1 = { name: "Tilde" },
//       model2 = { name: "Tom Dale" };

//   App.RootRoute = Ember.Route.extend({
//     events: {
//       showStuff: function(obj1, obj2) {
//         ok(this instanceof App.RootRoute, "the handler is an App.HomeRoute");
//         // Using Ember.copy removes any private Ember vars which older IE would be confused by
//         deepEqual(Ember.copy(obj1, true), { name: "Tilde" }, "the first context is correct");
//         deepEqual(Ember.copy(obj2, true), { name: "Tom Dale" }, "the second context is correct");
//         start();
//       }
//     }
//   });

//   App.RootIndexController = Ember.Controller.extend({
//     model1: model1,
//     model2: model2
//   });

//   Ember.TEMPLATES['root/index'] = Ember.Handlebars.compile(
//     "<a {{action showStuff model1 model2}}>{{model1.name}}</a>"
//   );

//   bootApplication();

//   var actionId = Ember.$("#qunit-fixture a").data("ember-action");
//   var action = Ember.Handlebars.ActionHelper.registeredActions[actionId];
//   var event = new Ember.$.Event("click");
//   action.handler(event);
// });

// test("transitioning multiple times in a single run loop only sets the URL once", function() {
//   Router.map(function() {
//     this.route("root", { path: "/" });
//     this.route("foo");
//     this.route("bar");
//   });

//   bootApplication();

//   var urlSetCount = 0;

//   router.get('location').setURL = function(path) {
//     urlSetCount++;
//     set(this, 'path', path);
//   };

//   handleURL('/');

//   equal(urlSetCount, 0);

//   Ember.run(function() {
//     router.transitionTo("foo");
//     router.transitionTo("bar");
//   });

//   equal(urlSetCount, 1);
//   equal(router.get('location').getURL(), "/bar");
// });

// test('navigating away triggers a url property change', function() {
//   var urlPropertyChangeCount = 0;

//   Router.map(function() {
//     this.route('root', { path: '/' });
//     this.route('foo', { path: '/foo' });
//     this.route('bar', { path: '/bar' });
//   });

//   bootApplication();

//   Ember.run(function() {
//     Ember.addObserver(router, 'url', function() {
//       urlPropertyChangeCount++;
//     });
//   });

//   equal(urlPropertyChangeCount, 0);

//   var transition = handleURL("/");

//   Ember.run(function() {
//     transition.then(function() {
//       equal(urlPropertyChangeCount, 2);

//       // Trigger the callback that would otherwise be triggered
//       // when a user clicks the back or forward button.

//       return router.router.transitionTo('foo');
//     }).then(function(result) {
//       return router.router.transitionTo('bar');
//     }).then(function(result) {
//       equal(urlPropertyChangeCount, 4, 'triggered url property change');
//     });
//   });
// });


// test("using replaceWith calls location.replaceURL if available", function() {
//   var setCount = 0,
//       replaceCount = 0;

//   Router.reopen({
//     location: Ember.NoneLocation.createWithMixins({
//       setURL: function(path) {
//         setCount++;
//         set(this, 'path', path);
//       },

//       replaceURL: function(path) {
//         replaceCount++;
//         set(this, 'path', path);
//       }
//     })
//   });

//   Router.map(function() {
//     this.route("root", { path: "/" });
//     this.route("foo");
//   });

//   bootApplication();

//   handleURL('/');

//   equal(setCount, 0);
//   equal(replaceCount, 0);

//   Ember.run(function() {
//     router.replaceWith("foo");
//   });

//   equal(setCount, 0, 'should not call setURL');
//   equal(replaceCount, 1, 'should call replaceURL once');
//   equal(router.get('location').getURL(), "/foo");
// });

// test("using replaceWith calls setURL if location.replaceURL is not defined", function() {
//   var setCount = 0;

//   Router.reopen({
//     location: Ember.NoneLocation.createWithMixins({
//       setURL: function(path) {
//         setCount++;
//         set(this, 'path', path);
//       }
//     })
//   });

//   Router.map(function() {
//     this.route("root", { path: "/" });
//     this.route("foo");
//   });

//   bootApplication();

//   handleURL('/');

//   equal(setCount, 0);

//   Ember.run(function() {
//     router.replaceWith("foo");
//   });

//   equal(setCount, 1, 'should call setURL once');
//   equal(router.get('location').getURL(), "/foo");
// });

// test("It is possible to get the model from a parent route", function() {
//   expect(9);

//   Router.map(function() {
//     this.resource("the_post", { path: "/posts/:post_id" }, function() {
//       this.resource("comments");
//     });
//   });

//   var post1 = {}, post2 = {}, post3 = {}, currentPost;

//   var posts = {
//     1: post1,
//     2: post2,
//     3: post3
//   };

//   App.ThePostRoute = Ember.Route.extend({
//     model: function(params) {
//       return posts[params.post_id];
//     }
//   });

//   App.CommentsRoute = Ember.Route.extend({
//     model: function() {
//       // Allow both underscore / camelCase format.
//       equal(this.modelFor('thePost'), currentPost);
//       equal(this.modelFor('the_post'), currentPost);
//     }
//   });

//   bootApplication();

//   currentPost = post1;
//   handleURL("/posts/1/comments");

//   currentPost = post2;
//   handleURL("/posts/2/comments");

//   currentPost = post3;
//   handleURL("/posts/3/comments");
// });

// test("A redirection hook is provided", function() {
//   Router.map(function() {
//     this.route("choose", { path: "/" });
//     this.route("home");
//   });

//   var chooseFollowed = 0, destination;

//   App.ChooseRoute = Ember.Route.extend({
//     redirect: function() {
//       if (destination) {
//         this.transitionTo(destination);
//       }
//     },

//     setupController: function() {
//       chooseFollowed++;
//     }
//   });

//   destination = 'home';

//   bootApplication();

//   equal(chooseFollowed, 0, "The choose route wasn't entered since a transition occurred");
//   equal(Ember.$("h3:contains(Hours)", "#qunit-fixture").length, 1, "The home template was rendered");
//   equal(router.container.lookup('controller:application').get('currentPath'), 'home');
// });

// test("Redirecting from the middle of a route aborts the remainder of the routes", function() {
//   expect(3);

//   Router.map(function() {
//     this.route("home");
//     this.resource("foo", function() {
//       this.resource("bar", function() {
//         this.route("baz");
//       });
//     });
//   });

//   App.BarRoute = Ember.Route.extend({
//     redirect: function() {
//       this.transitionTo("home");
//     },
//     setupController: function() {
//       ok(false, "Should transition before setupController");
//     }
//   });

//   App.BarBazRoute = Ember.Route.extend({
//     enter: function() {
//       ok(false, "Should abort transition getting to next route");
//     }
//   });

//   bootApplication();

//   handleURLAborts("/foo/bar/baz");

//   equal(router.container.lookup('controller:application').get('currentPath'), 'home');
//   equal(router.get('location').getURL(), "/home");
// });

// test("Redirecting to the current target in the middle of a route does not abort initial routing", function() {
//   expect(5);

//   Router.map(function() {
//     this.route("home");
//     this.resource("foo", function() {
//       this.resource("bar", function() {
//         this.route("baz");
//       });
//     });
//   });

//   var successCount = 0;
//   App.BarRoute = Ember.Route.extend({
//     redirect: function() {
//       this.transitionTo("bar.baz").then(function() {
//         successCount++;
//       });
//     },

//     setupController: function() {
//       ok(true, "Should still invoke bar's setupController");
//     }
//   });

//   App.BarBazRoute = Ember.Route.extend({
//     setupController: function() {
//       ok(true, "Should still invoke bar.baz's setupController");
//     }
//   });

//   bootApplication();

//   handleURL("/foo/bar/baz");

//   equal(router.container.lookup('controller:application').get('currentPath'), 'foo.bar.baz');
//   equal(successCount, 1, 'transitionTo success handler was called once');

// });

// test("Redirecting to the current target with a different context aborts the remainder of the routes", function() {
//   expect(4);

//   Router.map(function() {
//     this.route("home");
//     this.resource("foo", function() {
//       this.resource("bar", { path: "bar/:id" }, function() {
//         this.route("baz");
//       });
//     });
//   });

//   var model = { id: 2 };

//   var count = 0;

//   App.BarRoute = Ember.Route.extend({
//     afterModel: function(context) {
//       if (count++ > 10) {
//         ok(false, 'infinite loop');
//       } else {
//         this.transitionTo("bar.baz",  model);
//       }
//     },

//     serialize: function(params) {
//       return params;
//     }
//   });

//   App.BarBazRoute = Ember.Route.extend({
//     setupController: function() {
//       ok(true, "Should still invoke setupController");
//     }
//   });

//   bootApplication();

//   handleURLAborts("/foo/bar/1/baz");

//   equal(router.container.lookup('controller:application').get('currentPath'), 'foo.bar.baz');
//   equal(router.get('location').getURL(), "/foo/bar/2/baz");
// });

// test("Transitioning from a parent event does not prevent currentPath from being set", function() {
//   Router.map(function() {
//     this.resource("foo", function() {
//       this.resource("bar", function() {
//         this.route("baz");
//       });
//       this.route("qux");
//     });
//   });

//   App.FooRoute = Ember.Route.extend({
//     events: {
//       goToQux: function() {
//         this.transitionTo('foo.qux');
//       }
//     }
//   });

//   bootApplication();

//   var applicationController = router.container.lookup('controller:application');

//   handleURL("/foo/bar/baz");

//   equal(applicationController.get('currentPath'), 'foo.bar.baz');

//   Ember.run(function() {
//     router.send("goToQux");
//   });

//   equal(applicationController.get('currentPath'), 'foo.qux');
//   equal(router.get('location').getURL(), "/foo/qux");
// });

// test("Generated names can be customized when providing routes with dot notation", function() {
//   expect(4);

//   Ember.TEMPLATES.index = compile("<div>Index</div>");
//   Ember.TEMPLATES.application = compile("<h1>Home</h1><div class='main'>{{outlet}}</div>");
//   Ember.TEMPLATES.foo = compile("<div class='middle'>{{outlet}}</div>");
//   Ember.TEMPLATES.bar = compile("<div class='bottom'>{{outlet}}</div>");
//   Ember.TEMPLATES['bar/baz'] = compile("<p>{{name}}Bottom!</p>");

//   Router.map(function() {
//     this.resource("foo", { path: "/top" }, function() {
//       this.resource("bar", { path: "/middle" }, function() {
//         this.route("baz", { path: "/bottom" });
//       });
//     });
//   });

//   App.FooRoute = Ember.Route.extend({
//     renderTemplate: function() {
//       ok(true, "FooBarRoute was called");
//       return this._super.apply(this, arguments);
//     }
//   });

//   App.BarBazRoute = Ember.Route.extend({
//     renderTemplate: function() {
//       ok(true, "BarBazRoute was called");
//       return this._super.apply(this, arguments);
//     }
//   });

//   App.BarController = Ember.Controller.extend({
//     name: "Bar"
//   });

//   App.BarBazController = Ember.Controller.extend({
//     name: "BarBaz"
//   });

//   bootApplication();

//   handleURL("/top/middle/bottom");

//   equal(Ember.$('.main .middle .bottom p', '#qunit-fixture').text(), "BarBazBottom!", "The templates were rendered into their appropriate parents");
// });

// test("Child routes render into their parent route's template by default", function() {
//   Ember.TEMPLATES.index = compile("<div>Index</div>");
//   Ember.TEMPLATES.application = compile("<h1>Home</h1><div class='main'>{{outlet}}</div>");
//   Ember.TEMPLATES.top = compile("<div class='middle'>{{outlet}}</div>");
//   Ember.TEMPLATES.middle = compile("<div class='bottom'>{{outlet}}</div>");
//   Ember.TEMPLATES['middle/bottom'] = compile("<p>Bottom!</p>");

//   Router.map(function() {
//     this.resource("top", function() {
//       this.resource("middle", function() {
//         this.route("bottom");
//       });
//     });
//   });

//   bootApplication();

//   handleURL("/top/middle/bottom");

//   equal(Ember.$('.main .middle .bottom p', '#qunit-fixture').text(), "Bottom!", "The templates were rendered into their appropriate parents");
// });

// test("Child routes render into specified template", function() {
//   Ember.TEMPLATES.index = compile("<div>Index</div>");
//   Ember.TEMPLATES.application = compile("<h1>Home</h1><div class='main'>{{outlet}}</div>");
//   Ember.TEMPLATES.top = compile("<div class='middle'>{{outlet}}</div>");
//   Ember.TEMPLATES.middle = compile("<div class='bottom'>{{outlet}}</div>");
//   Ember.TEMPLATES['middle/bottom'] = compile("<p>Bottom!</p>");

//   Router.map(function() {
//     this.resource("top", function() {
//       this.resource("middle", function() {
//         this.route("bottom");
//       });
//     });
//   });

//   App.MiddleBottomRoute = Ember.Route.extend({
//     renderTemplate: function() {
//       this.render('middle/bottom', { into: 'top' });
//     }
//   });

//   bootApplication();

//   handleURL("/top/middle/bottom");

//   equal(Ember.$('.main .middle .bottom p', '#qunit-fixture').length, 0, "should not render into the middle template");
//   equal(Ember.$('.main .middle > p', '#qunit-fixture').text(), "Bottom!", "The template was rendered into the top template");
// });

// test("Rendering into specified template with slash notation", function() {
//   Ember.TEMPLATES['person/profile'] = compile("profile {{outlet}}");
//   Ember.TEMPLATES['person/details'] = compile("details!");

//   Router.map(function() {
//     this.resource("home", { path: '/' });
//   });

//   App.HomeRoute = Ember.Route.extend({
//     renderTemplate: function() {
//       this.render('person/profile');
//       this.render('person/details', { into: 'person/profile' });
//     }
//   });

//   bootApplication();

//   handleURL("/");

//   equal(Ember.$('#qunit-fixture:contains(profile details!)').length, 1, "The templates were rendered");
// });


// test("Parent route context change", function() {
//   var editCount = 0,
//       editedPostIds = Ember.A();

//   Ember.TEMPLATES.application = compile("{{outlet}}");
//   Ember.TEMPLATES.posts = compile("{{outlet}}");
//   Ember.TEMPLATES.post = compile("{{outlet}}");
//   Ember.TEMPLATES['post/index'] = compile("showing");
//   Ember.TEMPLATES['post/edit'] = compile("editing");

//   Router.map(function() {
//     this.resource("posts", function() {
//       this.resource("post", { path: "/:postId" }, function() {
//         this.route("edit");
//       });
//     });
//   });

//   App.PostsRoute = Ember.Route.extend({
//     events: {
//       showPost: function(context) {
//         this.transitionTo('post', context);
//       }
//     }
//   });

//   App.PostRoute = Ember.Route.extend({
//     model: function(params) {
//       return {id: params.postId};
//     },

//     events: {
//       editPost: function(context) {
//         this.transitionTo('post.edit');
//       }
//     }
//   });

//   App.PostEditRoute = Ember.Route.extend({
//     model: function(params) {
//       var postId = this.modelFor("post").id;
//       editedPostIds.push(postId);
//       return null;
//     },
//     setup: function() {
//       this._super.apply(this, arguments);
//       editCount++;
//     }
//   });

//   bootApplication();

//   handleURL("/posts/1");

//   Ember.run(function() {
//     router.send('editPost');
//   });

//   Ember.run(function() {
//     router.send('showPost', {id: '2'});
//   });

//   Ember.run(function() {
//     router.send('editPost');
//   });

//   equal(editCount, 2, 'set up the edit route twice without failure');
//   deepEqual(editedPostIds, ['1', '2'], 'modelFor posts.post returns the right context');
// });

// test("Router accounts for rootURL on page load when using history location", function() {
//   var rootURL = window.location.pathname + '/app',
//       postsTemplateRendered = false,
//       setHistory,
//       HistoryTestLocation;

//   setHistory = function(obj, path) {
//     obj.set('history', { state: { path: path } });
//   };

//   // Create new implementation that extends HistoryLocation
//   // and set current location to rootURL + '/posts'
//   HistoryTestLocation = Ember.HistoryLocation.extend({
//     initState: function() {
//       var path = rootURL + '/posts';

//       setHistory(this, path);
//       this.set('location', {
//         pathname: path
//       });
//     },

//     replaceState: function(path) {
//       setHistory(this, path);
//     },

//     pushState: function(path) {
//       setHistory(this, path);
//     }
//   });

//   Ember.Location.registerImplementation('historyTest', HistoryTestLocation);

//   Router.reopen({
//     location: 'historyTest',
//     rootURL: rootURL
//   });

//   Router.map(function() {
//     this.resource("posts", { path: '/posts' });
//   });

//   App.PostsRoute = Ember.Route.extend({
//     model: function() {},
//     renderTemplate: function() {
//       postsTemplateRendered = true;
//     }
//   });

//   bootApplication();

//   ok(postsTemplateRendered, "Posts route successfully stripped from rootURL");

//   // clean after test
//   delete Ember.Location.implementations['historyTest'];
// });

// test("HistoryLocation has the correct rootURL on initState and webkit doesn't fire popstate on page load", function() {
//   expect(2);
//   var rootURL = window.location.pathname + 'app',
//       history,
//       HistoryTestLocation;

//   history = { replaceState: function() {} };

//   HistoryTestLocation = Ember.HistoryLocation.extend({
//     history: history,
//     initState: function() {
//       equal(this.get('rootURL'), rootURL);
//       this._super();
//       // these two should be equal to be able
//       // to successfully detect webkit initial popstate
//       equal(this._previousURL, this.getURL());
//     }
//   });

//   Ember.Location.registerImplementation('historyTest', HistoryTestLocation);

//   Router.reopen({
//     location: 'historyTest',
//     rootURL: rootURL
//   });

//   bootApplication();

//   // clean after test
//   delete Ember.Location.implementations['historyTest'];
// });


// test("Only use route rendered into main outlet for default into property on child", function() {
//   Ember.TEMPLATES.application = compile("{{outlet menu}}{{outlet}}");
//   Ember.TEMPLATES.posts = compile("{{outlet}}");
//   Ember.TEMPLATES['posts/index'] = compile("postsIndex");
//   Ember.TEMPLATES['posts/menu'] = compile("postsMenu");

//   Router.map(function() {
//     this.resource("posts", function() {});
//   });

//   App.PostsMenuView = Ember.View.extend({
//     tagName: 'div',
//     templateName: 'posts/menu',
//     classNames: ['posts-menu']
//   });

//   App.PostsIndexView = Ember.View.extend({
//     tagName: 'p',
//     classNames: ['posts-index']
//   });

//   App.PostsRoute = Ember.Route.extend({
//     renderTemplate: function() {
//       this.render();
//       this.render('postsMenu', {
//         into: 'application',
//         outlet: 'menu'
//       });
//     }
//   });

//   bootApplication();

//   handleURL("/posts");

//   equal(Ember.$('div.posts-menu:contains(postsMenu)', '#qunit-fixture').length, 1, "The posts/menu template was rendered");
//   equal(Ember.$('p.posts-index:contains(postsIndex)', '#qunit-fixture').length, 1, "The posts/index template was rendered");
// });

// test("Generating a URL should not affect currentModel", function() {
//   Router.map(function() {
//     this.route("post", { path: "/posts/:post_id" });
//   });

//   var posts = {
//     1: { id: 1 },
//     2: { id: 2 }
//   };

//   App.PostRoute = Ember.Route.extend({
//     model: function(params) {
//       return posts[params.post_id];
//     }
//   });

//   bootApplication();

//   handleURL("/posts/1");

//   var route = container.lookup('route:post');
//   equal(route.modelFor('post'), posts[1]);

//   var url = router.generate('post', posts[2]);
//   equal(url, "/posts/2");

//   equal(route.modelFor('post'), posts[1]);
// });


// test("Generated route should be an instance of App.Route if provided", function() {
//   var generatedRoute;

//   Router.map(function() {
//     this.route('posts');
//   });

//   App.Route = Ember.Route.extend();

//   bootApplication();

//   handleURL("/posts");

//   generatedRoute = container.lookup('route:posts');

//   ok(generatedRoute instanceof App.Route, 'should extend the correct route');

// });

// test("Nested index route is not overriden by parent's implicit index route", function() {
//   Router.map(function() {
//     this.resource('posts', function() {
//       this.route('index', { path: ':category' } );
//     });
//   });

//   App.Route = Ember.Route.extend({
//     serialize: function(model) {
//       return { category: model.category };
//     }
//   });

//   bootApplication();

//   Ember.run(function() {
//     router.transitionTo('posts', { category: 'emberjs' });
//   });

//   deepEqual(router.location.path, '/posts/emberjs');
// });

// test("Application template does not duplicate when re-rendered", function() {
//   Ember.TEMPLATES.application = compile("<h3>I Render Once</h3>{{outlet}}");

//   Router.map(function() {
//     this.route('posts');
//   });

//   App.ApplicationRoute = Ember.Route.extend({
//     model: function() {
//       return Ember.A();
//     }
//   });

//   bootApplication();

//   // should cause application template to re-render
//   handleURL('/posts');

//   equal(Ember.$('h3:contains(I Render Once)').size(), 1);
// });

// test("Child routes should render inside the application template if the application template causes a redirect", function() {
//   Ember.TEMPLATES.application = compile("<h3>App</h3> {{outlet}}");
//   Ember.TEMPLATES.posts = compile("posts");

//   Router.map(function() {
//     this.route('posts');
//     this.route('photos');
//   });

//   App.ApplicationRoute = Ember.Route.extend({
//     afterModel: function() {
//       this.transitionTo('posts');
//     }
//   });

//   bootApplication();

//   equal(Ember.$('#qunit-fixture > div').text(), "App posts");
// });

// test("The template is not re-rendered when the route's context changes", function() {
//   Router.map(function() {
//     this.route("page", { path: "/page/:name" });
//   });

//   App.PageRoute = Ember.Route.extend({
//     model: function(params) {
//       return Ember.Object.create({name: params.name});
//     }
//   });

//   var insertionCount = 0;
//   App.PageView = Ember.View.extend({
//     didInsertElement: function() {
//       insertionCount += 1;
//     }
//   });

//   Ember.TEMPLATES.page = Ember.Handlebars.compile(
//     "<p>{{name}}</p>"
//   );

//   bootApplication();

//   handleURL("/page/first");

//   equal(Ember.$('p', '#qunit-fixture').text(), "first");
//   equal(insertionCount, 1);

//   handleURL("/page/second");

//   equal(Ember.$('p', '#qunit-fixture').text(), "second");
//   equal(insertionCount, 1, "view should have inserted only once");

//   Ember.run(function() {
//     router.transitionTo('page', Ember.Object.create({name: 'third'}));
//   });

//   equal(Ember.$('p', '#qunit-fixture').text(), "third");
//   equal(insertionCount, 1, "view should still have inserted only once");
// });


// test("The template is not re-rendered when two routes present the exact same template, view, & controller", function() {
//   Router.map(function() {
//     this.route("first");
//     this.route("second");
//     this.route("third");
//     this.route("fourth");
//   });

//   App.SharedRoute = Ember.Route.extend({
//     setupController: function(controller) {
//       this.controllerFor('shared').set('message', "This is the " + this.routeName + " message");
//     },

//     renderTemplate: function(controller, context) {
//       this.render({ controller: 'shared' });
//     }
//   });

//   App.FirstRoute = App.SharedRoute.extend();
//   App.SecondRoute = App.SharedRoute.extend();
//   App.ThirdRoute = App.SharedRoute.extend();
//   App.FourthRoute = App.SharedRoute.extend();

//   App.SharedController = Ember.Controller.extend();

//   var insertionCount = 0;
//   App.SharedView = Ember.View.extend({
//     templateName: 'shared',
//     didInsertElement: function() {
//       insertionCount += 1;
//     }
//   });
//   App.FirstView = App.SharedView;
//   App.SecondView = App.SharedView;
//   App.ThirdView = App.SharedView;
//   App.FourthView = App.SharedView.extend(); // Extending, in essence, creates a different view

//   Ember.TEMPLATES.shared = Ember.Handlebars.compile(
//     "<p>{{message}}</p>"
//   );

//   bootApplication();

//   handleURL("/first");

//   equal(Ember.$('p', '#qunit-fixture').text(), "This is the first message");
//   equal(insertionCount, 1);

//   // Transition by URL
//   handleURL("/second");

//   equal(Ember.$('p', '#qunit-fixture').text(), "This is the second message");
//   equal(insertionCount, 1, "view should have inserted only once");

//   // Then transition directly by route name
//   Ember.run(function() {
//     router.transitionTo('third');
//   });

//   equal(Ember.$('p', '#qunit-fixture').text(), "This is the third message");
//   equal(insertionCount, 1, "view should still have inserted only once");

//   // Lastly transition to a different view, with the same controller and template
//   handleURL("/fourth");

//   equal(Ember.$('p', '#qunit-fixture').text(), "This is the fourth message");
//   equal(insertionCount, 2, "view should have inserted a second time");

// });

// test("ApplicationRoute with model does not proxy the currentPath", function() {
//   var model = {};
//   var currentPath;

//   App.ApplicationRoute = Ember.Route.extend({
//     model: function () { return model; }
//   });

//   App.ApplicationController = Ember.ObjectController.extend({
//     currentPathDidChange: Ember.observer(function() {
//       currentPath = get(this, 'currentPath');
//     }, 'currentPath')
//   });

//   bootApplication();

//   handleURL("/");

//   equal(currentPath, 'index', 'currentPath is index');
//   equal('currentPath' in model, false, 'should have defined currentPath on controller');
// });

// asyncTest("Promises encountered on app load put app into loading state until resolved", function() {

//   expect(2);

//   App.IndexRoute = Ember.Route.extend({
//     model: function() {

//       Ember.run.next(function() {
//         equal(Ember.$('p', '#qunit-fixture').text(), "LOADING", "The loading state is displaying.");
//       });

//       return new Ember.RSVP.Promise(function(resolve) {
//         setTimeout(function() {
//           Ember.run(function() {
//             resolve();
//           });
//           equal(Ember.$('p', '#qunit-fixture').text(), "INDEX", "The index route is display.");
//           start();
//         }, 20);
//       });
//     }
//   });

//   Ember.TEMPLATES.index = Ember.Handlebars.compile("<p>INDEX</p>");
//   Ember.TEMPLATES.loading = Ember.Handlebars.compile("<p>LOADING</p>");

//   bootApplication();

// });

// test("Route should tear down multiple outlets", function() {
//   Ember.TEMPLATES.application = compile("{{outlet menu}}{{outlet}}{{outlet footer}}");
//   Ember.TEMPLATES.posts = compile("{{outlet}}");
//   Ember.TEMPLATES.users = compile("users");
//   Ember.TEMPLATES['posts/index'] = compile("postsIndex");
//   Ember.TEMPLATES['posts/menu'] = compile("postsMenu");
//   Ember.TEMPLATES['posts/footer'] = compile("postsFooter");

//   Router.map(function() {
//     this.resource("posts", function() {});
//     this.resource("users", function() {});
//   });

//   App.PostsMenuView = Ember.View.extend({
//     tagName: 'div',
//     templateName: 'posts/menu',
//     classNames: ['posts-menu']
//   });

//   App.PostsIndexView = Ember.View.extend({
//     tagName: 'p',
//     classNames: ['posts-index']
//   });

//   App.PostsFooterView = Ember.View.extend({
//     tagName: 'div',
//     templateName: 'posts/footer',
//     classNames: ['posts-footer']
//   });

//   App.PostsRoute = Ember.Route.extend({
//     renderTemplate: function() {
//       this.render('postsMenu', {
//         into: 'application',
//         outlet: 'menu'
//       });

//       this.render();

//       this.render('postsFooter', {
//         into: 'application',
//         outlet: 'footer'
//       });
//     }
//   });

//   bootApplication();

//   handleURL('/posts');

//   equal(Ember.$('div.posts-menu:contains(postsMenu)', '#qunit-fixture').length, 1, "The posts/menu template was rendered");
//   equal(Ember.$('p.posts-index:contains(postsIndex)', '#qunit-fixture').length, 1, "The posts/index template was rendered");
//   equal(Ember.$('div.posts-footer:contains(postsFooter)', '#qunit-fixture').length, 1, "The posts/footer template was rendered");

//   handleURL('/users');

//   equal(Ember.$('div.posts-menu:contains(postsMenu)', '#qunit-fixture').length, 0, "The posts/menu template was removed");
//   equal(Ember.$('p.posts-index:contains(postsIndex)', '#qunit-fixture').length, 0, "The posts/index template was removed");
//   equal(Ember.$('div.posts-footer:contains(postsFooter)', '#qunit-fixture').length, 0, "The posts/footer template was removed");

// });


// test("Route supports clearing outlet explicitly", function() {
//   Ember.TEMPLATES.application = compile("{{outlet}}{{outlet modal}}");
//   Ember.TEMPLATES.posts = compile("{{outlet}}");
//   Ember.TEMPLATES.users = compile("users");
//   Ember.TEMPLATES['posts/index'] = compile("postsIndex {{outlet}}");
//   Ember.TEMPLATES['posts/modal'] = compile("postsModal");
//   Ember.TEMPLATES['posts/extra'] = compile("postsExtra");

//   Router.map(function() {
//     this.resource("posts", function() {});
//     this.resource("users", function() {});
//   });

//   App.PostsIndexView = Ember.View.extend({
//     classNames: ['posts-index']
//   });

//   App.PostsModalView = Ember.View.extend({
//     templateName: 'posts/modal',
//     classNames: ['posts-modal']
//   });

//   App.PostsExtraView = Ember.View.extend({
//     templateName: 'posts/extra',
//     classNames: ['posts-extra']
//   });

//   App.PostsRoute = Ember.Route.extend({
//     events: {
//       showModal: function() {
//         this.render('postsModal', {
//           into: 'application',
//           outlet: 'modal'
//         });
//       },
//       hideModal: function() {
//         this.disconnectOutlet({outlet: 'modal', parentView: 'application'});
//       }
//     }
//   });

//   App.PostsIndexRoute = Ember.Route.extend({
//     events: {
//       showExtra: function() {
//         this.render('postsExtra', {
//           into: 'posts/index'
//         });
//       },
//       hideExtra: function() {
//         this.disconnectOutlet({parentView: 'posts/index'});
//       }
//     }
//   });

//   bootApplication();

//   handleURL('/posts');

//   equal(Ember.$('div.posts-index:contains(postsIndex)', '#qunit-fixture').length, 1, "The posts/index template was rendered");
//   Ember.run(function() {
//     router.send('showModal');
//   });
//   equal(Ember.$('div.posts-modal:contains(postsModal)', '#qunit-fixture').length, 1, "The posts/modal template was rendered");
//   Ember.run(function() {
//     router.send('showExtra');
//   });
//   equal(Ember.$('div.posts-extra:contains(postsExtra)', '#qunit-fixture').length, 1, "The posts/extra template was rendered");
//   Ember.run(function() {
//     router.send('hideModal');
//   });
//   equal(Ember.$('div.posts-modal:contains(postsModal)', '#qunit-fixture').length, 0, "The posts/modal template was removed");
//   Ember.run(function() {
//     router.send('hideExtra');
//   });
//   equal(Ember.$('div.posts-extra:contains(postsExtra)', '#qunit-fixture').length, 0, "The posts/extra template was removed");

//   handleURL('/users');

//   equal(Ember.$('div.posts-index:contains(postsIndex)', '#qunit-fixture').length, 0, "The posts/index template was removed");
//   equal(Ember.$('div.posts-modal:contains(postsModal)', '#qunit-fixture').length, 0, "The posts/modal template was removed");
//   equal(Ember.$('div.posts-extra:contains(postsExtra)', '#qunit-fixture').length, 0, "The posts/extra template was removed");
// });

// test("Aborting/redirecting the transition in `willTransition` prevents LoadingRoute from being entered", function() {

//   expect(8);

//   Router.map(function() {
//     this.route("nork");
//     this.route("about");
//   });

//   var redirect = false;

//   App.IndexRoute = Ember.Route.extend({
//     events: {
//       willTransition: function(transition) {
//         ok(true, "willTransition was called");
//         if (redirect) {
//           // router.js won't refire `willTransition` for this redirect
//           this.transitionTo('about');
//         } else {
//           transition.abort();
//         }
//       }
//     }
//   });

//   var deferred = null;

//   App.LoadingRoute = Ember.Route.extend({
//     activate: function() {
//       ok(deferred, "LoadingRoute should be entered at this time");
//     },
//     deactivate: function() {
//       ok(true, "LoadingRoute was exited");
//     }
//   });

//   App.NorkRoute = Ember.Route.extend({
//     activate: function() {
//       ok(true, "NorkRoute was entered");
//     }
//   });

//   App.AboutRoute = Ember.Route.extend({
//     activate: function() {
//       ok(true, "AboutRoute was entered");
//     },
//     model: function() {
//       if (deferred) { return deferred.promise; }
//     }
//   });

//   bootApplication();

//   // Attempted transitions out of index should abort.
//   Ember.run(router, 'transitionTo', 'nork');
//   Ember.run(router, 'handleURL', '/nork');

//   // Attempted transitions out of index should redirect to about
//   redirect = true;
//   Ember.run(router, 'transitionTo', 'nork');
//   Ember.run(router, 'transitionTo', 'index');

//   // Redirected transitions out of index to a route with a
//   // promise model should pause the transition and
//   // activate LoadingRoute
//   deferred = Ember.RSVP.defer();
//   Ember.run(router, 'transitionTo', 'nork');
//   Ember.run(deferred.resolve);
// });

// test("Events can be handled by inherited event handlers", function() {

//   expect(4);

//   App.SuperRoute = Ember.Route.extend({
//     events: {
//       foo: function() {
//         ok(true, 'foo');
//       },
//       bar: function(msg) {
//         equal(msg, "HELLO");
//       }
//     }
//   });

//   App.RouteMixin = Ember.Mixin.create({
//     events: {
//       bar: function(msg) {
//         equal(msg, "HELLO");
//         this._super(msg);
//       }
//     }
//   });

//   App.IndexRoute = App.SuperRoute.extend(App.RouteMixin, {
//     events: {
//       baz: function() {
//         ok(true, 'baz');
//       }
//     }
//   });

//   bootApplication();

//   router.send("foo");
//   router.send("bar", "HELLO");
//   router.send("baz");
// });

