'use strict';

const asyncHooks = require('async_hooks');

// Module global variables.
const resourceTree = {};
const contexts = {};
const childResources = {};
const parentResources = {};
const destroyedResources = {};

/**
 * Async hook init callback.
 * - build resource tree allowing to resolve current context
 * - build structures helping to clean memory in a fast way
 * @see https://nodejs.org/api/asyncHooks.html#asyncHooks_init_asyncid_type_triggerasyncid_resource
 */
function init(asyncId, type, triggerAsyncId) {
  resourceTree[asyncId] = triggerAsyncId;

  if (!(triggerAsyncId in childResources)) {
    childResources[triggerAsyncId] = [];
  }
  childResources[triggerAsyncId].push(asyncId);

  let parentAsyncId = resourceTree[asyncId];
  parentResources[asyncId] = [];
  while (parentAsyncId) {
    parentResources[asyncId].push(parentAsyncId);
    parentAsyncId = resourceTree[parentAsyncId];
  }
}

/**
 * Async hook destroy callback.
 * - clean memory.
 * @see https://nodejs.org/api/asyncHooks.html#asyncHooks_destroy_asyncid
 */
function destroy(asyncId) {
  destroyedResources[asyncId] = true;

  // Clean memory.
  const resources = [asyncId].concat(parentResources[asyncId]);

  resources.reduce((cleanedChildAsyncId, parentAsyncId) => {
    if (cleanedChildAsyncId === undefined) {
      return undefined;
    }

    const hadChildren = parentAsyncId in childResources;
    const hadCleanedChild = cleanedChildAsyncId !== true;

    if (hadChildren && hadCleanedChild) {
      childResources[parentAsyncId].splice(
        childResources[parentAsyncId].indexOf(cleanedChildAsyncId),
        1
      );
    }

    const hasChildren = hadChildren && childResources[parentAsyncId].length !== 0;
    const destroyed = parentAsyncId in destroyedResources;

    if (!hasChildren && destroyed) {
      delete resourceTree[parentAsyncId];
      delete contexts[parentAsyncId];
      delete childResources[parentAsyncId];
      delete parentResources[parentAsyncId];
      delete destroyedResources[parentAsyncId];
      return parentAsyncId;
    }

    return undefined;
  }, true);
}

// Create AsyncHook instance.
const asyncHook = asyncHooks.createHook({init, destroy});
asyncHook.enable();

/**
 * Retrieve current context id.
 * @returns {number|undefined} The current context id.
 */
function retrieveCurrentContextId() {
  let asyncId = asyncHooks.executionAsyncId();

  while (asyncId !== undefined && !(asyncId in contexts)) {
    asyncId = resourceTree[asyncId];
  }

  return asyncId;
}

/**
 * Retrieve current context.
 * @returns {Object} The current context.
 * @throws {ReferenceError} On missing current context.
 */
function retrieveCurrentContext() {
  const asyncId = retrieveCurrentContextId();
  const exists = asyncId in contexts;

  if (!exists) {
    throw new ReferenceError(
      'No current context found; use \'create\' method to create one'
    );
  }

  return contexts[asyncId];
}

/**
 * Create a new context.
 * @returns {self}
 */
exports.create = function create() {
  const asyncId = asyncHooks.executionAsyncId();
  contexts[asyncId] = {};
  return this;
};

/**
 * Set a value in the current context.
 * @param {string} key - The identifier key.
 * @param {*} value - The value.
 * @throws {ReferenceError} On missing current context.
 */
exports.set = function set(key, value) {
  const context = retrieveCurrentContext();
  context[key] = value;
  return this;
};

/**
 * Get a value in the current context.
 * @param {string} key - The identifier key.
 * @param {*} defaultValue - The default value to return in case.
 * @param {boolean} allowUndefinedContext - Whether or not to allow undefined context,
 *                                          default false.
 * @returns {*} The value or default value for missing key.
 * @throws {ReferenceError} On missing value for given key in current context.
 */
exports.get = function get(key, defaultValue, allowUndefinedContext = false) {
  let context;
  let previousError;

  try {
    context = retrieveCurrentContext();
  } catch (error) {
    if (!allowUndefinedContext || !/^No current context found/.test(error.message)) {
      throw error;
    }
    previousError = error;
    context = {};
  }

  const exists = key in context;

  if (!exists && defaultValue === undefined) {
    if (previousError) {
      throw previousError;
    }
    throw new ReferenceError(`No value found in context for '${key}' key`);
  }

  return exists ? context[key] : defaultValue;
};
