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
});
