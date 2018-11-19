/*!
 * async-helpers <https://github.com/doowb/async-helpers>
 *
 * Copyright (c) 2015-2017, Brian Woodward.
 * Released under the MIT License.
 */

'use strict';

const util = require('util');
const isAsyncWithCb = require('is-async-function');

class AsyncHelpers {
  constructor(options) {
    this.options = Object.assign({}, options);
    this.helperIds = {};
    this.rawHelpers = {};
    this.wrappedHelpers = {};
    this.prefix = this.options.prefix || '@@@ASYNCID@';
    this.counter = 0;
  }

  /**
   * Define a helper `fn` with `name`.
   * If `fn` is missing or not a function, returns the helper with `name`.
   * If `name` is missing or not a string, returns all defined helpers.
   * If `name` is object, calls itself for each key/value pair.
   *
   * @name  .helper
   * @param {string|object|undefined} [name]
   * @param {function} [fn]
   * @returns {AsyncHelpers|function|object}
   * @memberof AsyncHelpers
   * @api public
   */
  helper(name, fn) {
    if (isObject(name)) {
      Object.keys(name).forEach((key) => {
        this.helper(key, name[key]);
      });
      return this;
    }
    if (!name) {
      return this.rawHelpers;
    }
    if (typeof name !== 'string') {
      throw new TypeError('AsyncHelpers#helper: expect `name` to be non empty string');
    }
    if (name && !fn) {
      return this.rawHelpers[name];
    }
    if (!fn || typeof fn !== 'function') {
      throw new TypeError('AsyncHelpers#helper: expect `fn` to be function');
    }
    this.rawHelpers[name] = fn;
    return this;
  }

  wrapHelper(name, helper) {
    if (isObject(name)) {
      Object.keys(name).forEach((key) => {
        this.wrapHelper(key, name[key]);
      });
      return this.wrappedHelpers;
    }
    // .wrapHelper() -> wrap all the raw ones
    if (!name) {
      return this.wrapHelper(this.rawHelpers);
    }
    helper = this.wrappedHelpers[name] || this.rawHelpers[name] || helper;

    if (helper && helper.wrapped) {
      return helper;
    }
    if (!helper) {
      throw new TypeError(`AsyncHelpers#wrapHelper: cannot find helper "${name}" name`);
    }
    const self = this;

    // if we only use `wrapHelper` as both defining and wrapping
    if (!this.rawHelpers[name]) {
      this.rawHelpers[name] = helper;
      this.rawHelpers[name].wrapped = undefined;
    }
    const fn = isAsyncWithCb(helper) ? util.promisify(helper) : helper;

    this.wrappedHelpers[name] = function wrappedHelper(...args) {
      self.counter += 1;
      const id = `${self.prefix}@${name}@${self.counter}@@@`;
      self.helperIds[id] = { id, name, args, fn, ctx: this || {}, count: self.counter };

      return id;
    };
    this.wrappedHelpers[name].wrapped = true;

    return this.wrappedHelpers[name];
  }

  hasAsyncId(val) {
    const re = new RegExp(`${this.prefix}@.+@\\d+@@@`, 'g');
    return val && typeof val === 'string' && re.test(val);
  }

  async resolveIds(str) {
    const promises = Object.keys(this.helperIds)
      .map(async(id) => {
        return { id, value: await this.resolveId(id)};
      });

    return Promise.all(promises).then((res) => {
      const result = res.reduce(
        (acc, { id, value }) => {
          if (acc === id) return value;
          return acc.replace(new RegExp(id, 'g'), value);
        },
        str,
      );

      return result;
    });
  }

  async resolveId(key) {
    if (!this.helperIds[key]) {
      throw new Error(`AsyncHelpers#resolveId: cannot resolve helper with "${key}" id`);
    }
    const { id, name, fn, args, ctx, value } = this.helperIds[key];

    if ('value' in this.helperIds[id]) {
      return value;
    }

    const argz = args.map(async(arg) => {
      const item = this.helperIds[arg];

      if (item) {
        return this.resolveId(item.id);
      }

      if (isObject(arg) && isObject(arg.hash)) {
        for (const [key, val] of Object.entries(arg.hash)) {
          arg.hash[key] = this.hasAsyncId(val) ? await this.resolveId(val) : val;
        }
        return arg;
      }
      if (Array.isArray(arg)) {
        const res = [];
        for (const ele of arg) {
          res.push(this.hasAsyncId(ele) ? await this.resolveId(ele) : ele);
        }
        return res;
      }
      return arg;
    });

    try {
      this.helperIds[id].value = await fn.apply(ctx, await Promise.all(argz));
    } catch (err) {
      const msg = `AsyncHelpers#resolveId: helper with name "${name}" and id "${id}" failed`;

      throw new Error(`${msg}: ${err.message}`);
    }

    const val = this.helperIds[id].value;
    if (this.hasAsyncId(val)) {
      return this.resolveIds(val);
    }

    return val;
  }
}

function isObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val);
}

module.exports = AsyncHelpers;
