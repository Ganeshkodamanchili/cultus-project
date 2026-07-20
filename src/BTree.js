import BTreeNode from './BTreeNode.js';

// B-Tree with configurable minimum degree t.
// Node capacity: min t-1 keys (root excluded), max 2t-1 keys.
// t=2 gives a 2-3-4 tree, larger t gives wider/shallower trees,
// which is the whole point on disk: fewer, fatter nodes means fewer seeks.
export default class BTree {
  constructor(t = 3) {
    if (t < 2) throw new Error('minimum degree t must be >= 2');
    this.t = t;
    this.root = null;
  }

  // ---------- SEARCH ----------

  search(key, node = this.root) {
    if (!node) return null;

    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) i++;

    if (i < node.keys.length && node.keys[i] === key) {
      return { node, index: i };
    }
    if (node.leaf) return null;

    return this.search(key, node.children[i]);
  }

  has(key) {
    return this.search(key) !== null;
  }

  // ---------- INSERT ----------

  insert(key) {
    if (this.has(key)) return; // no duplicate keys

    if (!this.root) {
      this.root = new BTreeNode(this.t, true);
      this.root.keys.push(key);
      return;
    }

    // If root is full, it has to split first - this is the only place
    // the tree grows in height.
    if (this.root.keys.length === 2 * this.t - 1) {
      const newRoot = new BTreeNode(this.t, false);
      newRoot.children.push(this.root);
      this._splitChild(newRoot, 0);
      this.root = newRoot;
    }

    this._insertNonFull(this.root, key);
  }

  // Splits the full child at parent.children[index] into two nodes,
  // pushing the median key up into the parent.
  _splitChild(parent, index) {
    const t = this.t;
    const fullChild = parent.children[index];
    const newChild = new BTreeNode(t, fullChild.leaf);

    const medianKey = fullChild.keys[t - 1];

    // Right half of the keys moves to the new sibling.
    newChild.keys = fullChild.keys.slice(t);
    fullChild.keys = fullChild.keys.slice(0, t - 1);

    if (!fullChild.leaf) {
      newChild.children = fullChild.children.slice(t);
      fullChild.children = fullChild.children.slice(0, t);
    }

    parent.keys.splice(index, 0, medianKey);
    parent.children.splice(index + 1, 0, newChild);
  }

  // Inserts into a subtree rooted at `node`, assuming node is not full.
  _insertNonFull(node, key) {
    let i = node.keys.length - 1;

    if (node.leaf) {
      node.keys.push(null);
      while (i >= 0 && key < node.keys[i]) {
        node.keys[i + 1] = node.keys[i];
        i--;
      }
      node.keys[i + 1] = key;
      return;
    }

    while (i >= 0 && key < node.keys[i]) i--;
    i++;

    if (node.children[i].keys.length === 2 * this.t - 1) {
      this._splitChild(node, i);
      if (key > node.keys[i]) i++;
    }
    this._insertNonFull(node.children[i], key);
  }

  // ---------- DELETE ----------

  delete(key) {
    if (!this.root) return;

    this._deleteFromNode(this.root, key);

    // If the root lost its only key, the tree shrinks by one level.
    if (this.root.keys.length === 0) {
      this.root = this.root.leaf ? null : this.root.children[0];
    }
  }

  _findKeyIndex(node, key) {
    let idx = 0;
    while (idx < node.keys.length && node.keys[idx] < key) idx++;
    return idx;
  }

  _deleteFromNode(node, key) {
    const t = this.t;
    const idx = this._findKeyIndex(node, key);

    if (idx < node.keys.length && node.keys[idx] === key) {
      if (node.leaf) {
        node.keys.splice(idx, 1);
      } else {
        this._deleteFromInternal(node, idx);
      }
      return;
    }

    if (node.leaf) {
      // Key isn't in the tree - nothing to delete.
      return;
    }

    const isLastChild = idx === node.keys.length;

    if (node.children[idx].keys.length < t) {
      this._fill(node, idx);
    }

    // _fill may have merged children, which shifts indices, so
    // re-check whether we should now recurse into idx-1.
    if (isLastChild && idx > node.keys.length) {
      this._deleteFromNode(node.children[idx - 1], key);
    } else {
      this._deleteFromNode(node.children[idx], key);
    }
  }

  // Deleting a key that lives in an internal node: replace it with its
  // predecessor or successor (whichever side has room to spare), then
  // recursively delete that replacement from the leaf it came from.
  _deleteFromInternal(node, idx) {
    const t = this.t;
    const key = node.keys[idx];

    if (node.children[idx].keys.length >= t) {
      const pred = this._getPredecessor(node, idx);
      node.keys[idx] = pred;
      this._deleteFromNode(node.children[idx], pred);
    } else if (node.children[idx + 1].keys.length >= t) {
      const succ = this._getSuccessor(node, idx);
      node.keys[idx] = succ;
      this._deleteFromNode(node.children[idx + 1], succ);
    } else {
      this._merge(node, idx);
      this._deleteFromNode(node.children[idx], key);
    }
  }

  _getPredecessor(node, idx) {
    let cur = node.children[idx];
    while (!cur.leaf) cur = cur.children[cur.children.length - 1];
    return cur.keys[cur.keys.length - 1];
  }

  _getSuccessor(node, idx) {
    let cur = node.children[idx + 1];
    while (!cur.leaf) cur = cur.children[0];
    return cur.keys[0];
  }

  // Makes sure node.children[idx] has at least t keys before we recurse
  // into it, by borrowing from a sibling or merging with one.
  _fill(node, idx) {
    const t = this.t;

    if (idx !== 0 && node.children[idx - 1].keys.length >= t) {
      this._borrowFromPrev(node, idx);
    } else if (idx !== node.keys.length && node.children[idx + 1].keys.length >= t) {
      this._borrowFromNext(node, idx);
    } else if (idx !== node.keys.length) {
      this._merge(node, idx);
    } else {
      this._merge(node, idx - 1);
    }
  }

  _borrowFromPrev(node, idx) {
    const child = node.children[idx];
    const sibling = node.children[idx - 1];

    child.keys.unshift(node.keys[idx - 1]);
    if (!child.leaf) {
      child.children.unshift(sibling.children.pop());
    }
    node.keys[idx - 1] = sibling.keys.pop();
  }

  _borrowFromNext(node, idx) {
    const child = node.children[idx];
    const sibling = node.children[idx + 1];

    child.keys.push(node.keys[idx]);
    if (!child.leaf) {
      child.children.push(sibling.children.shift());
    }
    node.keys[idx] = sibling.keys.shift();
  }

  // Merges node.children[idx], node.keys[idx], and node.children[idx+1]
  // into a single node, then removes the now-empty slot from the parent.
  _merge(node, idx) {
    const child = node.children[idx];
    const sibling = node.children[idx + 1];

    child.keys.push(node.keys[idx]);
    child.keys = child.keys.concat(sibling.keys);
    if (!child.leaf) {
      child.children = child.children.concat(sibling.children);
    }

    node.keys.splice(idx, 1);
    node.children.splice(idx + 1, 1);
  }

  // ---------- TRAVERSAL / INTROSPECTION ----------

  inOrder(node = this.root, out = []) {
    if (!node) return out;
    for (let i = 0; i < node.keys.length; i++) {
      if (!node.leaf) this.inOrder(node.children[i], out);
      out.push(node.keys[i]);
    }
    if (!node.leaf) this.inOrder(node.children[node.keys.length], out);
    return out;
  }

  height(node = this.root) {
    if (!node) return 0;
    if (node.leaf) return 1;
    return 1 + this.height(node.children[0]);
  }

  size(node = this.root) {
    if (!node) return 0;
    let count = node.keys.length;
    if (!node.leaf) {
      for (const child of node.children) count += this.size(child);
    }
    return count;
  }

  // Walks the whole tree and throws on the first broken invariant.
  // Checks: key ordering, min/max key counts, children = keys+1,
  // child subtree ranges stay between their bounding keys, and all
  // leaves sit at the same depth.
  validate() {
    if (!this.root) return true;
    const t = this.t;
    const leafDepths = [];

    const walk = (node, depth, isRoot, lowerBound, upperBound) => {
      const minKeys = isRoot ? 1 : t - 1;
      if (node.keys.length < minKeys) {
        throw new Error(`node has ${node.keys.length} keys, minimum is ${minKeys}`);
      }
      if (node.keys.length > 2 * t - 1) {
        throw new Error(`node has ${node.keys.length} keys, maximum is ${2 * t - 1}`);
      }
      for (let i = 0; i < node.keys.length; i++) {
        if (i > 0 && node.keys[i] <= node.keys[i - 1]) {
          throw new Error('keys within a node are not strictly increasing');
        }
        if (lowerBound !== null && node.keys[i] <= lowerBound) {
          throw new Error('key violates lower bound from ancestor');
        }
        if (upperBound !== null && node.keys[i] >= upperBound) {
          throw new Error('key violates upper bound from ancestor');
        }
      }

      if (node.leaf) {
        leafDepths.push(depth);
        return;
      }

      if (node.children.length !== node.keys.length + 1) {
        throw new Error(
          `internal node has ${node.keys.length} keys but ${node.children.length} children`
        );
      }
      for (let i = 0; i < node.children.length; i++) {
        const lb = i === 0 ? lowerBound : node.keys[i - 1];
        const ub = i === node.keys.length ? upperBound : node.keys[i];
        walk(node.children[i], depth + 1, false, lb, ub);
      }
    };

    walk(this.root, 0, true, null, null);

    if (new Set(leafDepths).size > 1) {
      throw new Error(`leaves are not all at the same depth: ${[...new Set(leafDepths)]}`);
    }
    return true;
  }
}
