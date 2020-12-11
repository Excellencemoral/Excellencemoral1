/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {
  _$private,
  AttributePart,
  DirectiveClass,
  DirectiveParameters,
  DirectiveResult,
  Disconnectable,
  ChildPart,
  PartInfo,
  Part,
} from './lit-html';
export {DirectiveClass, DirectiveParameters, DirectiveResult} from './lit-html';

const resolveDirective = _$private._resolveDirective;

export const PartType = {
  ATTRIBUTE: 1,
  CHILD: 2,
  PROPERTY: 3,
  BOOLEAN_ATTRIBUTE: 4,
  EVENT: 5,
} as const;

export type PartType = typeof PartType[keyof typeof PartType];

/**
 * Creates a user-facing directive function from a Directive class. This
 * function has the same parameters as the directive's render() method.
 */
export const directive = <C extends DirectiveClass>(c: C) => (
  ...values: DirectiveParameters<InstanceType<C>>
): DirectiveResult<C> => ({
  _$litDirective$: c,
  values,
});

/**
 * Base class for creating custom directives. Users should extend this class,
 * implement `render` and/or `update`, and then pass their subclass to
 * `directive`.
 */
export abstract class Directive {
  //@internal
  _part: ChildPart | AttributePart;
  //@internal
  _attributeIndex: number | undefined;
  //@internal
  _directive?: Directive;

  //@internal
  _$parent: Disconnectable;

  // These will only exist on the DisconnectableDirective subclass
  //@internal
  _$disconnetableChildren?: Set<Disconnectable>;
  //@internal
  _$setDirectiveConnected?(isConnected: boolean): void;

  constructor(partInfo: PartInfo) {
    this._$parent = partInfo._$parent;
    this._part = partInfo._$part;
    this._attributeIndex = partInfo._$attributeIndex;
  }
  /** @internal */
  _resolve(props: Array<unknown>): unknown {
    const {_part, _attributeIndex} = this;
    return resolveDirective(
      _part,
      this.update(_part, props),
      this,
      _attributeIndex
    );
  }
  abstract render(...props: Array<unknown>): unknown;
  update(_part: Part, props: Array<unknown>): unknown {
    return this.render(...props);
  }
}
