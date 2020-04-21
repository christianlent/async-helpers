/*!
 * async-helpers <https://github.com/doowb/async-helpers>
 *
 * Copyright (c) 2015-2017, Brian Woodward.
 * Released under the MIT License.
 */

"use strict";

import typeOf from "kind-of";
import co from "co";

type RegExpy = RegExp | string;
interface Options {
  prefix?: string;
}
interface WrapOptions {
  wrap?: boolean;
}
type Error = any;
type Callback = (err: Error, fn?: string | Helper) => void;
type Arguments = any[];
interface Token {
  context?: Wrapper;
  name?: string;
  async: boolean;
  prefix: string;
  num: number;
  id: string;
  fn: string | Helper;
  args: Arguments;
}
type Wrapper = () => Token;
type HelperGroup = {
  (): void;
  isGroup?: boolean;
};
type Helper = {
  (): string;
  async?: boolean;
  displayName?: string;
  name: string;
  wrapped?: boolean;
};
type Helpers = {
  [key: string]: Helper | Helpers;
};

/**
 * Caches
 */
const cache: {
  [key: string]: RegExpy;
} = {};
let stash: {
  [key: string]: Token;
} = {};

/**
 * Format an error message to provide better information about the
 * helper and the arguments passed to the helper when the error occurred.
 *
 * @param  {Object} `err` Error object
 * @param  {Object} `helper` helper object to provide more information
 * @param  {Array} `args` Array of arguments passed to the helper.
 * @return {Object} Formatted Error object
 */

function formatError(err: Error, helper: Token, args: Arguments) {
  err.helper = helper;

  Object.defineProperty(err, "args", {
    configurable: true,
    value: args,
  });
  return err;
}

/**
 * Create a prefix to use when generating an async id.
 *
 * @param  {String} `prefix` prefix string to start with.
 * @param  {String} `counter` string to append.
 * @return {String} new prefix
 */

function appendPrefix(prefix: string, counter: number | string) {
  return prefix + counter + "$";
}

/**
 * Create an async id from the provided prefix and counter.
 *
 * @param  {String} `prefix` prefix string to start with
 * @param  {String} `counter` string to append.
 * @return {String} async id
 */

function createId(prefix: string, counter: number) {
  return appendPrefix(prefix, counter) + "}";
}

/**
 * Create a string to pass into `RegExp` for checking for and finding async ids.
 * @param  {String} `prefix` prefix to use for the first part of the regex
 * @return {String} string to pass into `RegExp`
 */

function createRegexString(prefix: string) {
  const key = "createRegexString:" + prefix;
  if (cache.hasOwnProperty(key)) {
    return cache[key];
  }
  const str = (prefix + "(\\d+)$}").replace(/\\?([${}])/g, "\\$1");
  cache[key] = str;
  return str;
}

/**
 * Create a regular expression based on the given `prefix`.
 * @param  {String} `prefix`
 * @return {RegExp}
 */

function toRegex(prefix: string) {
  const key = appendPrefix(prefix, "(\\d+)");
  if (cache.hasOwnProperty(key)) {
    return cache[key];
  }
  const regex = new RegExp(createRegexString(key), "g");
  cache[key] = regex;
  return regex;
}

/**
 * Return true if the given value is a helper "group"
 */

function isHelperGroup(helpers: Helper | Helpers | HelperGroup) {
  if (!helpers) return false;
  if ((helpers as HelperGroup).isGroup) {
    return true;
  }
  if (typeof helpers === "function" || typeof helpers === "object") {
    const keys = Object.keys(helpers).filter(function (name) {
      return ["async", "sync", "displayName"].indexOf(name) === -1;
    });
    return keys.length > 1;
  }
  return false;
}

class AsyncHelpers {
  /**
   * Keep track of instances created for generating globally
   * unique ids
   * @type {Number}
   */
  private static globalCounter = 0;
  private globalCounter = 0;
  private helpers: Helpers = {};
  private counter = 0;
  private prefix: string;
  private prefixRegex: RegExpy;
  private options: Options;

  /**
   * Create a new instance of AsyncHelpers
   *
   * ```js
   * var asyncHelpers = new AsyncHelpers();
   * ```
   *
   * @param {Object} `options` options to pass to instance
   * @return {Object} new AsyncHelpers instance
   * @api public
   */
  constructor(options: Options) {
    this.options = { ...options };
    this.prefix = this.options.prefix || "{$ASYNCID$";
    this.globalCounter = AsyncHelpers.globalCounter++;
    this.prefixRegex = toRegex(this.prefix);
    this.resolveId = this.resolveId.bind(this);
    this.resolveArgs = this.resolveArgs.bind(this);
    this.resolveObject = this.resolveObject.bind(this);
  }

  /**
   * Add a helper to the cache.
   *
   * ```js
   * asyncHelpers.set('upper', function(str, cb) {
   *   cb(null, str.toUpperCase());
   * });
   * ```
   *
   * @param {String} `name` Name of the helper
   * @param {Function} `fn` Helper function
   * @return {Object} Returns `this` for chaining
   * @api public
   */
  set = (name: Helpers | string, fn: Helper | Helpers): AsyncHelpers => {
    if (typeof name === "object") {
      const keys = Object.keys(name);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        this.set(key, name[key]);
      }
      return this;
    }

    if (typeof name !== "string") {
      throw new TypeError("AsyncHelpers#set: expected `name` to be a string");
    }
    if (typeof fn !== "function" && typeof fn !== "object") {
      throw new TypeError(
        "AsyncHelpers#set: expected `fn` to be a function or object"
      );
    }

    this.helpers[name] = fn;
    return this;
  };

  /**
   * Get all helpers or a helper with the given name.
   *
   * ```js
   * var helpers = asyncHelpers.get();
   * var wrappedHelpers = asyncHelpers.get({wrap: true});
   * ```
   *
   * @param  {String} `name` Optionally pass in a name of a helper to get.
   * @param  {Object} `options` Additional options to use.
   *   @option {Boolean} `wrap` Wrap the helper(s) with async processing capibilities
   * @return {Function|Object} Single helper function when `name` is provided, otherwise object of all helpers
   * @api public
   */

  get = (helper: string | WrapOptions, options?: WrapOptions) => {
    if (typeof helper === "string") {
      return this.wrapHelper(helper, options);
    }
    return this.wrapHelpers(this.helpers, helper);
  };

  /**
   * Wrap a helper with async handling capibilities.
   *
   * ```js
   * var wrappedHelper = asyncHelpers.wrap('upper');
   * var wrappedHelpers = asyncHelpers.wrap();
   * ```
   *
   * @param  {String} `helper` Optionally pass the name of the helper to wrap
   * @return {Function|Object} Single wrapped helper function when `name` is provided, otherwise object of all wrapped helpers.
   * @api public
   */

  wrapHelper = (
    helper: string | Helper | Helpers,
    options?: WrapOptions
  ): Helper | Helpers => {
    if (typeof helper === "object" && typeof options === "undefined") {
      options = helper;
      helper = this.helpers;
    }

    options = options || {};
    helper = helper || this.helpers;

    if (typeof helper === "string") {
      return this.wrapHelper(this.helpers[helper], options);
    } else if (typeof helper === "object") {
      return this.wrapHelpers(helper, options);
    } else if (typeof helper === "function") {
      if (isHelperGroup(helper)) {
        return this.wrapHelpers(helper, options);
      }
      helper = helper as Helper;
      if (options.wrap && helper.wrapped !== true) {
        return this.wrapper(helper.name || helper.displayName, helper);
      }
      return helper;
    } else {
      throw new TypeError(
        "AsyncHelpers.wrapHelper: unsupported type: " + typeof helper
      );
    }
  };

  /**
   * Wrap an object of helpers to enable async handling
   * @param  {Object} `helpers`
   * @param  {Object} `options`
   */

  wrapHelpers = (helpers: Helpers | HelperGroup, options?: WrapOptions) => {
    if (typeof helpers !== "object" && isHelperGroup(helpers)) {
      throw new TypeError("expected helpers to be an object");
    }

    helpers = helpers as Helpers;

    const res: Helpers = {};
    const keys = Object.keys(helpers);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const helper = helpers[key];
      if (typeof helper === "object") {
        res[key] = this.wrapHelpers(helper, options);
      } else {
        if (helper.wrapped !== true) {
          if (
            typeOf(helper) === "function" &&
            !helper.name &&
            !helper.displayName
          ) {
            helper.displayName = key;
          }
          res[key] = this.wrapHelper(helper, options);
        } else {
          res[key] = helper;
        }
      }
    }
    return res;
  };

  /**
   * Returns a wrapper function for a single helper.
   * @param  {String} `name` The name of the helper
   * @param  {Function} `fn` The actual helper function
   * @return {String} Returns an async ID to use for resolving the value. ex: `{$ASYNCID$!$8$}`
   */

  wrapper = (name: string | undefined, fn: Helper): Helper => {
    const prefix = appendPrefix(this.prefix, this.globalCounter);
    const self = this;

    // wrap the helper and generate a unique ID for resolving it
    function wrapper(this: Wrapper) {
      const num = self.counter++;
      const id = createId(prefix, num);

      const token = {
        name,
        async: !!fn.async,
        prefix,
        num,
        id,
        fn,
        args: [].slice.call(arguments),
      };

      Object.defineProperty(token, "context", {
        configurable: true,
        value: this,
      });

      stash[id] = token;
      return id;
    }

    Object.defineProperty(wrapper, "wrapped", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(wrapper, "helperName", {
      configurable: true,
      value: name,
    });
    return wrapper;
  };

  /**
   * Reset all the stashed helpers.
   *
   * ```js
   * asyncHelpers.reset();
   * ```
   * @return {Object} Returns `this` to enable chaining
   * @api public
   */

  reset = () => {
    stash = {};
    this.counter = 0;
    return this;
  };

  /**
   * Get all matching ids from the given `str`
   * @return {Array} Returns an array of matching ids
   */

  matches = (str: string) => {
    if (typeof str !== "string") {
      throw new TypeError("AsyncHelpers#matches expects a string");
    }
    return str.match(this.prefixRegex);
  };

  /**
   * Returns true if the given string has an async helper id
   * @return {Boolean}
   */

  hasAsyncId = (str: string) => {
    if (typeof str !== "string") {
      throw new TypeError("AsyncHelpers#hasAsyncId expects a string");
    }
    return str.indexOf(this.prefix) !== -1;
  };

  /**
   * Resolve a stashed helper by the generated id.
   * This is a generator function and should be used with [co][]
   *
   * ```js
   * var upper = asyncHelpers.get('upper', {wrap: true});
   * var id = upper('doowb');
   *
   * co(asyncHelpers.resolveId(id))
   *   .then(console.log)
   *   .catch(console.error);
   *
   * //=> DOOWB
   * ```
   *
   * @param  {String} `key` ID generated when from executing a wrapped helper.
   * @api public
   */

  *resolveId(key: string) {
    if (typeof key !== "string") {
      throw new Error("AsyncHelpers#resolveId: expects `key` to be a string.");
    }

    const helper = stash[key];
    if (!helper) {
      throw new Error(
        'AsyncHelpers#resolveId: cannot resolve helper: "' + key + '"'
      );
    }

    const args = yield this.resolveArgs(helper);
    const self = this;
    let str;

    return yield function (cb: Callback) {
      if (typeof helper.fn !== "function") {
        cb(null, helper.fn);
        return;
      }

      const next = function (err: Error, val?: string | Helper) {
        if (typeof val !== "undefined") {
          helper.fn = val;
          cb(err, helper.fn);
          return;
        }
        cb(err, "");
        return;
      };

      if (helper.fn.async) {
        const callback = function (err: Error, result: string | Helper) {
          if (err) {
            next(formatError(err, helper, args));
            return;
          }

          if (typeof result === "string" && self.hasAsyncId(result)) {
            self.resolveIds(result, next);
            return;
          }

          next(null, result);
          return;
        };

        args.push(callback);
      }

      try {
        str = helper.fn.apply(helper.context, args);
        if (typeof str === "string" && self.hasAsyncId(str)) {
          self.resolveIds(str, next);
          return;
        }
      } catch (err) {
        next(formatError(err, helper, args));
        return;
      }

      if (!helper.fn.async) {
        next(null, str);
        return;
      }

      // do nothing
    };
  }

  /**
   * Generator function for resolving helper arguments
   * that contain async ids. This function should be used
   * with [co][].
   *
   * This is used inside `resolveId`:
   *
   * ```js
   * var args = yield co(asyncHelpers.resolveArgs(helper));
   * ```
   * @param {Object} `helper` helper object with an `argRefs` array.
   */

  *resolveArgs(helper: Token): any {
    for (let i = 0; i < helper.args.length; i++) {
      const arg = helper.args[i];
      if (!arg) continue;

      if (typeof arg === "string" && this.hasAsyncId(arg)) {
        helper.args[i] = yield this.resolveId(arg);
      } else if (typeof arg === "object" && typeof arg.hash === "object") {
        arg.hash = yield this.resolveObject(arg.hash);
      }
    }
    return helper.args;
  }

  /**
   * Generator function for resolving values on an object
   * that contain async ids. This function should be used
   * with [co][].
   *
   * This is used inside `resolveArgs`:
   *
   * ```js
   * var args = yield co(asyncHelpers.resolveObject(options.hash));
   * ```
   * @param {Object} `obj` object with with values that may be async ids.
   * @returns {Object} Object with resolved values.
   */

  *resolveObject(obj: any) {
    const keys = Object.keys(obj);
    const self = this;

    return yield keys.reduce(function (acc, key) {
      return co(function* () {
        const val = acc[key];
        if (typeof val === "string" && self.hasAsyncId(val)) {
          acc[key] = yield self.resolveId(val);
        }
        return acc;
      });
    }, obj);
  }

  /**
   * After rendering a string using wrapped async helpers,
   * use `resolveIds` to invoke the original async helpers and replace
   * the async ids with results from the async helpers.
   *
   * ```js
   * asyncHelpers.resolveIds(renderedString, function(err, content) {
   *   if (err) return console.error(err);
   *   console.log(content);
   * });
   * ```
   * @param  {String} `str` String containing async ids
   * @param  {Function} `cb` Callback function accepting an `err` and `content` parameters.
   * @api public
   */

  resolveIds = (str: any, cb: Callback) => {
    if (typeof cb !== "function") {
      throw new TypeError(
        "AsyncHelpers#resolveIds() expects a callback function."
      );
    }
    if (typeof str !== "string") {
      return cb(new TypeError("AsyncHelpers#resolveIds() expects a string."));
    }

    const matches = this.matches(str);
    const self = this;

    co(function* () {
      if (!matches) {
        return str;
      }

      for (let i = 0; i < matches.length; i++) {
        const key = matches[i];
        const val = yield self.resolveId(key);
        str = str.split(key).join(val);
      }
      return str;
    })
      .then((res) => cb(null, res))
      .catch(cb);
  };
}

/**
 * Expose `AsyncHelpers`
 */
module.exports = AsyncHelpers;
