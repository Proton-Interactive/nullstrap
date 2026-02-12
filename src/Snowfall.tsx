import { useEffect } from 'react';

class Flake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
  sway: number;
  swaySpeed: number;

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.radius = Math.random() * 2 + 1;
    this.speed = Math.random() * 0.5 + 0.2;
    this.opacity = Math.random() * 0.5 + 0.3;
    this.sway = Math.random() * Math.PI * 2;
    this.swaySpeed = Math.random() * 0.02 + 0.005;
  }

  update(width: number, height: number) {
    this.y += this.speed;
    this.sway += this.swaySpeed;
    this.x += Math.sin(this.sway) * 0.5;

    if (this.y > height) {
      this.y = -this.radius;
      this.x = Math.random() * width;
    }

    if (this.x > width + this.radius) {
      this.x = -this.radius;
    } else if (this.x < -this.radius) {
      this.x = width + this.radius;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
        ctx.fillStyle = `rgba(100, 100, 110, ${this.opacity})`; 
    } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
    }
    ctx.fill();
  }
}

class SnowfallManager {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  flakes: Flake[] = [];
  isRunning = false;
  animationFrameId: number | null = null;
  flakeCount: number;

  constructor(flakeCount = 100) {
    this.flakeCount = flakeCount;
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1';
    this.ctx = this.canvas.getContext('2d')!;

    window.addEventListener('resize', () => {
      if (this.isRunning) this.resize();
    });
  }

  start() {
    if (this.isRunning) return;
    document.body.appendChild(this.canvas);
    this.resize();
    this.initFlakes();
    this.isRunning = true;
    this.loop();
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (document.body.contains(this.canvas)) {
      document.body.removeChild(this.canvas);
    }
  }

  toggle(enable: boolean) {
    if (enable) this.start();
    else this.stop();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initFlakes() {
    this.flakes = [];
    for (let i = 0; i < this.flakeCount; i++) {
      this.flakes.push(new Flake(this.canvas.width, this.canvas.height));
    }
  }

  loop() {
    if (!this.isRunning) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const flake of this.flakes) {
      flake.update(this.canvas.width, this.canvas.height);
      flake.draw(this.ctx);
    }
    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }
}

let manager: SnowfallManager | null = null;

export function Snowfall({ enabled = true, flakeCount = 100 }: { enabled?: boolean; flakeCount?: number }) {
  useEffect(() => {
    if (!manager) manager = new SnowfallManager(flakeCount);
    if (manager.flakeCount !== flakeCount) {
      manager.flakeCount = flakeCount;
      if (manager.isRunning) manager.initFlakes();
    }

    manager.toggle(enabled);

    return () => {
      if (manager) manager.stop();
    };
  }, [enabled, flakeCount]);

  return null;
}
