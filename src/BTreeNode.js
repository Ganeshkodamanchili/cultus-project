// A single node in the B-Tree.
// `t` is the minimum degree of the tree (branching factor parameter).
// Every node (except the root) must hold between t-1 and 2t-1 keys.
// An internal node with k keys always has exactly k+1 children.
export default class BTreeNode {
  constructor(t, leaf) {
    this.t = t;
    this.leaf = leaf;
    this.keys = [];
    this.children = [];
  }
}
