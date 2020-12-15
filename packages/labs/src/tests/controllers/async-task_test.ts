/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {ReactiveElement} from 'reactive-element';
import {property} from 'reactive-element/decorators/property.js';
import {AsyncTask} from '../../controllers/async-task.js';
import {generateElementName} from '../test-helpers';
import {assert} from '@esm-bundle/chai';

suite('AsyncTask', () => {
  let container: HTMLElement;

  class ControllerUsingTask {
    updateCount = 0;

    host: ReactiveElement;
    task: AsyncTask;

    constructor(host: ReactiveElement) {
      this.host = host;
      this.host.addController(this);
      this.task = new AsyncTask(
        this.host,
        (id: number) =>
          new Promise((resolve) => {
            this.resolveTask = () => resolve(`result: ${id}`);
          }),
        () => [this.id],
        'initial'
      );
    }

    updated() {
      this.updateCount++;
    }

    private _id = 0;

    get id() {
      return this._id;
    }

    set id(value: number) {
      this._id = value;
      this.host.requestUpdate();
    }

    resolveTask!: () => void;

    get value() {
      return this.task.value;
    }

    get isPending() {
      return this.task.isPending;
    }
  }

  class A extends ReactiveElement {
    static properties = {foo: {}};
    foo = 'foo';
    bar = 'bar';
    @property()
    resourceId = 0;
    @property()
    resourceStatus = false;
    willUpdateCount = 0;
    updateCount = 0;
    updatedCount = 0;
    connectedCount = 0;
    disconnectedCount = 0;
    taskController = new ControllerUsingTask(this);
    resolveTask!: () => void;
    task = new AsyncTask(
      this,
      (foo: string, bar: string) =>
        new Promise((resolve) => {
          this.resolveTask = () => resolve(`result: ${foo}, ${bar}`);
        }),
      () => [this.foo, this.bar],
      'initial'
    );
  }
  customElements.define(generateElementName(), A);
  let el!: A;

  setup(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    el = new A();
    container.appendChild(el);
    await el.updateComplete;
  });

  teardown(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  test('initial values', async () => {
    assert.equal(el.task.value, 'initial');
    assert.equal(el.taskController.value, 'initial');
  });

  test('finishes', async () => {
    assert.isTrue(el.task.isPending);
    assert.isTrue(el.taskController.isPending);
    el.resolveTask();
    el.taskController.resolveTask();
    await el.task.completeTask();
    await el.taskController.task.completeTask();
    assert.isFalse(el.task.isPending);
    assert.isFalse(el.taskController.isPending);
    assert.equal(el.task.value, 'result: foo, bar');
    assert.equal(el.taskController.value, 'result: 0');
  });

  test('runs when deps change', async () => {
    el.resolveTask();
    el.taskController.resolveTask();
    await el.task.completeTask();
    await el.taskController.task.completeTask();
    el.requestUpdate();
    await el.updateComplete;
    assert.isFalse(el.task.isPending);
    assert.isFalse(el.taskController.isPending);
    el.foo = 'foo1';
    el.bar = 'bar1';
    el.taskController.id = 1;
    await el.updateComplete;
    assert.isTrue(el.task.isPending);
    assert.isTrue(el.taskController.isPending);
    el.resolveTask();
    el.taskController.resolveTask();
    await el.task.completeTask();
    await el.taskController.task.completeTask();
    assert.isFalse(el.task.isPending);
    assert.isFalse(el.taskController.isPending);
    assert.equal(el.task.value, 'result: foo1, bar1');
    assert.equal(el.taskController.value, 'result: 1');
  });

  test('reports only most recent value', async () => {
    const initialFinishTask = el.resolveTask;
    const initialControllerFinishTask = el.taskController.resolveTask;
    await el.task.completeTask();
    await el.taskController.task.completeTask();
    el.foo = 'foo1';
    el.bar = 'bar1';
    el.taskController.id = 1;
    await el.updateComplete;
    el.resolveTask();
    el.taskController.resolveTask();
    initialFinishTask();
    initialControllerFinishTask();
    await el.task.completeTask();
    await el.taskController.task.completeTask();
    assert.isFalse(el.task.isPending);
    assert.isFalse(el.taskController.isPending);
    assert.equal(el.task.value, 'result: foo1, bar1');
    assert.equal(el.taskController.value, 'result: 1');
  });
});
