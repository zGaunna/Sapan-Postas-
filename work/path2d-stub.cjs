"use strict";

// Record geometry so VM checks can validate paths without a browser Canvas.
class Path2DStub {
  constructor() { this.commands = []; }
  moveTo(x, y) { this.commands.push(["moveTo", x, y]); }
  lineTo(x, y) { this.commands.push(["lineTo", x, y]); }
}
module.exports = Path2DStub;
