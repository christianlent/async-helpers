/*!
 * async-helpers <https://github.com/doowb/async-helpers>
 *
 * Copyright (c) 2015-2017, Brian Woodward.
 * Released under the MIT License.
 */

'use strict';

const escapeRegex = require('escape-string-regexp');
const isAsyncFunction = require('is-async-function');

class AsyncHelpers {
  constructor(options) {
    this.options = Object.assign({}, options);
    this.prefix = this.options.prefix || '{$ASYNCID$';
    this.allHelpers = {};
    this.counter = 0;
    this.ids = {};
  }

  get(name) {
    if (!name || typeof name !== 'string') {
      return this.allHelpers;
    }
    return this.allHelpers[name];
  }

  helper(name, fn) {
    if (!name || typeof name !== 'string') {
      throw new TypeError('expect `name` to be non empty string');
    }
    if (!fn || typeof fn !== 'function') {
      throw new TypeError('expect `fn` to be function');
    }

    const type = Object.prototype.toString.call(fn);
    const isAsync = isAsyncFunction(fn);

    // If it is an regular async function or callback one
    // we are doing some magic, otherwise skip wrapping the normal ones.
    if (type.includes('Async') || isAsync) {
      const func = isAsync ? promisify(fn) : fn;
      const self = this;

      this.allHelpers[name] = function wrapped(...args) {
        self.counter += 1;
        const id = `{$ASYNCID$${Date.now()}$${name}$${self.counter}$}`;
        self.ids[id] = { id, count: self.counter, context: this || {}, fn: func, name, args };
        return id;
      };
    } else {
      this.allHelpers[name] = fn;
    }

    return this;
  }

  helpers(obj) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach((key) => {
        this.helper(key, obj[key]);
      });
      return this;
    }
    throw new TypeError('expect `obj` to be object of helpers');
  }

  async resolve(str) {
    const self = this;
    const promises = Object.keys(this.ids)
      .map((id) => this.ids[id])
      .map(async({ id, args, fn, context }) => {

        const argz = args.map(function func(arg) {
          const item = self.ids[arg];
          return item
            ? item.fn.call(item.context, ...item.args.map(func))
            : arg;
        });

        this.ids[id].value = await fn.call(context, ...(await Promise.all(argz)));

        return this.ids[id];
      });

    return Promise.all(promises).then((res) =>
      res.reduce(
        (acc, { id, value }) =>
          acc.replace(new RegExp(escapeRegex(id), 'g'), value),
        str,
      ),
    );
  }
}

function promisify(fn) {
  return function func(...args) {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err, ...argz) => {
        if (err) {
          reject(err);
        } else {
          resolve(...argz);
        }
      });
    });
  };
}

module.exports = (options) => new AsyncHelpers(options);
