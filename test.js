import BTree from './src/BTree.js';

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

function arraysEqualAsSets(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((v, i) => v === sortedB[i]);
}

function runFixedTests() {
  console.log('--- Fixed test cases ---');

 
  const tree = new BTree(2);
  const inputs = [10, 20, 5, 6, 12, 30, 7, 17, 3, 25, 1, 8];
  for (const key of inputs) {
    tree.insert(key);
    tree.validate();
  }
  const sorted = [...inputs].sort((a, b) => a - b);
  assert(arraysEqualAsSets(tree.inOrder(), sorted), 'in-order traversal matches sorted input after inserts');
  console.log(`PASS: inserted ${inputs.length} keys, tree height ${tree.height()}, in-order sorted correctly`);

  for (const key of [6, 13, 7, 4, 30]) {
    if (key === 13 || key === 4) {
      assert(!tree.has(key), `key ${key} should not exist before delete (sanity check)`);
      tree.delete(key); 
      tree.validate();
      continue;
    }
    tree.delete(key);
    tree.validate();
    assert(!tree.has(key), `key ${key} should be gone after delete`);
  }
  console.log('PASS: deletions (including borrow/merge cases) leave tree valid');


  for (const key of [...inputs]) tree.delete(key);
  assert(tree.root === null, 'tree root should be null after deleting all keys');
  console.log('PASS: deleting all keys empties the tree cleanly');
}

function runRandomizedStressTest(numKeys, degree, seedLabel) {
  console.log(`\n--- Randomized stress test: t=${degree}, ${numKeys} keys (${seedLabel}) ---`);

  const tree = new BTree(degree);
  const present = new Set();

  let insertCount = 0;
  let deleteCount = 0;
  let deleteOfMissingCount = 0;

  
  for (let i = 0; i < numKeys; i++) {
    const key = Math.floor(Math.random() * numKeys * 3);
    tree.insert(key);
    present.add(key);
    tree.validate();
    insertCount++;
  }
  assert(arraysEqualAsSets(tree.inOrder(), [...present]), 'tree contents match expected set after inserts');
  console.log(`  inserted ${insertCount} operations -> ${present.size} unique keys, height=${tree.height()}`);

  for (let i = 0; i < numKeys; i++) {
    const doInsert = Math.random() < 0.5;
    const key = Math.floor(Math.random() * numKeys * 3);

    if (doInsert) {
      tree.insert(key);
      present.add(key);
      insertCount++;
    } else {
      const wasPresent = present.has(key);
      tree.delete(key);
      present.delete(key);
      deleteCount++;
      if (!wasPresent) deleteOfMissingCount++;
    }
    tree.validate();
  }
  assert(arraysEqualAsSets(tree.inOrder(), [...present]), 'tree contents match expected set after mixed ops');
  console.log(
    `  mixed phase: ${insertCount} total inserts, ${deleteCount} deletes (${deleteOfMissingCount} of them on missing keys), height=${tree.height()}, size=${tree.size()}`
  );

  const remaining = [...present];
  for (const key of remaining) {
    tree.delete(key);
    tree.validate();
  }
  assert(tree.root === null, 'tree should be empty after draining all remaining keys');
  console.log(`  drained remaining ${remaining.length} keys, tree is now empty, invariants held throughout`);

  console.log(`PASS: t=${degree}, ${numKeys}-key stress test completed with no invariant violations`);
}

console.log('=== B-Tree Test Suite ===');
console.log(`Run started: ${new Date().toISOString()}\n`);

try {
  runFixedTests();
  runRandomizedStressTest(200, 2, 'run A');
  runRandomizedStressTest(500, 4, 'run B');
  runRandomizedStressTest(1000, 8, 'run C');
  console.log('\n=== ALL TESTS PASSED ===');
} catch (err) {
  console.error('\n=== TEST SUITE FAILED ===');
  console.error(err);
  process.exit(1);
}
