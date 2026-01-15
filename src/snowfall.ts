export class Snowfall {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private flakes: Flake[] = [];
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private flakeCount: number = 100;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "fixed";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none"; // Click through
    this.canvas.style.zIndex = "1"; // On top of everything
    this.ctx = this.canvas.getContext("2d")!;

    window.addEventListener("resize", () => {
      if (this.isRunning) {
        this.resize();
      }
    });
  }

  public start() {
    if (this.isRunning) return;
    document.body.appendChild(this.canvas);
    this.resize();
    this.initFlakes();
    this.isRunning = true;
    this.loop();
  }

  public stop() {
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

  public toggle(enable: boolean) {
    if (enable) {
      this.start();
    } else {
      this.stop();
    }
  }

  private resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private initFlakes() {
    this.flakes = [];
    for (let i = 0; i < this.flakeCount; i++) {
      this.flakes.push(new Flake(this.canvas.width, this.canvas.height));
    }
  }

  private loop() {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const flake of this.flakes) {
      flake.update(this.canvas.width, this.canvas.height);
      flake.draw(this.ctx);
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }
}

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

    // Wrap around vertically
    if (this.y > height) {
      this.y = -this.radius;
      this.x = Math.random() * width;
    }

    // Wrap around horizontally (optional, but good for sway)
    if (this.x > width + this.radius) {
      this.x = -this.radius;
    } else if (this.x < -this.radius) {
      this.x = width + this.radius;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
    ctx.fill();
  }
}
