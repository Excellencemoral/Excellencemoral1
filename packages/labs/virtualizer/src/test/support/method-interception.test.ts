/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {interceptMethod} from '../../support/method-interception.js';
import {expect} from '@open-wc/testing';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Function = (...args: any[]) => any;
/* eslint-enable @typescript-eslint/no-explicit-any */

class Greeter {
  greet(addressee: string) {
    return `Hello, ${addressee}`;
  }
}

describe('Greeter', () => {
  it('greets an addressee', () => {
    const greeter = new Greeter();
    expect(greeter.greet('Alice')).to.equal('Hello, Alice');
  });
});

describe('interceptMethod', () => {
  it('wraps an existing method with new logic', () => {
    const greeter = new Greeter();
    interceptMethod(greeter, 'greet', (originalGreet, addressee: string) => {
      return `${originalGreet?.(addressee)}!!!`;
    });
    expect(greeter.greet('Bob')).to.equal('Hello, Bob!!!');
  });

  it('provides a function to restore the original method', () => {
    const greeter = new Greeter();
    const teardown = interceptMethod(
      greeter,
      'greet',
      (originalGreet, addressee: string) => {
        return `OMG ${originalGreet?.(addressee)} so MUCH!!!`;
      }
    );
    expect(greeter.greet('Carol')).to.equal('OMG Hello, Carol so MUCH!!!');
    teardown();
    expect(greeter.greet('Carol')).to.equal('Hello, Carol');
  });

  it('can be used to assign a method where one is not present', () => {
    const greeter: Greeter & {bye?: Function} = new Greeter();
    expect(greeter.bye).to.be.undefined;
    const teardown = interceptMethod(
      greeter,
      'bye',
      (originalBye, addressee: string) => {
        return `${originalBye?.(addressee)} 👋`;
      }
    );
    // Note that the original method is undefined, so the interceptor does not have
    // an original method to call and will include the string 'undefined' in its return.
    expect(greeter.bye!('Dave')).to.equal('undefined 👋');
    teardown();
    expect(greeter.bye).to.be.undefined;
  });
});
