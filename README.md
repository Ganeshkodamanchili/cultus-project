# B-Tree Index

A disk-oriented B-Tree implementation (CLRS-style, minimum degree `t`) with
insert, delete, search, and a validator that checks every structural
invariant of the tree.

## Why a B-Tree instead of a binary search tree

A binary tree gives you one comparison per node, so for `n` keys you get
`O(log2 n)` depth. That's fine in memory, but if every node lookup is a disk
seek, a deep tree means a lot of seeks. A B-Tree packs many keys into a
single node (bounded by the branching factor `t`), so each node maps
naturally onto a disk block. That turns `log2 n` depth into `log_t n` depth,
and each level costs one disk read regardless of how many keys are on it.
The height experiment in `height_experiment.mjs` shows this directly: for
100,000 keys, `t=2` needs a height of 16, but `t=64` only needs 3.

## Node structure

Each `BTreeNode` (see `src/BTreeNode.js`) holds:
- `keys`: sorted array of keys, length between `t-1` and `2t-1` (root is
  allowed fewer keys, down to 1, as long as it's not empty).
- `children`: array of child node references. For an internal node with `k`
  keys, there are always `k+1` children — `children[i]` holds keys strictly
  between `keys[i-1]` and `keys[i]`.
- `leaf`: whether this node has children at all.

The branching factor `t` is fixed per tree and passed into the constructor.
`t=2` is the smallest legal value (equivalent to a 2-3-4 tree) and is useful
for testing because it forces splits and merges constantly, even with a
handful of keys.

## Insertion and node splitting

Insertion walks down from the root the same way a search would, but before
descending into any child, it checks whether that child is already full
(`2t-1` keys). If it is, the child gets split *before* we recurse into it —
this is the "split on the way down" trick that avoids ever needing to
back up the recursion to fix a full node.

Splitting a full node works like this (`_splitChild` in `src/BTree.js`):
1. The median key (index `t-1`) gets pulled out and pushed up into the
   parent.
2. Everything to the left of the median stays in the original node.
3. Everything to the right of the median moves into a brand new sibling
   node.
4. If the node being split wasn't a leaf, its children get divided the same
   way — first `t` children stay, the rest move to the new sibling.

The one special case is the root: if the root itself is full, a new empty
root is created above it, the old root is split as a child of the new one,
and the tree grows by exactly one level. This is the *only* place tree
height increases.

## Deletion, redistribution, and merging

Deletion is the harder direction because removing a key can leave a node
under the minimum (`t-1` keys), which breaks the B-Tree invariant. The
approach here follows the standard CLRS algorithm:

- **Deleting from a leaf**: just remove the key directly.
- **Deleting a key stored in an internal node**: you can't just remove it,
  since that would leave a hole between two children. Instead, the key is
  swapped with either its in-order predecessor (largest key in the left
  subtree) or successor (smallest key in the right subtree) — whichever
  side has at least `t` keys to spare — and then that predecessor/successor
  is deleted recursively from the leaf it actually lives in.
- **Before descending into any child during a delete**, the algorithm
  checks if that child has only `t-1` keys (the minimum). If so, it "fills"
  the child first, using one of three moves:
  - **Borrow from the left sibling** (`_borrowFromPrev`): rotate a key down
    from the parent into the child, and rotate the sibling's last key up
    into the parent.
  - **Borrow from the right sibling** (`_borrowFromNext`): mirror image of
    the above.
  - **Merge** (`_merge`): if neither sibling has a key to spare, pull the
    separating key down from the parent and combine the child, the
    separator, and the sibling into a single node. This is the case that
    can propagate upward and shrink the tree's height, symmetric to how
    splitting is the only way it grows.

Choosing "borrow before merge" is what keeps nodes as full as possible and
avoids unnecessary merges, which matters for both space efficiency and
avoiding cascading rebalances.

## Validation

`validate()` walks the whole tree and checks, independent of how the tree
was built:
- every node's key count is within `[t-1, 2t-1]` (root excluded from the
  lower bound),
- keys within a node are strictly increasing,
- every key stays within the bounds imposed by its ancestors,
- internal nodes always have exactly `keys.length + 1` children,
- every leaf sits at the same depth.

This is the check the test suite runs after *every single operation*
during the randomized stress tests, rather than only checking the end
state — that's what catches subtle bugs (e.g. a borrow that updates the
wrong parent key) that would otherwise only show up much later.

## Complexity

See `COMPLEXITY.md` for the full breakdown with the height data from
`height_experiment.mjs`.

## Running it

```
npm test
```

runs `test.js`, which does a fixed set of hand-picked cases plus three
randomized stress tests at increasing scale (`t=2`/200 keys, `t=4`/500
keys, `t=8`/1000 keys), validating structural invariants after every
insert and delete.
