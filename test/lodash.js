'use strict';

var assert = require('assert');
var _ = require('lodash');
var helpers = require('./support/helpers').lodash;
var AsyncHelpers = require('../');

describe('lodash', function() {
  it('should work in lodash', function(done) {

    var asyncHelpers = AsyncHelpers();

    // add the helpers to asyncHelpers
    asyncHelpers.helper('upper', helpers.upper);
    asyncHelpers.helper('upperAsync', helpers.upperAsync);
    asyncHelpers.helper('lower', helpers.lower);
    asyncHelpers.helper('spacer', helpers.spacer);

    var wrapped = asyncHelpers.get();

    // using Lodash, render a template with helpers
    var tmpl = [
      'input: <%= name %>',
      'upper: <%= upper(name) %>',
      'upperAsync: <%= upperAsync(name) %>',
      'lower: <%= lower(name) %>',
      'spacer: <%= spacer(name) %>',
      'spacer-delim: <%= spacer(name, "-") %>',
      'lower(upper): <%= lower(upper(name)) %>',
      'spacer(upper, lower): <%= spacer(upper(name), lower("X")) %>'
    ].join('\n');

    // compile the template passing `helpers` in as `imports`
    var fn = _.template(tmpl, { imports: wrapped });

    // render the compiled template with the simple context object
    var rendered = fn({ name: 'doowb' });

    asyncHelpers.resolve(rendered)
      .then((content) => {
        assert.deepEqual(content, [
          'input: doowb',
          'upper: DOOWB',
          'upperAsync: DOOWB',
          'lower: doowb',
          'spacer: d o o w b',
          'spacer-delim: d-o-o-w-b',
          'lower(upper): doowb',
          'spacer(upper, lower): DxOxOxWxB'
        ].join('\n'));
        done();
      })
      .catch(done);
  });
});
