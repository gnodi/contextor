'use strict';

/* eslint-disable import/no-extraneous-dependencies */
const {expect} = require('chai');
const contextor = require('./index');

function executeInSpecificAsyncContext(execute, done) {
  setTimeout(() => {
    setTimeout(execute, 0);
    if (done) {
      setTimeout(done, 10);
    }
  }, 0);
}

function buildMultiDone(done) {
  let id = 0;
  const executions = [];

  return () => {
    const executionId = id++;
    executions.push(executionId);
    return () => {
      executions.splice(executions.indexOf(executionId), 1);
      if (executions.length === 0) {
        done();
      }
    };
  };
}

describe('contextor', () => {
  it('should create a context allowing to set and get value', (done) => {
    executeInSpecificAsyncContext(() => {
      expect(contextor.create().set('foo', 'bar').get('foo')).to.equal('bar');
    }, done);
  });

  it('should failed to set and get value on missing context', (done) => {
    executeInSpecificAsyncContext(() => {
      expect(() => contextor.set('foo', 'bar')).to.throw(
        ReferenceError,
        'No current context found; use \'create\' method to create one'
      );
      expect(() => contextor.get('foo')).to.throw(
        ReferenceError,
        'No current context found; use \'create\' method to create one'
      );
    }, done);
  });

  it('should failed to get a not defined value on the current context', (done) => {
    executeInSpecificAsyncContext(() => {
      expect(() => contextor.create().get('foo')).to.throw(
        ReferenceError,
        'No value found in context for \'foo\' key'
      );
    }, done);
  });

  it('should succeed to get a not defined value on the current context if a default value is given', (done) => {
    executeInSpecificAsyncContext(() => {
      expect(contextor.create().get('foo', 'bar')).to.equal('bar');
    }, done);
  });

  it('should failed to get a value on a missing context if allowed but no default value is given', (done) => {
    executeInSpecificAsyncContext(() => {
      expect(() => contextor.get('foo', undefined, true)).to.throw(
        ReferenceError,
        'No current context found; use \'create\' method to create one'
      );
    }, done);
  });

  it('should succeed to get a value on a missing context if allowed and a default value is given', (done) => {
    executeInSpecificAsyncContext(() => {
      expect(contextor.get('foo', 'bar', true)).to.equal('bar');
    }, done);
  });

  it('should pass context along asynchronous resource chain', (done) => {
    const multiDone = buildMultiDone(done);

    executeInSpecificAsyncContext(() => {
      expect(contextor.create().set('plop', 'plip').get('plop')).to.equal('plip');
      (new Promise((resolve) => {
        executeInSpecificAsyncContext(() => {
          expect(contextor.get('plop')).to.equal('plip');
          expect(contextor.set('plop', 'plap').get('plop')).to.equal('plap');
          resolve();
        }, multiDone());
      })).then(() => {
        executeInSpecificAsyncContext(() => {
          expect(contextor.get('plop')).to.equal('plap');
        }, multiDone());
      });
    }, multiDone());
  });

  it('should handle embedded contexts', (done) => {
    const multiDone = buildMultiDone(done);

    executeInSpecificAsyncContext(() => {
      expect(contextor.create().set('plop', 'plip').get('plop')).to.equal('plip');
      executeInSpecificAsyncContext(() => {
        expect(contextor.create().set('plop', 'plap').get('plop')).to.equal('plap');
        executeInSpecificAsyncContext(() => {
          expect(contextor.get('plop')).to.equal('plap');
        }, multiDone());
      }, multiDone());
      executeInSpecificAsyncContext(() => {
        expect(contextor.get('plop')).to.equal('plip');
      }, multiDone());
    }, multiDone());
  });

  it('should be debuggable', () => {
    const memoryUsage = contextor.getMemoryUsage();

    expect(Object.getOwnPropertyNames(memoryUsage)).to.deep.equal(['processMemory', 'sizes', 'contents']);
    expect(Object.getOwnPropertyNames(memoryUsage.processMemory)).to.deep.equal(['rss', 'heapTotal', 'heapUsed', 'external']);
    expect(Object.getOwnPropertyNames(memoryUsage.sizes)).to.deep.equal([
      'resourceTree',
      'contexts',
      'childResources',
      'parentResources',
      'destroyedResources'
    ]);
    expect(Object.getOwnPropertyNames(memoryUsage.contents)).to.deep.equal([
      'resourceTree',
      'contexts',
      'childResources',
      'parentResources',
      'destroyedResources'
    ]);
  });

  it('should clean expired contexts', (done) => {
    let memoryUsage = contextor.getMemoryUsage();

    expect(memoryUsage.sizes.contexts).to.be.greaterThan(1);

    setTimeout(() => {
      contextor.create();
      contextor.create();
      memoryUsage = contextor.getMemoryUsage();

      expect(memoryUsage.sizes.contexts).equal(1);

      setTimeout(() => {
        contextor.create();
        contextor.create();
        memoryUsage = contextor.getMemoryUsage();

        expect(memoryUsage.sizes.contexts).equal(1);

        done();
      }, 400);
    }, 400);

    setTimeout(() => {
      contextor.create();
      contextor.create();
      memoryUsage = contextor.getMemoryUsage();

      expect(memoryUsage.sizes.contexts).equal(2);
    }, 500);
  });
});
