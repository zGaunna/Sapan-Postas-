(() => {
  "use strict";

  const anchorCount = 27;
  const anchorStartX = 440;
  const anchorSpacing = 650;
  const anchorHeights = Object.freeze([305, 265, 370, 295, 405, 300, 345, 250, 390, 310, 420, 285, 360]);
  const fragileAnchorIds = Object.freeze([6, 10, 18]);
  const winchAnchorIds = Object.freeze([13, 24]);
  const anchors = Object.freeze(Array.from({ length: anchorCount }, (_, id) => Object.freeze({
    id, x: anchorStartX + id * anchorSpacing, y: anchorHeights[id % anchorHeights.length],
    type: fragileAnchorIds.includes(id) ? "fragile" : winchAnchorIds.includes(id) ? "winch" : "normal"
  })));

  globalThis.LevelData = Object.freeze({
    anchorCount, anchorStartX, anchorSpacing, anchorHeights, fragileAnchorIds, winchAnchorIds, anchors
  });
})();
