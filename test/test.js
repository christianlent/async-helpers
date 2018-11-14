'use strict';

require('mocha');
var assert = require('assert');
var AsyncHelpers = require('../');
var asyncHelpers = null;

describe('async-helpers', function() {
  beforeEach(function() {
    AsyncHelpers.globalCounter = 0;
    asyncHelpers = new AsyncHelpers();
  });
  describe('set', function() {

    it('should throw error if name not a string', () => {
      assert.throws(() => asyncHelpers.set(123), TypeError);
      assert.throws(() => asyncHelpers.set(123), /expect `name` to be non empty string/);
    });

    it('should throw error if fn not a function', () => {
      assert.throws(() => asyncHelpers.set('abc', 123), TypeError);
      assert.throws(() => asyncHelpers.set('abc', 123), /expect `fn` to be function/);
    });

    it('should throw error if object value is not a function', () => {
      assert.throws(() => asyncHelpers.set({ abc: 123 }), TypeError);
      assert.throws(() => asyncHelpers.set({ abc: 123 }), /expect `fn` to be function/);
      assert.ok(asyncHelpers.set({ abc: () => {} }));
    });

    it('should set a sync helper', function() {
      var upper = function(str) {
        return str.toUpperCase();
      };
      asyncHelpers.set('upper', upper);
      assert(typeof asyncHelpers.helpers.upper !== 'undefined', 'upper should be defined on `helpers`');
      assert.deepEqual(asyncHelpers.helpers.upper.toString(), upper.toString());
    });

    it('should set an async helper', function() {
      var upper = function(str, cb) {
        cb(null, str.toUpperCase());
      };
      asyncHelpers.set('upper', upper);
      assert(typeof asyncHelpers.helpers.upper !== 'undefined', 'upper should be defined on `helpers`');
      assert(asyncHelpers.helpers.upper);
    });
  });

  describe('get', function() {
    it('should get the helper as is', function() {
      var upper = function(str) {
        return str.toUpperCase();
      };
      asyncHelpers.set('upper', upper);
      assert.deepEqual(asyncHelpers.get('upper').toString(), upper.toString());
    });

    it.skip('should get all helpers', function() {
      var upper = function(str) {
        return str.toUpperCase();
      };
      var lower = function(str) {
        return str.toLowerCase();
      };
      asyncHelpers.set('upper', upper);
      asyncHelpers.set('lower', lower);
      assert.deepEqual(Object.keys(asyncHelpers.get()), ['upper', 'lower']);
    });
  });

  describe('helpers', function() {
    it('should return actual value when not wrapped', function() {
      var upper = function(str) {
        return str.toUpperCase();
      };
      asyncHelpers.set('upper', upper);
      assert.deepEqual(asyncHelpers.get('upper')('doowb'), 'DOOWB');
    });

    it('should return an async id when helper is asynchronous', function() {
      var upper = async function(str) {
        return str.toUpperCase();
      };
      asyncHelpers.set('upper', upper);
      assert.ok(asyncHelpers.get('upper')('doowb').startsWith('{$ASYNCID$'));
    });

    it.skip('should increment globalCounter for multiple instances of AsyncHelpers', function() {
      var asyncHelpers2 = new AsyncHelpers();
      assert.notEqual(asyncHelpers.globalCounter, asyncHelpers2.globalCounter);
      assert.equal(asyncHelpers.globalCounter, 0);
      assert.equal(asyncHelpers2.globalCounter, 1);
    });

    it('should return an async id with a custom prefix', function() {
      var asyncHelpers2 = new AsyncHelpers({ prefix: '{$custom$prefix$$' });
      var upper = function(str, cb) {
        cb(null, str.toUpperCase());
      };
      asyncHelpers2.set('upper', upper);
      assert.ok(asyncHelpers2.get('upper')('doowb').startsWith('{$custom$prefix$$'));
    });

    it('should support helpers that take arrays as an argument', function() {
      var async = require('async');
      // function to use as an iterator
      var upper = function(str, next) {
        next(null, str.toUpperCase());
      };
      // use the async mapSeries function for the helper
      var map = async.mapSeries;

      asyncHelpers.set('map', map);
      var helper = asyncHelpers.get('map');

      // call the helper to get the id
      var id = helper(['doowb', 'jonschlinkert'], upper);
      assert.ok(id.startsWith('{$ASYNCID'));

      // resolveId the id
      return asyncHelpers.resolve(id)
        .then(function(val) {
          assert.deepEqual(val, ['DOOWB', 'JONSCHLINKERT']);
        });
    });

    it('should support helpers used as arguments that return objects', function() {
      var profile = function(user, next) {
        if (typeof user !== 'object') {
          return next(new Error('Expected user to be an object but got ' + (typeof user)));
        }
        next(null, user.name);
      };

      var user = function(name, next) {
        var res = {
          id: name,
          name: name
        };
        next(null, res);
      };

      asyncHelpers.set('user', user);
      asyncHelpers.set('profile', profile);
      var userHelper = asyncHelpers.get('user');
      var userId = userHelper('doowb');
      assert.ok(userId.startsWith('{$ASYNCID$'));

      var profileHelper = asyncHelpers.get('profile');
      var profileId = profileHelper(userId);

      return asyncHelpers.resolve(profileId).then(function(val) {
        assert.deepEqual(val, 'doowb');
      });
    });
  });

  describe('errors', function() {
    // Not make much sense, it should be handled by the template engine
    // We just care and handle only async helpers here.
    // The sync helpers are processed even on engine rendering,
    // even before the `.resolve()` calling.
    it.skip('should handle errors in sync helpers', function() {
      var asyncHelpers3 = new AsyncHelpers();
      var upper = function(str) {
        throw new Error('yeah UPPER Error');
      };
      asyncHelpers3.set('upper', upper);

      var helper = asyncHelpers3.get('upper');
      var id = helper('doowb');

      return asyncHelpers3.resolve(id)
        .then(function(val) {
          return Promise.reject(new Error('expected an error'));
        })
        .catch(function(err) {
          assert.ok(/yeah UPPER Error/.test(err.message), 'expect to throw from sync helper');
        });
    });

    it('should handle errors in async helpers', function() {
      var asyncHelpers3 = new AsyncHelpers();
      var upper = function(str, next) {
        throw new Error('UPPER Error');
      };
      upper.async = true;
      asyncHelpers3.set('upper', upper);
      var helper = asyncHelpers3.get('upper');
      var id = helper('doowb');

      return asyncHelpers3.resolve(id)
        .then(function(val) {
          return Promise.reject(new Error('expected an error'));
        })
        .catch(function(err) {
          assert.ok(/UPPER Error/.test(err.message), 'expect to throw from async helper');
        });
    });

    it('should handle returned errors in async helpers', function() {
      var asyncHelpers3 = new AsyncHelpers();
      var upper = function(str, next) {
        next(new Error('async returned UPPER Error'));
      };
      upper.async = true;
      asyncHelpers3.set('upper', upper);
      var helper = asyncHelpers3.get('upper');
      var id = helper('doowb');

      return asyncHelpers3.resolve(id)
        .then(function(val) {
          return Promise.reject(new Error('expected an error'));
        })
        .catch(function(err) {
          assert.ok(/async returned UPPER Error/.test(err.message), 'expect to throw from async helper');
        });
    });

    it('should handle errors with arguments with circular references', function() {
      var asyncHelpers3 = new AsyncHelpers();
      var upper = function(str, next) {
        throw new Error('circular UPPER Error');
      };

      asyncHelpers3.set('upper', upper);
      var helper = asyncHelpers3.get('upper');
      var obj = {username: 'doowb'};
      obj.profile = obj;
      var id = helper(obj);

      return asyncHelpers3.resolve(id)
        .then(function(val) {
          return Promise.reject(new Error('expected an error'));
        })
        .catch(function(err) {
          assert.ok(/circular UPPER Error/.test(err.message), 'expect to throw from async helper');
        });
    });
  });

  // describe('wrapHelper', function() {
  //   it('should return the helper when given the helper name', function() {
  //     var upper = function(str) {
  //       return str.toUpperCase();
  //     };
  //     asyncHelpers.set('upper', upper);
  //     var fn = asyncHelpers.wrapHelper('upper');
  //     assert.equal(fn, upper);
  //     assert.deepEqual(fn('doowb'), 'DOOWB');
  //   });

  //   it('should return the wrapped helper when given the helper name and wrap option is true', function() {
  //     var upper = function(str) {
  //       return str.toUpperCase();
  //     };
  //     asyncHelpers.set('upper', upper);
  //     var fn = asyncHelpers.wrapHelper('upper', {wrap: true});
  //     assert.notEqual(fn, upper);
  //     assert.notEqual(fn.toString(), upper.toString());
  //     assert.deepEqual(fn('doowb'), '{$ASYNCID$0$0$}');
  //   });

  //   it('should return a function when given a function', function() {
  //     var upper = function(str) {
  //       return str.toUpperCase();
  //     };
  //     var fn = asyncHelpers.wrapHelper(upper);
  //     assert.equal(fn, upper);
  //     assert.deepEqual(fn('doowb'), 'DOOWB');
  //   });

  //   it('should return a wrapped function when given a function and wrap option is true', function() {
  //     var upper = function(str) {
  //       return str.toUpperCase();
  //     };
  //     var fn = asyncHelpers.wrapHelper(upper, {wrap: true});
  //     assert.notEqual(fn, upper);
  //     assert.deepEqual(fn('doowb'), '{$ASYNCID$0$0$}');
  //   });

  //   it('should return an object of helpers when given an object of helpers', function() {
  //     var helpers = {
  //       upper: function(str) { return str.toUpperCase(); },
  //       lower: function(str) { return str.toLowerCase(); }
  //     };
  //     asyncHelpers.set(helpers);
  //     var obj = asyncHelpers.wrapHelper();
  //     assert.deepEqual(obj, helpers);
  //     assert.equal(obj.upper('doowb'), 'DOOWB');
  //     assert.equal(obj.lower('DOOWB'), 'doowb');
  //   });

  //   it('should return an object of wrapped helpers when given an object of helpers and wrap option is true', function() {
  //     var helpers = {
  //       upper: function(str) { return str.toUpperCase(); },
  //       lower: function(str) { return str.toLowerCase(); }
  //     };
  //     asyncHelpers.set(helpers);
  //     var obj = asyncHelpers.wrapHelper({wrap: true});
  //     assert.notDeepEqual(obj, helpers);
  //     assert.equal(obj.upper('doowb'), '{$ASYNCID$0$0$}');
  //     assert.equal(obj.lower('DOOWB'), '{$ASYNCID$0$1$}');
  //   });

  //   it.skip('should return an object of helpers from a helper group', function() {
  //     var helpers = function() {};
  //     helpers.isGroup = true;
  //     helpers.upper = function(str) { return str.toUpperCase(); };
  //     helpers.lower = function(str) { return str.toLowerCase(); };
  //     asyncHelpers.set('my-group', helpers);
  //     var res = asyncHelpers.wrapHelper('my-group');
  //     assert.deepEqual(res, helpers);
  //     assert.equal(res.upper('doowb'), 'DOOWB');
  //     assert.equal(res.lower('DOOWB'), 'doowb');
  //   });
  // });

  // describe('wrapHelpers', function() {

  // });

  // describe('wrapper', function() {

  // });

  // describe('reset', function() {

  // });

  // describe('matches', function() {

  // });

  // describe('hasAsyncId', function() {

  // });

  // describe('resolveId', function() {

  // });

  // describe('resolveArgs', function() {

  // });

  // describe('resolveObject', function() {

  // });

  // describe('resolveIds', function() {

  // });
});
