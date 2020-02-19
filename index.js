'use strict';

const asyncHooks = require('async_hooks');

// Module global variables.
const resourceTree = {};
const contexts = {};
const contextAges = {};
const childResources = {};
const parentResources = {};
const destroyedResources = {};

let createdContextNumberSinceLastCleanCheck = 0;

const CLEAN_CHECK_CONTEXT_SIZE = process.env.CONTEXTOR_CLEAN_CHECK_CONTEXT_SIZE || 100;
const CONTEXT_TTL = process.env.CONTEXTOR_CONTEXT_TTL || 6e4;

/**
 * Retrieve context id for an async resource.
 * @param {number} asyncId - The resource id.
 * @returns {number|undefined} The context id or undefined if not in a context.
 */
function retrieveContextId(asyncId) {
  let contextId = asyncId;

  while (contextId !== undefined && !(contextId in contexts)) {
    contextId = resourceTree[contextId];
  }

  return contextId;
}

/**
 * Retrieve current context id.
 * @returns {number|undefined} The current context id or undefined if not in a context.
 */
function retrieveCurrentContextId() {
  return retrieveContextId(asyncHooks.executionAsyncId());
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

  // Clean memory references.
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
    const hasContext = !!retrieveContextId(parentAsyncId);

    if ((!hasChildren && destroyed) || !hasContext) {
      delete resourceTree[parentAsyncId];
      delete contexts[parentAsyncId];
      delete contextAges[parentAsyncId];
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
 * Clean deprecated and useless resources.
 */
function cleanResources() {
  const now = Date.now();

  // Clean expired contexts (in case a destroy has not been fired).
  if (CONTEXT_TTL) {
    Object.getOwnPropertyNames(contexts).forEach((asyncId) => {
      if (now - contextAges[asyncId] >= CONTEXT_TTL) {
        delete contexts[asyncId];
        delete contextAges[asyncId];
      }
    });
  }

  // Clean resources not attached to a context.
  Object.getOwnPropertyNames(resourceTree).forEach((asyncId) => {
    if (!retrieveContextId(asyncId)) {
      destroy(asyncId);
    }
  });
}

/**
 * Create a new context.
 * @returns {self}
 */
exports.create = function create() {
  const asyncId = asyncHooks.executionAsyncId();
  contexts[asyncId] = {};
  contextAges[asyncId] = Date.now();

  if (++createdContextNumberSinceLastCleanCheck >= CLEAN_CHECK_CONTEXT_SIZE) {
    cleanResources();
    createdContextNumberSinceLastCleanCheck = 0;
  }

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

/**
 * Get an object describing memory usage of the contextor and process
 * in order to help debugging potential memory leaks.
 * @returns {object} Memory usage description.
 */
exports.getMemoryUsage = function getMemoryUsage() {
  const resourceTreeSize = Object.getOwnPropertyNames(resourceTree).length;
  const contextsSize = Object.getOwnPropertyNames(contexts).length;
  const childResourcesSize = Object.getOwnPropertyNames(childResources).length;
  const parentResourcesSize = Object.getOwnPropertyNames(parentResources).length;
  const destroyedResourcesSize = Object.getOwnPropertyNames(destroyedResources).length;

  const memoryUsage = process.memoryUsage();
  const processMemory = Object.getOwnPropertyNames(memoryUsage).reduce((map, item) => {
    const mbSize = (Math.round((memoryUsage[item] / 1024 / 1024) * 100) / 100).toFixed(2);
    // eslint-disable-next-line no-param-reassign
    map[item] = `${mbSize} MB`;
    return map;
  }, {});

  return {
    processMemory,
    sizes: {
      resourceTree: resourceTreeSize,
      contexts: contextsSize,
      childResources: childResourcesSize,
      parentResources: parentResourcesSize,
      destroyedResources: destroyedResourcesSize
    },
    contents: {
      resourceTree,
      contexts,
      childResources,
      parentResources,
      destroyedResources
    }
  };
};
