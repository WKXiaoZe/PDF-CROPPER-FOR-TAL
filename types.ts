export interface Dimensions {
  width: number;
  height: number;
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 1 inch = 72 points
// 1 cm = 0.393701 inches

export const MM_TO_POINT = 72 / 25.4;

export type CropMode = '20x6' | '10x10';

export interface ModeConfig {
  id: CropMode;
  name: string;
  cellWidthMm: number;
  cellHeightMm: number;
  gridCols: number;
  gridRows: number;
}

export const CROP_MODES: Record<CropMode, ModeConfig> = {
  '20x6': {
    id: '20x6',
    name: '20x6cm (10格)',
    cellWidthMm: 40,
    cellHeightMm: 30,
    gridCols: 5,
    gridRows: 2,
  },
  '10x10': {
    id: '10x10',
    name: '10x10cm (单格)',
    cellWidthMm: 100,
    cellHeightMm: 100,
    gridCols: 1,
    gridRows: 1,
  }
};
