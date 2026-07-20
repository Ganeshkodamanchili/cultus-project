import BTree from './src/BTree.js';

const n = 100000;
for (const t of [2, 4, 8, 16, 32, 64]) {
  const tree = new BTree(t);
  for (let i = 0; i < n; i++) tree.insert(i);
  console.log(`t=${t}: height=${tree.height()}, keys=${tree.size()}`);
}
