export interface SpriteActionConfig {
  imageUrl: string;
  totalFrames: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop?: boolean;
}

export interface SpriteAnimationState {
  currentAction: string;
  currentFrame: number;
  timer: number;
}

export class SpriteRenderer {
  private configs: Record<string, SpriteActionConfig>;

  constructor(configs: Record<string, SpriteActionConfig>) {
    this.configs = configs;
  }

  /**
   * Advances the animation state in-place based on delta time (zero-allocation for 60 FPS).
   */
  getNextState(
    state: SpriteAnimationState,
    deltaTime: number
  ): SpriteAnimationState {
    const config = this.configs[state.currentAction];
    if (!config) return state;

    state.timer += deltaTime;
    const frameDuration = 1 / Math.max(1, config.fps);

    if (state.timer >= frameDuration) {
      const framesToAdvance = Math.floor(state.timer / frameDuration);
      state.timer %= frameDuration;
      const total = Math.max(1, config.totalFrames);
      state.currentFrame = (state.currentFrame + framesToAdvance) % total;

      if (config.loop === false && state.currentFrame < 0) {
        state.currentFrame = total - 1;
      }
    }
    return state;
  }

  /**
   * Draws the sprite to the canvas using preloaded images with robust fallbacks.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    state: SpriteAnimationState,
    x: number,
    y: number,
    width: number,
    height: number,
    loadedImages: Record<string, HTMLImageElement | null>,
    fallbackRole?: 'captain' | 'tactical' | 'science' | 'engineer' | 'helm' | 'doctor'
  ) {
    const config = this.configs[state.currentAction];
    if (!config) return;

    const img = loadedImages[config.imageUrl];

    if (img && img.complete && img.naturalWidth > 0) {
      const framesPerRow = Math.max(1, Math.floor(img.naturalWidth / config.frameWidth));
      const frameIdx = state.currentFrame % Math.max(1, config.totalFrames);
      const sourceX = (frameIdx % framesPerRow) * config.frameWidth;
      const sourceY = Math.floor(frameIdx / framesPerRow) * config.frameHeight;

      // Only draw if within image bounds
      if (sourceX + config.frameWidth <= img.naturalWidth && sourceY + config.frameHeight <= img.naturalHeight) {
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          config.frameWidth,
          config.frameHeight,
          x,
          y,
          width,
          height
        );
        return;
      }
    }

    // High quality procedural officer avatar fallback if image is missing/loading
    this.drawProceduralOfficer(ctx, x, y, width, height, fallbackRole || 'captain');
  }

  private drawProceduralOfficer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    role: 'captain' | 'tactical' | 'science' | 'engineer' | 'helm' | 'doctor'
  ) {
    ctx.save();
    const roleColors: Record<string, { uniform: string; trim: string; badge: string }> = {
      captain: { uniform: '#d97706', trim: '#fbbf24', badge: '#fef08a' }, // Command Gold
      tactical: { uniform: '#dc2626', trim: '#f87171', badge: '#fef08a' }, // Tactical Red
      helm: { uniform: '#ea580c', trim: '#fb923c', badge: '#fef08a' },     // Operations Bronze
      science: { uniform: '#0284c7', trim: '#38bdf8', badge: '#fef08a' },  // Science Blue
      engineer: { uniform: '#b45309', trim: '#f59e0b', badge: '#fef08a' }, // Engineering Ochre
      doctor: { uniform: '#0891b2', trim: '#22d3ee', badge: '#fef08a' },   // Medical Cyan
    };

    const color = roleColors[role] || roleColors.captain;
    const cx = x + width / 2;
    const cy = y + height / 2;

    // Subtle station seat backdrop
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.strokeStyle = color.trim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, width - 8, height - 8, 8);
    ctx.fill();
    ctx.stroke();

    // Officer Torso / Uniform
    ctx.fillStyle = color.uniform;
    ctx.beginPath();
    ctx.moveTo(cx - width * 0.28, cy + height * 0.38);
    ctx.lineTo(cx - width * 0.22, cy - height * 0.05);
    ctx.lineTo(cx + width * 0.22, cy - height * 0.05);
    ctx.lineTo(cx + width * 0.28, cy + height * 0.38);
    ctx.closePath();
    ctx.fill();

    // Collar / Undershirt
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(cx - width * 0.12, cy - height * 0.05);
    ctx.lineTo(cx, cy + height * 0.1);
    ctx.lineTo(cx + width * 0.12, cy - height * 0.05);
    ctx.closePath();
    ctx.fill();

    // Starfleet Delta Insignia Badge
    ctx.fillStyle = color.badge;
    ctx.beginPath();
    ctx.moveTo(cx - width * 0.1, cy + height * 0.02);
    ctx.lineTo(cx - width * 0.05, cy + height * 0.12);
    ctx.lineTo(cx - width * 0.15, cy + height * 0.12);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(cx, cy - height * 0.2, width * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Headgear
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx, cy - height * 0.24, width * 0.18, Math.PI, Math.PI * 2);
    ctx.fill();

    // Console glow reflection on officer
    const grad = ctx.createLinearGradient(cx, cy, cx, y + height);
    grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(x + 6, cy, width - 12, height * 0.5);

    ctx.restore();
  }
}
