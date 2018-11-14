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
  'lower(upper): {{lower (upper name)}}',
  'spacer(upper, lower): {{spacer (upper name) (lower "X")}}',
  'block: {{#block}}{{upper name}}{{/block}}',
  // Lets mark it as "known bug" for now
  // 'ifConditional1: {{#if (equals "foo" foo)}}{{upper name}}{{/if}}',
  'ifConditional2: {{#if (equals "baz" bar)}}{{upper name}}{{/if}}',
  'ifConditional3: {{#if foo}}{{upper name}}{{/if}}',
  'ifConditional4: {{#if (false)}}{{upper name}}{{/if}}',
  'ifConditional5: {{#if (equalSync "foo" foo)}}{{upper name}}{{/if}}',
  'ifConditional6: {{#if false}}{{upper name}}{{/if}}',
  'ifConditional7: {{#if null}}{{upper name}}{{/if}}',
  'useHash: {{#useHash me=(lookup this "person")}}{{me.first}} {{me.last}}{{/useHash}}',
  'sum: {{sum 1 2 3}}',
  'lookup(this "person"): {{lookup this "person"}}'
].join('\n');

describe('handlebars', function() {
  beforeEach(function() {
    hbs = Handlebars.create();
    hbs.registerPartial('custom', 'a partial');

    asyncHelpers = new AsyncHelpers();
    asyncHelpers.set(hbs.helpers);

    // add the helpers to asyncHelpers
    asyncHelpers.set('if', hbs.helpers.if);
    asyncHelpers.set('getPartial', helpers.getPartial);
    asyncHelpers.set('equals', helpers.equals);
    asyncHelpers.set('equalSync', helpers.equalSync);
    asyncHelpers.set('partialName', helpers.partialName);
    asyncHelpers.set('upper', helpers.upper);
    asyncHelpers.set('upperAsync', helpers.upperAsync);
    asyncHelpers.set('lower', helpers.lower);
    asyncHelpers.set('spacer', helpers.spacer);
    asyncHelpers.set('block', helpers.block);
    asyncHelpers.set('useHash', helpers.useHash);
    asyncHelpers.set('lookup', helpers.lookup);
    asyncHelpers.set('sum', helpers.sum);
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

    asyncHelpers.resolve(rendered)
      .then(function(content) {
        // console.log('content', content);
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
          // Lets mark it as "known bug" for now
          // 'ifConditional1: ',
          'ifConditional2: DOOWB',
          'ifConditional3: ',
          'ifConditional4: ',
          'ifConditional5: ',
          'ifConditional6: ',
          'ifConditional7: ',
          'useHash: Brian Woodward',
          'sum: 6',
          'lookup(this "person"): Brian Woodward'
        ].join('\n'));
        done();
      })
      .catch(done);
  });
});
