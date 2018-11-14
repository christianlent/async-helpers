'use strict';

var helpers = {
  handlebars: {
    upper: function(str) {
      return str.toUpperCase();
    },
    upperAsync: async(str) => str && str.toUpperCase(),
    getPartial: function(str, options, cb) {
      var args = [].slice.call(arguments);
      cb = args.pop();
      cb(null, str);
    },
    lower: function(str, options, cb) {
      cb(null, str.toLowerCase());
    },
    partialName: function partialName(options, cb) {
      cb(null, this.customName || options.hash.name);
    },
    is: function(val, options, cb) {
      cb(null, val === true);
    },
    equals: function(a, b, options, cb) {
      console.log('qq', arguments, a == b);
      cb(null, a == b);
    },
    spacer: function(str, delim, options, cb) {
      if (typeof delim === 'object') {
        cb = options;
        options = delim;
        delim = ' ';
      }
      cb(null, str.split('').join(delim));
    },
    block: function(options) {
      return options.fn(this);
    },
    useHash: function(options) {
      return options.fn(options.hash || {});
    },
    lookup: function(obj, prop) {
      return obj[prop];
    },
    sum: function(arr, options) {
      var args = [].slice.call(arguments);
      options = args.pop();
      var total = 0;
      for (var i = 0; i < args.length; i++) {
        if (Array.isArray[args[i]]) {
          total += helpers.handlebars.sum.apply(this, args[i].concat([options]));
        } else {
          total += args[i];
        }
      }
      return total;
    }
  },
  lodash: {
    upperAsync: async(str) => str && str.toUpperCase(),
    upper: function(str) {
      return str.toUpperCase();
    },
    lower: function(str, cb) {
      cb(null, str.toLowerCase());
    },
    spacer: function(str, delim, cb) {
      if (typeof delim === 'function') {
        cb = delim;
        delim = ' ';
      }
      cb(null, str.split('').join(delim));
    }
  }
};

module.exports = helpers;
