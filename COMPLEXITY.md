# Complexity Analysis

Let `n` be the number of keys and `t` be the minimum degree (branching
factor parameter). Each node holds between `t-1` and `2t-1` keys, so the
tree has between `t` and `2t` children per internal node.

## Height

Because every node (other than the root) is at least half full, the height
of the tree is bounded by:

```
h <= log_t((n+1)/2)
```

which is `O(log_t n)`. This is the whole reason B-Trees exist: as `t`
grows, the height shrinks fast. Measured directly (`height_experiment.mjs`,
100,000 keys inserted in order):

| t  | height |
|----|--------|
| 2  | 16     |
| 4  | 8      |
| 8  | 6      |
| 16 | 4      |
| 32 | 4      |
| 64 | 3      |

## Search — O(t log_t n)

At each of the `O(log_t n)` levels, search does a scan through up to
`2t-1` keys to find which child to descend into (`search()` in
`src/BTree.js` uses a linear scan here; this could be a binary search per
node instead, which would bring it to `O(log t * log_t n)`, but for
realistic `t` values a linear scan over a single already-in-cache node is
usually faster in practice than the branch overhead of binary search).

## Insert — O(t log_t n)

Insertion is a search (`O(t log_t n)`) plus, in the worst case, one split
per level on the way down (`_splitChild`), each of which does `O(t)` work
to redistribute keys and children. So the total stays `O(t log_t n)`.

## Delete — O(t log_t n)

Same shape as insert: a downward pass of `O(log_t n)` levels, and at each
level a possible borrow or merge (`_fill`, `_borrowFromPrev`,
`_borrowFromNext`, `_merge`), each of which touches `O(t)` keys/children.
Finding a predecessor or successor for internal-node deletion adds another
`O(log_t n)` descent in the worst case, which doesn't change the overall
bound.

## Space — O(n)

Every key is stored exactly once, in exactly one node, so total space is
`O(n)` regardless of `t`. Larger `t` doesn't waste space overall — it just
changes how that space is distributed (fewer, larger nodes instead of many
small ones).

## Practical takeaway

The parameter `t` is a trade-off knob, not a free win:
- **Larger `t`** → shorter tree → fewer node visits (fewer disk reads in a
  real disk-backed index) → but more work *per node* since each node scan
  touches more keys.
- **Smaller `t`** → taller tree → more node visits → but each visit is
  cheap.

For an in-memory index the difference is minor. For a disk-backed index,
`t` is normally picked so a single node fits exactly one disk page (e.g.
4KB), which is why real databases use B-Trees (or B+Trees) with branching
factors in the hundreds rather than the small values (2-4) used in
textbook examples.
