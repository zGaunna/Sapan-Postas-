interface LevelAnchor {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly type: "normal" | "fragile" | "winch";
}

interface HarborDistrict {
  readonly id: string;
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly practiceX: number;
  readonly accent: string;
  readonly skyTop: string;
  readonly skyBottom: string;
  readonly waterTop: string;
}

interface SceneryOptions {
  cameraX?: number;
  width?: number;
  height?: number;
  time?: number;
  motion?: boolean;
}

declare var LevelData: Readonly<{
  anchorCount: number;
  anchorStartX: number;
  anchorSpacing: number;
  anchorHeights: readonly number[];
  fragileAnchorIds: readonly number[];
  winchAnchorIds: readonly number[];
  anchors: readonly LevelAnchor[];
}>;

declare var HarborMap: Readonly<{
  districts: readonly HarborDistrict[];
  checkpoints: readonly number[];
  practiceStarts: readonly number[];
  end: number;
  districtAt(x: number): HarborDistrict | null | undefined;
  practiceForSeal(id: number): number | null;
  drawScenery(ctx: CanvasRenderingContext2D, options?: SceneryOptions): void;
}>;
