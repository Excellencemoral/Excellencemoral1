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

import {DirectiveFn} from '../lib/directive.js';
import {createMarker, directive, NodePart, Part, removeNodes, reparentNodes} from '../lit-html.js';

export type KeyFn<T> = (item: T, index: number) => any;
export type ItemTemplate<T> = (item: T, index: number) => any;

// Helper functions for manipulating parts
// TODO(kschaaf): Refactor into Part API?
const createAndInsertPart =
    (containerPart: NodePart, beforePart?: NodePart): NodePart => {
      const container = containerPart.startNode.parentNode as Node;
      const beforeNode = beforePart === undefined ? containerPart.endNode :
                                                    beforePart.startNode;
      const startNode = container.insertBefore(createMarker(), beforeNode);
      container.insertBefore(createMarker(), beforeNode);
      const newPart = new NodePart(containerPart.options);
      newPart.insertAfterNode(startNode);
      return newPart;
    };

const updatePart = (part: NodePart, value: unknown) => {
  part.setValue(value);
  part.commit();
  return part;
};

const insertPartBefore =
    (containerPart: NodePart, part: NodePart, ref?: NodePart) => {
      const container = containerPart.startNode.parentNode as Node;
      const beforeNode = ref ? ref.startNode : containerPart.endNode;
      const endNode = part.endNode.nextSibling;
      if (endNode !== beforeNode) {
        reparentNodes(container, part.startNode, endNode, beforeNode);
      }
    };


export class NodeRemovalToken {
  public defaultPrevented: boolean = false;
  constructor(public target: Node, public container: Node) {
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  commit() {
    commitRemoveNode(this.container, this.target);
  }
}

export type NodeRemovalHandler = (token: NodeRemovalToken) => void;

/**
 * Removes nodes, starting from `startNode` (inclusive) to `endNode`
 * (exclusive), from `container`, with onRemove callback.
 */
const removeNodesWithRemovalHandler =
    (container: Node,
     startNode: Node|null,
     endNode: Node|null = null,
     nodeRemovalHandler?: NodeRemovalHandler): void => {
      if (nodeRemovalHandler === undefined)
        return removeNodes(container, startNode, endNode);
      let node = startNode;
      while (node !== endNode) {
        if (!node)
          return throwIllegalNodeModification();
        const next = node.nextSibling;
        // Check if it's a marker node, which is a comment node with value ''.
        if (!(node.nodeType === node.COMMENT_NODE && node.nodeValue === '')) {
          let token = new NodeRemovalToken(node, container);
          nodeRemovalHandler(token);
          if (!token.defaultPrevented)
            token.commit();
        }
        node = next;
      }
    };

function throwIllegalNodeModification() {
  throw new Error('illegal node mutation');
}

function commitRemoveNode(node: Node, container: Node) {
  // container can be null in the off-chance that the user
  // performed an illegal mutation.
  if (!container)
    throwIllegalNodeModification();
  container.removeChild(node);
}

const removePart =
    (part: NodePart, nodeRemovalHandler?: NodeRemovalHandler) => {
      removeNodesWithRemovalHandler(
          part.startNode.parentNode!,
          part.startNode,
          part.endNode.nextSibling,
          nodeRemovalHandler);
    };

// Helper for generating a map of array item to its index over a subset
// of an array (used to lazily generate `newKeyToIndexMap` and
// `oldKeyToIndexMap`)
const generateMap = (list: unknown[], start: number, end: number) => {
  const map = new Map();
  for (let i = start; i <= end; i++) {
    map.set(list[i], i);
  }
  return map;
};

// Stores previous ordered list of parts and map of key to index
const partListCache = new WeakMap<NodePart, (NodePart | null)[]>();
const keyListCache = new WeakMap<NodePart, unknown[]>();

/**
 * A directive that repeats a series of values (usually `TemplateResults`)
 * generated from an iterable, and updates those items efficiently when the
 * iterable changes based on user-provided `keys` associated with each item.
 *
 * Note that if a `keyFn` is provided, strict key-to-DOM mapping is maintained,
 * meaning previous DOM for a given key is moved into the new position if
 * needed, and DOM will never be reused with values for different keys (new DOM
 * will always be created for new keys). This is generally the most efficient
 * way to use `repeat` since it performs minimum unnecessary work for insertions
 * amd removals.
 *
 * IMPORTANT: If providing a `keyFn`, keys *must* be unique for all items in a
 * given call to `repeat`. The behavior when two or more items have the same key
 * is undefined.
 *
 * If no `keyFn` is provided, this directive will perform similar to mapping
 * items to values, and DOM will be reused against potentially different items.
 */
export const repeat = directive(
    <T>(items: Iterable<T>,
        keyFnOrTemplate: KeyFn<T>|ItemTemplate<T>,
        template?: ItemTemplate<T>,
        onRemove?: NodeRemovalHandler): DirectiveFn => {
      let keyFn: KeyFn<T>;
      if (template === undefined) {
        template = keyFnOrTemplate;
      } else if (keyFnOrTemplate !== undefined) {
        keyFn = keyFnOrTemplate as KeyFn<T>;
      }

      return (containerPart: Part): void => {
        if (!(containerPart instanceof NodePart)) {
          throw new Error('repeat can only be used in text bindings');
        }
        // Old part & key lists are retrieved from the last update (associated
        // with the part for this instance of the directive)
        const oldParts = partListCache.get(containerPart) || [];
        const oldKeys = keyListCache.get(containerPart) || [];

        // New part list will be built up as we go (either reused from old parts
        // or created for new keys in this update). This is saved in the above
        // cache at the end of the update.
        const newParts: NodePart[] = [];

        // New value list is eagerly generated from items along with a parallel
        // array indicating its key.
        const newValues: unknown[] = [];
        const newKeys: unknown[] = [];
        let index = 0;
        for (const item of items) {
          newKeys[index] = keyFn ? keyFn(item, index) : index;
          newValues[index] = template !(item, index);
          index++;
        }

        // Maps from key to index for current and previous update; these are
        // generated lazily only when needed as a performance optimization,
        // since they are only required for multiple non-contiguous changes in
        // the list, which are less common.
        let newKeyToIndexMap!: Map<unknown, number>;
        let oldKeyToIndexMap!: Map<unknown, number>;

        // Head and tail pointers to old parts and new values
        let oldHead = 0;
        let oldTail = oldParts.length - 1;
        let newHead = 0;
        let newTail = newValues.length - 1;

        // Overview of O(n) reconciliation algorithm (general approach based on
        // ideas found in ivi, vue, snabbdom, etc.):
        //
        // * We start with the list of old parts and new values (and arrays of
        //   their respective keys), head/tail pointers into each, and we build
        //   up the new list of parts by updating (and when needed, moving) old
        //   parts or creating new ones. The initial scenario might look like
        //   this (for brevity of the diagrams, the numbers in the array reflect
        //   keys associated with the old parts or new values, although keys and
        //   parts/values are actually stored in parallel arrays indexed using
        //   the same head/tail pointers):
        //
        //      oldHead v                 v oldTail
        //   oldKeys:  [0, 1, 2, 3, 4, 5, 6]
        //   newParts: [ ,  ,  ,  ,  ,  ,  ]
        //   newKeys:  [0, 2, 1, 4, 3, 7, 6] <- reflects the user's new item
        //   order
        //      newHead ^                 ^ newTail
        //
        // * Iterate old & new lists from both sides, updating, swapping, or
        //   removing parts at the head/tail locations until neither head nor
        //   tail can move.
        //
        // * Example below: keys at head pointers match, so update old part 0
        // in-
        //   place (no need to move it) and record part 0 in the `newParts`
        //   list. The last thing we do is advance the `oldHead` and `newHead`
        //   pointers (will be reflected in the next diagram).
        //
        //      oldHead v                 v oldTail
        //   oldKeys:  [0, 1, 2, 3, 4, 5, 6]
        //   newParts: [0,  ,  ,  ,  ,  ,  ] <- heads matched: update 0 and
        //   newKeys:  [0, 2, 1, 4, 3, 7, 6]    advance both oldHead & newHead
        //      newHead ^                 ^ newTail
        //
        // * Example below: head pointers don't match, but tail pointers do, so
        //   update part 6 in place (no need to move it), and record part 6 in
        //   the `newParts` list. Last, advance the `oldTail` and `oldHead`
        //   pointers.
        //
        //         oldHead v              v oldTail
        //   oldKeys:  [0, 1, 2, 3, 4, 5, 6]
        //   newParts: [0,  ,  ,  ,  ,  , 6] <- tails matched: update 6 and
        //   newKeys:  [0, 2, 1, 4, 3, 7, 6]    advance both oldTail & newTail
        //         newHead ^              ^ newTail
        //
        // * If neither head nor tail match; next check if one of the old
        // head/tail
        //   items was removed. We first need to generate the reverse map of new
        //   keys to index (`newKeyToIndexMap`), which is done once lazily as a
        //   performance optimization, since we only hit this case if multiple
        //   non-contiguous changes were made. Note that for contiguous removal
        //   anywhere in the list, the head and tails would advance from either
        //   end and pass each other before we get to this case and removals
        //   would be handled in the final while loop without needing to
        //   generate the map.
        //
        // * Example below: The key at `oldTail` was removed (no longer in the
        //   `newKeyToIndexMap`), so remove that part from the DOM and advance
        //   just the `oldTail` pointer.
        //
        //         oldHead v           v oldTail
        //   oldKeys:  [0, 1, 2, 3, 4, 5, 6]
        //   newParts: [0,  ,  ,  ,  ,  , 6] <- 5 not in new map; remove 5 and
        //   newKeys:  [0, 2, 1, 4, 3, 7, 6]    advance oldTail
        //         newHead ^           ^ newTail
        //
        // * Once head and tail cannot move, any mismatches are due to either
        // new or
        //   moved items; if a new key is in the previous "old key to old index"
        //   map, move the old part to the new location, otherwise create and
        //   insert a new part. Note that when moving an old part we null its
        //   position in the oldParts array if it lies between the head and tail
        //   so we know to skip it when the pointers get there.
        //
        // * Example below: neither head nor tail match, and neither were
        // removed;
        //   so find the `newHead` key in the `oldKeyToIndexMap`, and move that
        //   old part's DOM into the next head position (before
        //   `oldParts[oldHead]`). Last, null the part in the `oldPart` array
        //   since it was somewhere in the remaining oldParts still to be
        //   scanned (between the head and tail pointers) so that we know to
        //   skip that old part on future iterations.
        //
        //         oldHead v        v oldTail
        //   oldKeys:  [0, 1, -, 3, 4, 5, 6]
        //   newParts: [0, 2,  ,  ,  ,  , 6] <- stuck; update & move 2 into
        //   place newKeys:  [0, 2, 1, 4, 3, 7, 6]    and advance newHead
        //         newHead ^           ^ newTail
        //
        // * Note that for moves/insertions like the one above, a part inserted
        // at
        //   the head pointer is inserted before the current
        //   `oldParts[oldHead]`, and a part inserted at the tail pointer is
        //   inserted before `newParts[newTail+1]`. The seeming asymmetry lies
        //   in the fact that new parts are moved into place outside in, so to
        //   the right of the head pointer are old parts, and to the right of
        //   the tail pointer are new parts.
        //
        // * We always restart back from the top of the algorithm, allowing
        // matching
        //   and simple updates in place to continue...
        //
        // * Example below: the head pointers once again match, so simply update
        //   part 1 and record it in the `newParts` array.  Last, advance both
        //   head pointers.
        //
        //         oldHead v        v oldTail
        //   oldKeys:  [0, 1, -, 3, 4, 5, 6]
        //   newParts: [0, 2, 1,  ,  ,  , 6] <- heads matched; update 1 and
        //   newKeys:  [0, 2, 1, 4, 3, 7, 6]    advance both oldHead & newHead
        //            newHead ^        ^ newTail
        //
        // * As mentioned above, items that were moved as a result of being
        // stuck
        //   (the final else clause in the code below) are marked with null, so
        //   we always advance old pointers over these so we're comparing the
        //   next actual old value on either end.
        //
        // * Example below: `oldHead` is null (already placed in newParts), so
        //   advance `oldHead`.
        //
        //            oldHead v     v oldTail
        //   oldKeys:  [0, 1, -, 3, 4, 5, 6] // old head already used; advance
        //   newParts: [0, 2, 1,  ,  ,  , 6] // oldHead
        //   newKeys:  [0, 2, 1, 4, 3, 7, 6]
        //               newHead ^     ^ newTail
        //
        // * Note it's not critical to mark old parts as null when they are
        // moved
        //   from head to tail or tail to head, since they will be outside the
        //   pointer range and never visited again.
        //
        // * Example below: Here the old tail key matches the new head key, so
        //   the part at the `oldTail` position and move its DOM to the new
        //   head position (before `oldParts[oldHead]`). Last, advance `oldTail`
        //   and `newHead` pointers.
        //
        //               oldHead v  v oldTail
        //   oldKeys:  [0, 1, -, 3, 4, 5, 6]
        //   newParts: [0, 2, 1, 4,  ,  , 6] <- old tail matches new head:
        //   update newKeys:  [0, 2, 1, 4, 3, 7, 6]   & move 4, advance oldTail
        //   & newHead
        //               newHead ^     ^ newTail
        //
        // * Example below: Old and new head keys match, so update the old head
        //   part in place, and advance the `oldHead` and `newHead` pointers.
        //
        //               oldHead v oldTail
        //   oldKeys:  [0, 1, -, 3, 4, 5, 6]
        //   newParts: [0, 2, 1, 4, 3,   ,6] <- heads match: update 3 and
        //   advance newKeys:  [0, 2, 1, 4, 3, 7, 6]    oldHead & newHead
        //                  newHead ^  ^ newTail
        //
        // * Once the new or old pointers move past each other then all we have
        //   left is additions (if old list exhausted) or removals (if new list
        //   exhausted). Those are handled in the final while loops at the end.
        //
        // * Example below: `oldHead` exceeded `oldTail`, so we're done with the
        //   main loop.  Create the remaining part and insert it at the new head
        //   position, and the update is complete.
        //
        //                   (oldHead > oldTail)
        //   oldKeys:  [0, 1, -, 3, 4, 5, 6]
        //   newParts: [0, 2, 1, 4, 3, 7 ,6] <- create and insert 7
        //   newKeys:  [0, 2, 1, 4, 3, 7, 6]
        //                     newHead ^ newTail
        //
        // * Note that the order of the if/else clauses is not important to the
        //   algorithm, as long as the null checks come first (to ensure we're
        //   always working on valid old parts) and that the final else clause
        //   comes last (since that's where the expensive moves occur). The
        //   order of remaining clauses is is just a simple guess at which cases
        //   will be most common.
        //
        // * TODO(kschaaf) Note, we could calculate the longest increasing
        //   subsequence (LIS) of old items in new position, and only move those
        //   not in the LIS set. However that costs O(nlogn) time and adds a bit
        //   more code, and only helps make rare types of mutations require
        //   fewer moves. The above handles removes, adds, reversal, swaps, and
        //   single moves of contiguous items in linear time, in the minimum
        //   number of moves. As the number of multiple moves where LIS might
        //   help approaches a random shuffle, the LIS optimization becomes less
        //   helpful, so it seems not worth the code at this point. Could
        //   reconsider if a compelling case arises.

        while (oldHead <= oldTail && newHead <= newTail) {
          if (oldParts[oldHead] === null) {
            // `null` means old part at head has already been used below; skip
            oldHead++;
          } else if (oldParts[oldTail] === null) {
            // `null` means old part at tail has already been used below; skip
            oldTail--;
          } else if (oldKeys[oldHead] === newKeys[newHead]) {
            // Old head matches new head; update in place
            newParts[newHead] =
                updatePart(oldParts[oldHead]!, newValues[newHead]);
            oldHead++;
            newHead++;
          } else if (oldKeys[oldTail] === newKeys[newTail]) {
            // Old tail matches new tail; update in place
            newParts[newTail] =
                updatePart(oldParts[oldTail]!, newValues[newTail]);
            oldTail--;
            newTail--;
          } else if (oldKeys[oldHead] === newKeys[newTail]) {
            // Old head matches new tail; update and move to new tail
            newParts[newTail] =
                updatePart(oldParts[oldHead]!, newValues[newTail]);
            insertPartBefore(
                containerPart, oldParts[oldHead]!, newParts[newTail + 1]);
            oldHead++;
            newTail--;
          } else if (oldKeys[oldTail] === newKeys[newHead]) {
            // Old tail matches new head; update and move to new head
            newParts[newHead] =
                updatePart(oldParts[oldTail]!, newValues[newHead]);
            insertPartBefore(
                containerPart, oldParts[oldTail]!, oldParts[oldHead]!);
            oldTail--;
            newHead++;
          } else {
            if (newKeyToIndexMap === undefined) {
              // Lazily generate key-to-index maps, used for removals & moves
              // below
              newKeyToIndexMap = generateMap(newKeys, newHead, newTail);
              oldKeyToIndexMap = generateMap(oldKeys, oldHead, oldTail);
            }
            if (!newKeyToIndexMap.has(oldKeys[oldHead])) {
              // Old head is no longer in new list; remove
              removePart(oldParts[oldHead]!, onRemove);
              oldHead++;
            } else if (!newKeyToIndexMap.has(oldKeys[oldTail])) {
              // Old tail is no longer in new list; remove
              removePart(oldParts[oldTail]!, onRemove);
              oldTail--;
            } else {
              // Any mismatches at this point are due to additions or moves; see
              // if we have an old part we can reuse and move into place
              const oldIndex = oldKeyToIndexMap.get(newKeys[newHead]);
              const oldPart =
                  oldIndex !== undefined ? oldParts[oldIndex] : null;
              if (oldPart === null) {
                // No old part for this value; create a new one and insert it
                const newPart =
                    createAndInsertPart(containerPart, oldParts[oldHead]!);
                updatePart(newPart, newValues[newHead]);
                newParts[newHead] = newPart;
              } else {
                // Reuse old part
                newParts[newHead] = updatePart(oldPart, newValues[newHead]);
                insertPartBefore(containerPart, oldPart, oldParts[oldHead]!);
                // This marks the old part as having been used, so that it will
                // be skipped in the first two checks above
                oldParts[oldIndex as number] = null;
              }
              newHead++;
            }
          }
        }
        // Add parts for any remaining new values
        while (newHead <= newTail) {
          // For all remaining additions, we insert before last new tail,
          // since old pointers are no longer valid
          const newPart =
              createAndInsertPart(containerPart, newParts[newTail + 1]!);
          updatePart(newPart, newValues[newHead]);
          newParts[newHead++] = newPart;
        }
        // Remove any remaining unused old parts
        while (oldHead <= oldTail) {
          const oldPart = oldParts[oldHead++];
          if (oldPart !== null) {
            removePart(oldPart, onRemove);
          }
        }
        // Save order of new parts for next round
        partListCache.set(containerPart, newParts);
        keyListCache.set(containerPart, newKeys);
      };
    });
