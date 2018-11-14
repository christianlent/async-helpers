'use strict';

const AsyncHelpers = require('../index');

async function main() {
  const asyncHelpers = new AsyncHelpers();

  asyncHelpers.wrapHelper('lower', (val) => val && val.toLowerCase());

  console.log('all raw:', asyncHelpers.rawHelpers);
  console.log('lower sync:', asyncHelpers.helper('lower'));
  console.log('all wrapped:', asyncHelpers.wrappedHelpers);
  console.log('lower wrapped:');
  console.log(asyncHelpers.wrapHelper('lower'));

  console.log('lower non wrapped:');
  console.log(asyncHelpers.helper('lower'));

  const lower = asyncHelpers.wrapHelper('lower');

  console.log('lower wrapped id:', lower('FOO')); // => asyncId
  console.log('lower wrapped:', await asyncHelpers.resolveId(lower('FOO')));
  // => resolves to 'foo'

  asyncHelpers.wrapHelper('lowerAsync', async(str) => str && str.toLowerCase());
  const lowerAsync = asyncHelpers.wrapHelper('lowerAsync');

  console.log('lowerAsync wrapped id:', lowerAsync('QUX')); // => asyncId
  console.log('lowerAsync wrapped:', await asyncHelpers.resolveId(lowerAsync('QUX')));
  // => resolves to 'qux'

  asyncHelpers.wrapHelper('lowerCb', (str, cb) => cb(null, str && str.toLowerCase()));
  const lowerCb = asyncHelpers.wrapHelper('lowerCb');

  console.log('lowerCb wrapped id:', lowerCb('GGG')); // => asyncId
  console.log('lowerCb wrapped:', await asyncHelpers.resolveId(lowerCb('GGG')));
  // => resolves to 'ggg'

  // resolveIds (plural)
  const str = `foo ${lowerCb('KKK222')} bar ${lowerAsync('QYX')}`;
  console.log('resolveIds:', await asyncHelpers.resolveIds(str));
  // => foo kkk222 bar qyx

  asyncHelpers.wrapHelper('sumAsync', (a, b) => Promise.resolve(a + b));
  const sumAsync = asyncHelpers.wrapHelper('sumAsync');
  console.log('sumAsync res:', await asyncHelpers.resolveIds(sumAsync(2, 4)));
}

main();

// asyncHelpers.helper('upper', (str) => str && str.toUpperCase());
// asyncHelpers.helper('upperAsync', async(str) => str && str.toUpperCase());
// asyncHelpers.helper('upperAsyncCb', (str, cb) => cb(null, str && str.toUpperCase()));

// asyncHelpers.wrapHelper('lower', (str) => str && str.toLowerCase());
// asyncHelpers.wrapHelper('lowerAsync', async(str) => str && str.toLowerCase());

// const upperWrapped = asyncHelpers.helper('upper');
// const upperNotWrap = asyncHelpers.wrapHelper('upper');

// const lowerWrapped = asyncHelpers.wrapHelper('lower');
// const lowerNotWrap = asyncHelpers.helper('lower');

// console.log(lowerWrapped);
// console.log(lowerNotWrap);

// const allWrapped = asyncHelpers.wrapHelper();

// console.log(allWrapped);
// console.log(lowerNotWrap('ZZZ'));
// asyncHelpers.resolveId(lowerWrapped('FOO')).then(console.log);

// const lowerAsyncId = allWrapped.lowerAsync('FOO');
// console.log(lowerAsyncId);
// asyncHelpers.resolveId(lowerAsyncId).then(console.log);

// const upperAsync = asyncHelpers.wrapHelper('upperAsync');
// console.log(upperAsync('low'));

// asyncHelpers.resolveId(upperAsync('low')).then(console.log);
