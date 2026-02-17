export type WatermarkLevel = 'off' | 'whisper' | 'heads-up' | 'loud' | 'screaming';

export interface WatermarkMeta {
  level: WatermarkLevel;
  opacity: number;
  fontSize: number;
  fontWeight: number;
  tileGap: number;
  rotation: number;
}

export const WATERMARK_LEVELS: Record<Exclude<WatermarkLevel, 'off'>, WatermarkMeta> = {
  whisper: {
    level: 'whisper',
    opacity: 0.04,
    fontSize: 48,
    fontWeight: 500,
    tileGap: 400,
    rotation: -30,
  },
  'heads-up': {
    level: 'heads-up',
    opacity: 0.08,
    fontSize: 80,
    fontWeight: 700,
    tileGap: 300,
    rotation: -35,
  },
  loud: {
    level: 'loud',
    opacity: 0.14,
    fontSize: 110,
    fontWeight: 800,
    tileGap: 220,
    rotation: -40,
  },
  screaming: {
    level: 'screaming',
    opacity: 0.22,
    fontSize: 140,
    fontWeight: 900,
    tileGap: 150,
    rotation: -45,
  },
};
