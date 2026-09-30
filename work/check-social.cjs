const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "harbor-social.js"), "utf8");
const context = { localStorage: { getItem() { return '{broken'; }, setItem() { throw new Error("blocked"); } } };
vm.runInNewContext(source, context);
const social = context.HarborSocial;
assert.equal(social.people.length, 7);
assert.equal(social.objects.length, 4);
assert.equal(social.contacts().length, 0);
const ids = new Set([...social.people, ...social.objects].map(item => item.id));
assert.equal(ids.size, 11);
for (const target of [...social.people, ...social.objects]) {
  assert.equal(social.nearest(target.dock, target.x).id, target.id);
  assert.equal(social.nearest("missing", target.x), null);
  const visited = new Set(), queue = ["start"];
  while (queue.length) {
    const nodeId = queue.pop();
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = social.getNode(target.id, nodeId);
    assert.ok(node && node.text.length > 20, `Missing conversation ${target.id}/${nodeId}`);
    assert.ok(node.choices.length > 0 && node.choices.length <= 4);
    for (const item of node.choices) {
      assert.ok(item.text.length > 3);
      if (item.next !== null) queue.push(item.next);
    }
  }
}
social.remember("emine"); social.remember("emine"); social.remember("nonsense");
assert.deepEqual(Array.from(social.contacts()), ["emine"]);
assert.equal(social.nearest("rihtim", NaN), null);
assert.equal(social.getNode("missing"), null);
assert.equal(social.getNode("emine", "missing"), null);
assert.equal(social.getNode("yusuf", "start", { delivered: true }).node, "done");
assert.match(social.getNode("emine").text, /kardeşim/);
assert.match(social.getNode("sefa").text, /Abi/);
console.log("Social content checks passed: 7 people, 4 objects, all dialogue branches resolve, ordinary Turkish, isolated tolerant persistence.");
