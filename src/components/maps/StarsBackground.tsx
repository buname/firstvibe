export interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  phase: number;
  speed: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createStars(width: number, height: number): Star[] {
  const count = Math.max(70, Math.floor((width * height) / 15000));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 0.5 + Math.random() * 0.5,
    baseAlpha: 0.15 + Math.random() * 0.15,
    phase: Math.random() * Math.PI * 2,
    speed: 0.003 + Math.random() * 0.008,
  }));
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  frameTick: number,
  color = "#ffffff"
): void {
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    const twinkle = 0.05 * Math.sin(frameTick * star.speed + star.phase);
    const alpha = clamp(star.baseAlpha + twinkle, 0.15, 0.3);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
