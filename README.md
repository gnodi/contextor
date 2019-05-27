# contextor

**contextor** is a powerful but simple tool helping you to pass a context along an asynchronous process.

> Note that, **contextor** is build on async hooks available since version 8 of Node.js and still in experimental state as of version 12.

[![Build][build-image]][build-url]
[![Coverage Status][coverage-image]][coverage-url]
[![Version][version-image]][version-url]
[![Downloads][downloads-image]][downloads-url]
[![Dependencies][dependencies-image]][dependencies-url]
[![Dev Dependencies][dev-dependencies-image]][dev-dependencies-url]

Here is a simple example with an express request context:
```js
const express = require('express');
const contextualizer = require('./index');

const app = express();
let id = 0;

function getCurrentRequestId() {
  // Retrieve current request id.
  return contextualizer.get('request').id;
}

function logSomething(message) {
  console.log({
    requestId: getCurrentRequestId(),
    message
  });
}

app.use((req, res, next) => {
  req.id = id++;
  // Create a new context and add current request and response objects to it.
  contextualizer.create()
    .set('request', req)
    .set('response', res);
  next();
});

app.use((req, res, next) => {
  logSomething('something');
  next();
});

app.get('/', (req, res) => {
  res.send({
    requestId: req.id,
    contextRequestId: getCurrentRequestId()
  });
  // `requestId` and `contextRequestId` should be the same!
});

app.listen(3000);
```

## Summary
- [Installation](#installation)
- [Use](#use)
  - [Create a context](#create-a-context)
  - [Set a value in the current context](#set-a-value-in-the-current-context)
  - [Get a value in the current context](#get-a-value-in-the-current-context)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Installation
Run the following command to add the package to your dependencies:
```sh
$ npm install --save contextor
```

## Use
```js
// CommonJS
const contextor = require('contextor');

// ES6 modules
import contextor from 'contextor';
```

### Create a context
You can create a context just calling following method:
```js
contextor.create();
```
This will create a context associated with the current asynchronous resource processing and all its descendants, overriding the one of its ancestors.

### Set a value in the current context
You can set a value in the current context:
```js
contextor.set('foo', 'bar');
```

### Get a value in the current context
You can get a value of the current context.
```js
contextor.get('foo');
```
This will throw a `ReferenceError` if the key does not exist.

Instead, you can specify a default value in case the key does not exist:
```js
contextor.get('foo', 'bar');
```

## Testing
Many `npm` scripts are available to help testing:
```sh
$ npm run {script}
```
- `check`: lint and check unit and integration tests
- `lint`: lint
- `lint-fix`: try to fix lint automatically
- `test`: check unit tests
- `test-coverage`: check coverage of unit tests
- `test-debug`: debug unit tests
- `test-watch`: work in TDD!

Use `npm run check` to check that everything is ok.

## Contributing
If you want to contribute, just fork this repository and make a pull request!

Your development must respect these rules:
- fast
- easy
- light

You must keep test coverage at 100%.

## License
[MIT](LICENSE)

[build-image]: https://img.shields.io/travis/gnodi/contextor.svg?style=flat
[build-url]: https://travis-ci.org/gnodi/contextor
[coverage-image]:https://coveralls.io/repos/github/gnodi/contextor/badge.svg?branch=master
[coverage-url]:https://coveralls.io/github/gnodi/contextor?branch=master
[version-image]: https://img.shields.io/npm/v/contextor.svg?style=flat
[version-url]: https://npmjs.org/package/contextor
[downloads-image]: https://img.shields.io/npm/dm/contextor.svg?style=flat
[downloads-url]: https://npmjs.org/package/contextor
[dependencies-image]: https://david-dm.org/gnodi/contextor.svg
[dependencies-url]: https://david-dm.org/gnodi/contextor
[dev-dependencies-image]: https://david-dm.org/gnodi/contextor/dev-status.svg
[dev-dependencies-url]: https://david-dm.org/gnodi/contextor#info=devDependencies
