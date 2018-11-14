'use strict';

require('mocha');
var assert = require('assert');
var Handlebars = require('handlebars');
var helpers = require('./support/helpers').handlebars;
var AsyncHelpers = require('../');
var asyncHelpers;
var hbs;

// using Handlebars, render a template with the helpers
var tmpl = [
  'input: {{> (partialName name="foo") }}',
  'input: {{name}}',
  'upper: {{upper name}}',
  'upperAsync: {{upperAsync name}}',
  'lower: {{lower name}}',
  'spacer: {{spacer name}}',
  'spacer-delim: {{spacer name "-"}}',
  'lower(upper): {{lower (upper name)}}'
  // 'spacer(upper, lower): {{spacer (upper name) (lower "X")}}',
  // 'block: {{#block}}{{upper name}}{{/block}}',
  // 'ifConditional1: {{#if (equals "foo" foo)}}{{upper name}}{{/if}}',
  // 'ifConditional2: {{#if (equals "baz" bar)}}{{upper name}}{{/if}}',
  // 'useHash: {{#useHash me=(lookup this "person")}}{{me.first}} {{me.last}}{{/useHash}}',
  // 'sum: {{sum 1 2 3}}',
  // 'lookup(this "person"): {{lookup this "person"}}'
].join('\n');

describe('handlebars', function() {
  beforeEach(function() {
    hbs = Handlebars.create();
    hbs.registerPartial('custom', 'a partial');

    asyncHelpers = AsyncHelpers();
    asyncHelpers.helpers(hbs.helpers);

    // add the helpers to asyncHelpers
    asyncHelpers.helper('if', hbs.helpers.if);
    asyncHelpers.helper('getPartial', helpers.getPartial);
    asyncHelpers.helper('equals', helpers.equals);
    asyncHelpers.helper('partialName', helpers.partialName);
    asyncHelpers.helper('upper', helpers.upper);
    asyncHelpers.helper('upperAsync', helpers.upperAsync);
    asyncHelpers.helper('lower', helpers.lower);
    asyncHelpers.helper('spacer', helpers.spacer);
    asyncHelpers.helper('block', helpers.block);
    asyncHelpers.helper('useHash', helpers.useHash);
    asyncHelpers.helper('lookup', helpers.lookup);
    asyncHelpers.helper('sum', helpers.sum);
  });

  it('should work in handlebars', function(done) {
    var invokePartial = hbs.VM.invokePartial;
    hbs.VM.invokePartial = function(name, context, options) {
      // do stuff
      return invokePartial.call(hbs.VM, name, context, options);
    };

    // pull the helpers back out and wrap them
    // with async handling functionality
    var wrappedHelpers = asyncHelpers.get();

    // register the helpers with Handlebars
    hbs.registerHelper(wrappedHelpers);
    tmpl = tmpl.split('{{>').join('{{getPartial');

    // compile the template
    var fn = hbs.compile(tmpl);

    // render the template with a simple context object
    var rendered = fn({
      name: 'doowb',
      customName: 'custom',
      person: {
        first: 'Brian',
        last: 'Woodward',
        toString: function() { return this.first + ' ' + this.last; }
      },
      bar: 'baz'
    });

    console.log(rendered);

    asyncHelpers.resolve(rendered)
      .then(function(content) {
        console.log('content', content);
        assert.deepEqual(content, [
          'input: custom',
          'input: doowb',
          'upper: DOOWB',
          'upperAsync: DOOWB',
          'lower: doowb',
          'spacer: d o o w b',
          'spacer-delim: d-o-o-w-b',
          'lower(upper): doowb',
          'spacer(upper, lower): DxOxOxWxB',
          'block: DOOWB',
          'ifConditional1: ',
          'ifConditional2: DOOWB',
          'useHash: Brian Woodward',
          'sum: 6',
          'lookup(this "person"): Brian Woodward'
        ].join('\n'));
        done();
      })
      .catch(done);
  });
});
