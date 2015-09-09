import Promise from "bluebird";


export const CONTINUE = Symbol.for("interlock.continue");


function getContext (baseCxt, dependencies) {
  const context = Object.create(null);
  Object.assign(context, baseCxt);
  for (const depKey of Object.keys(dependencies)) {
    const dep = dependencies[depKey];
    context[depKey] = dep.__isPluggable__ ? dep.bind(baseCxt) : dep;
  }
  return context;
}

function getPluggableSequences (invokedCxt, fnName) {
  const extensions = invokedCxt.__pluggables__ || { override: {}, transform: {} };
  const overrideSeq = extensions.override[fnName] || [];
  const transformSeq = extensions.transform[fnName] || [];
  return [overrideSeq, transformSeq];
}


export function stream (fn, dependencies = {}) {
  function pluggableFn () {
    const invokedCxt = this || {};  // eslint-disable-line consistent-this

    const context = getContext(this, dependencies);
    const args = Array.prototype.slice.call(arguments);
    const [overrideSeq, transformSeq] = getPluggableSequences(invokedCxt, fn.name);

    let chainedResult = CONTINUE;

    // Apply overrides, followed by default function.
    for (const fnCandidate of overrideSeq.concat(fn)) {
      chainedResult = chainedResult === CONTINUE ?
        fnCandidate.apply(context, args) :
        chainedResult;
    }
    chainedResult = chainedResult === CONTINUE ? null : chainedResult;

    // Apply transforms.
    for (const transform of transformSeq) {
      chainedResult = transform.call(context, chainedResult, args);
    }

    return chainedResult;
  }

  pluggableFn.__isPluggable__ = true;
  return pluggableFn;
}

export function promise (fn, dependencies = {}) {
  function pluggableFn () {
    const invokedCxt = this || {};  // eslint-disable-line consistent-this

    const context = getContext(this, dependencies);
    const args = Array.prototype.slice.call(arguments);
    const [overrideSeq, transformSeq] = getPluggableSequences(invokedCxt, fn.name);

    let chainedResult = Promise.resolve(CONTINUE);

    // Apply overrides, followed by default function.
    for (const fnCandidate of overrideSeq.concat(fn)) {
      chainedResult = chainedResult.then(previousResult => { // eslint-disable-line no-loop-func
        return previousResult === CONTINUE ?
          Promise.resolve(fnCandidate.apply(context, args)) :
          previousResult;
      }
      );
    }

    // Apply transforms.
    for (const transform of transformSeq) {
      chainedResult = chainedResult.then(previousResult => // eslint-disable-line no-loop-func
        Promise.resolve(transform.call(context, previousResult, args)));
    }

    return chainedResult;
  }

  pluggableFn.__isPluggable__ = true;
  return pluggableFn;
}
