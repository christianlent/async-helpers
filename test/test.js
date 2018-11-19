'use strict';

var assert = require('assert');
var AsyncHelpers = require('../index');
var asyncHelpers = null;

describe('async-helpers', function() {
  beforeEach(function() {
    AsyncHelpers.globalCounter = 0;
    asyncHelpers = new AsyncHelpers();
  });
  describe('set', function() {

    it('should throw error if name not a string', () => {
      assert.throws(() => asyncHelpers.helper(123), TypeError);
      assert.throws(() => asyncHelpers.helper(123), /expect `name` to be non empty string/);
    });

    it('should throw error if fn not a function', () => {
      assert.throws(() => asyncHelpers.helper('abc', 123), TypeError);
      assert.throws(() => asyncHelpers.helper('abc', 123), /expect `fn` to be function/);
    });

    it('should throw error if object value is not a function', () => {
      assert.throws(() => asyncHelpers.helper({ abc: 123 }), TypeError);
      assert.throws(() => asyncHelpers.helper({ abc: 123 }), /expect `fn` to be function/);
      assert.ok(asyncHelpers.helper({ abc: () => {} }));
    });

    it('should set a sync helper', function() {
      var upper = function(str) {
        return str.toUpperCase();
      };
      asyncHelpers.helper('upper', upper);
      assert(typeof asyncHelpers.rawHelpers.upper !== 'undefined', 'upper should be defined on `rawHelpers`');
      assert.deepEqual(asyncHelpers.rawHelpers.upper.toString(), upper.toString());
    });

    it('should set an async helper', function() {
      asyncHelpers.helper('upper', (str, cb) => {
        cb(null, str.toUpperCase());
      });

      assert(typeof asyncHelpers.rawHelpers.upper !== 'undefined', 'upper should be defined on `rawHelpers`');
      assert(asyncHelpers.rawHelpers.upper);
    });
  });

  describe('get', function() {
    it('should get the helper as is', function() {
      const upper = (str) => str && str.toUpperCase();
      asyncHelpers.helper('upper', upper);

      assert.deepEqual(asyncHelpers.helper('upper').toString(), upper.toString());
      assert.deepEqual(asyncHelpers.rawHelpers.upper.toString(), upper.toString());
    });

    it('should get all "raw" (non wrapped) helpers', function() {
      asyncHelpers.helper('upper', (str) => str && str.toUpperCase());
      asyncHelpers.helper('lower', (str) => str && str.toLowerCase());

      assert.deepEqual(Object.keys(asyncHelpers.helper()), ['upper', 'lower']);
      assert.deepEqual(Object.keys(asyncHelpers.rawHelpers), ['upper', 'lower']);
    });

    it('should get all wrapped helpers', function() {
      asyncHelpers.helper('upper', (str) => str && str.toUpperCase());
      asyncHelpers.helper('lower', (str) => str && str.toLowerCase());

      assert.deepEqual(Object.keys(asyncHelpers.wrapHelper()), ['upper', 'lower']);
      assert.deepEqual(Object.keys(asyncHelpers.wrappedHelpers), ['upper', 'lower']);
    });
  });

  describe('helpers', function() {
    it('should return actual value when not wrapped and not async', function() {
      var upper = function(str) {
        return str.toUpperCase();
      };
      asyncHelpers.helper('upper', upper);
      assert.strictEqual(typeof asyncHelpers.helper('upper'), 'function');
      assert.strictEqual(asyncHelpers.helper('upper')('doowb'), 'DOOWB');
    });

    it('should return an async id when helper is asynchronous', async() => {
      asyncHelpers.helper('upperAsync', async(str) => str && str.toUpperCase());
      asyncHelpers.helper('upperCb', (str, cb) => {
        cb(null, str && str.toUpperCase());
      });

      // we need to use `.wrapHelper`, instead of `.helper` method
      // because `helper` gets the raw "as is" helper, as it was defined.
      // Only the wrapped helpers are returning async ids.
      const upperAsync = asyncHelpers.wrapHelper('upperAsync');
      const upperCb = asyncHelpers.wrapHelper('upperCb');

      assert.ok(asyncHelpers.prefix === '@@@ASYNCID@', 'default async id prefix should be @@@ASYNCID@');

      // we dont need `await`, because the returned wrapped
      // helper is always a regular function
      const resAsync = upperAsync('doowb');
      assert.ok(resAsync.startsWith(asyncHelpers.prefix));

      const resCb = upperCb('doowb');
      assert.ok(resCb.startsWith(asyncHelpers.prefix));

      // non wrapped helper
      const upper = asyncHelpers.helper('upperAsync');

      // we need `await` here, because the helper is regular `async` function
      const res = await upper('foobar');
      assert.strictEqual(res, 'FOOBAR');
    });

    it('should return an async id with a custom prefix', async function() {
      const customPrefix = '~!@custom@prefix@@';
      var asyncHelpers2 = new AsyncHelpers({ prefix: customPrefix });

      assert.ok(asyncHelpers2.prefix === customPrefix, 'incorrect prefix');

      asyncHelpers2.helper('upper', (str, cb) => {
        cb(null, str.toUpperCase());
      });

      const upper = asyncHelpers2.wrapHelper('upper');
      assert.ok((await upper('doowb')).startsWith(customPrefix));
    });

    it('should support helpers that take arrays as an argument', function() {
      var async = require('async');
      // function to use as an iterator
      var upper = function(str, next) {
        next(null, str.toUpperCase());
      };
      // use the async mapSeries function for the helper
      var map = async.mapSeries;

      asyncHelpers.helper('map', map);
      var wrappedHelper = asyncHelpers.wrapHelper('map');

      // call the helper to get the id
      var id = wrappedHelper(['doowb', 'jonschlinkert'], upper);
      assert.ok(id.startsWith(asyncHelpers.prefix));

      return asyncHelpers.resolveIds(id)
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

      asyncHelpers.helper('user', user);
      asyncHelpers.helper('profile', profile);

      var userHelper = asyncHelpers.wrapHelper('user');
      var userId = userHelper('doowb');

      assert.ok(userId.startsWith(asyncHelpers.prefix));

      var profileHelper = asyncHelpers.wrapHelper('profile');
      var profileId = profileHelper(userId);

      return asyncHelpers.resolveIds(profileId).then(function(val) {
        assert.deepEqual(val, 'doowb');
      });
    });

    it('should support sync and async value items in argument arrays', () => {
      const helpers = new AsyncHelpers();

      helpers.wrapHelper('upperAsync', async(val) => val && val.toUpperCase());

      const upperAsync = helpers.wrapHelper('upperAsync');
      const upperAsyncId = upperAsync('qux');

      helpers.wrapHelper('addOne', (arr) => arr.map((x) => x + 1));

      const addOneHelper = helpers.wrapHelper('addOne');
      const result = addOneHelper(['aaa', upperAsyncId, 'foo', upperAsync('bar')]);

      return helpers.resolveId(result).then((res) => {
        assert.deepStrictEqual(res, ['aaa1', 'QUX1', 'foo1', 'BAR1']);
      });
    });
  });

  describe('errors', function() {
    it('should handle thrown errors in sync helpers', function() {
      var asyncHelpers3 = new AsyncHelpers();
      var upper = function(str) {
        throw new Error('yeah UPPER sync Error');
      };
      asyncHelpers3.helper('upper', upper);

      // We need to wrap the helper, to test this
      // because the non-wrapped one will throw directly,
      // even before the `resolveIds` call.
      // Because the `.helper()` method does nothing more than just type checking
      // and adding/getting to/from a key value cache.
      var wrappedHelper = asyncHelpers3.wrapHelper('upper');
      var id = wrappedHelper('doowb');

      return asyncHelpers3.resolveIds(id)
        .then(function(val) {
          return Promise.reject(new Error('expected an error'));
        })
        .catch(function(err) {
          assert.ok(/yeah UPPER sync Error/.test(err.message), 'expect to throw from sync helper');
        });
    });

    it('should handle errors in async helpers', function() {
      var asyncHelpers3 = new AsyncHelpers();
      var upper = function(str, next) {
        throw new Error('UPPER Error');
      };

      asyncHelpers3.helper('upper', upper);

      var helper = asyncHelpers3.wrapHelper('upper');
      var id = helper('doowb');

      return asyncHelpers3.resolveIds(id)
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

      asyncHelpers3.helper('upper', upper);

      var helper = asyncHelpers3.wrapHelper('upper');
      var id = helper('doowb');

      return asyncHelpers3.resolveIds(id)
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

      asyncHelpers3.helper('upper', upper);

      var helper = asyncHelpers3.wrapHelper('upper');
      var obj = {username: 'doowb'};
      obj.profile = obj;

      var id = helper(obj);

      return asyncHelpers3.resolveIds(id)
        .then(function(val) {
          return Promise.reject(new Error('expected an error'));
        })
        .catch(function(err) {
          assert.ok(/circular UPPER Error/.test(err.message), 'expect to throw from async helper');
        });
    });
  });

  describe('wrapHelper', () => {
    it('should throw when `fn` is not a function and `name` not find in rawHelpers ', () => {
      assert.throws(() => asyncHelpers.wrapHelper('upper'), TypeError);
      assert.throws(() => asyncHelpers.wrapHelper('upper'), /cannot find helper "upper" name/);
    });

    it('should return all defined helpers as wrapped', () => {
      asyncHelpers.helper('one', () => 1);
      asyncHelpers.helper('two', () => 2);
      asyncHelpers.wrapHelper('three', () => 3);
      asyncHelpers.wrapHelper('someAsync', async() => 4);

      const rawHelpers = asyncHelpers.helper();
      const wrappedHelpers = asyncHelpers.wrapHelper();

      assert.deepEqual(Object.keys(rawHelpers), ['one', 'two', 'three', 'someAsync']);
      assert.ok(wrappedHelpers.one);
      assert.ok(wrappedHelpers.two);
      assert.ok(wrappedHelpers.three);
      assert.ok(wrappedHelpers.someAsync);
    });

    it('returned wrapped helper should have `wrapped` prop on it which is true', () => {
      const wrappedHelper = asyncHelpers.wrapHelper('foobar', () => 123);

      assert.strictEqual(wrappedHelper.wrapped, true);
      assert.strictEqual(wrappedHelper().startsWith(asyncHelpers.prefix), true);

      assert.ok(asyncHelpers.wrapHelper('foobar').wrapped);

      const helper = asyncHelpers.helper('foobar');
      assert.strictEqual(helper.wrapped, undefined);
      assert.strictEqual(helper(), 123);
    });

    it('should return `fn` helper if it is already wrapped', () => {
      const wrappedHelper = asyncHelpers.wrapHelper('fooqux', () => 123);
      const helper = asyncHelpers.wrapHelper('fooqux', wrappedHelper);

      assert.strictEqual(wrappedHelper.toString(), helper.toString());
    });
  });

  describe('resolveId', () => {
    it('should return rejected promise when cannot find async id ', () => {
      return asyncHelpers.resolveId(123456)
        .then(() => {
          throw new Error('should throw an error');
        })
        .catch((err) => {
          assert.ok(/cannot resolve helper with/.test(err.message));
        });
    });
  });

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
