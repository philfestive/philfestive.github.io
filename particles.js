/**
 * Object-pooled particle system for ambient floating dust effect
 * Features: Canvas rendering, object pooling, reduced-motion support,
 * visibility API pause, mobile optimization
 */

(function() {
  'use strict';

  // Respect reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  // Check for low-power mode or low-end device
  const isLowPower = navigator.connection?.saveData ||
                     navigator.hardwareConcurrency <= 2;
  const isMobile = window.innerWidth < 768;

  // Configuration
  const CONFIG = {
    particleCount: isLowPower ? 15 : (isMobile ? 30 : 60),
    colors: [
      { r: 255, g: 215, b: 0 },    // Gold (primary)
      { r: 255, g: 215, b: 0 },    // Gold (weighted)
      { r: 255, g: 215, b: 0 },    // Gold (weighted)
      { r: 145, g: 70, b: 255 }    // Purple (accent)
    ],
    minSize: isMobile ? 3 : 2,
    maxSize: isMobile ? 8 : 6,
    minSpeed: 0.2,
    maxSpeed: 0.6,
    oscillationAmplitude: 30,
    oscillationSpeed: 0.002,
    fadeInDuration: 60,   // frames
    fadeOutDuration: 60   // frames
  };

  /**
   * ParticlePool - Pre-allocates particles to avoid garbage collection
   */
  class ParticlePool {
    constructor(maxSize) {
      this.pool = [];
      this.active = [];

      // Pre-allocate all particles at startup
      for (let i = 0; i < maxSize; i++) {
        this.pool.push(this.createParticle());
      }
    }

    createParticle() {
      return {
        x: 0,
        y: 0,
        baseX: 0,
        size: 0,
        speed: 0,
        color: null,
        colorStr: '', // Pre-computed color string to avoid per-frame concatenation
        alpha: 0,
        phase: 0,
        oscillationOffset: 0,
        state: 'inactive', // inactive, fadingIn, alive, fadingOut
        stateTimer: 0,
        lifetime: 0
      };
    }

    acquire() {
      if (this.pool.length === 0) return null;
      const particle = this.pool.pop();
      this.active.push(particle);
      return particle;
    }

    release(particle) {
      const index = this.active.indexOf(particle);
      if (index === -1) return;

      // Swap-and-pop for O(1) removal
      const lastIndex = this.active.length - 1;
      if (index !== lastIndex) {
        this.active[index] = this.active[lastIndex];
      }
      this.active.pop();

      particle.state = 'inactive';
      this.pool.push(particle);
    }

    getActive() {
      return this.active;
    }

    getAvailableCount() {
      return this.pool.length;
    }
  }

  /**
   * ParticleSystem - Manages canvas, animation, and particle lifecycle
   */
  class ParticleSystem {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.pool = null;
      this.animationId = null;
      this.isRunning = false;
      this.spawnTimer = 0;
      this.spawnInterval = 10; // frames between spawns

      this.init();
    }

    init() {
      this.createCanvas();
      this.pool = new ParticlePool(CONFIG.particleCount);
      this.setupResizeObserver();
      this.setupVisibilityHandler();
      this.start();
    }

    createCanvas() {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'particle-canvas';
      this.ctx = this.canvas.getContext('2d');

      this.resizeCanvas();
      document.body.insertBefore(this.canvas, document.body.firstChild);
    }

    resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';

      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.dpr = dpr;
    }

    setupResizeObserver() {
      if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(() => {
          this.resizeCanvas();
        });
        observer.observe(document.documentElement);
      } else {
        // Fallback for older browsers
        window.addEventListener('resize', () => this.resizeCanvas());
      }
    }

    setupVisibilityHandler() {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pause();
        } else {
          this.resume();
        }
      });
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.animate();
    }

    pause() {
      this.isRunning = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }

    resume() {
      if (!this.isRunning) {
        this.start();
      }
    }

    spawnParticle() {
      const particle = this.pool.acquire();
      if (!particle) return;

      const color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];

      particle.baseX = Math.random() * this.canvas.width;
      particle.x = particle.baseX;
      particle.y = this.canvas.height + 20;
      particle.size = CONFIG.minSize + Math.random() * (CONFIG.maxSize - CONFIG.minSize);
      particle.speed = CONFIG.minSpeed + Math.random() * (CONFIG.maxSpeed - CONFIG.minSpeed);
      particle.color = color;
      particle.colorStr = `${color.r}, ${color.g}, ${color.b}`; // Pre-compute color string
      particle.alpha = 0;
      particle.phase = Math.random() * Math.PI * 2;
      particle.oscillationOffset = Math.random() * 1000;
      particle.state = 'fadingIn';
      particle.stateTimer = 0;
      particle.lifetime = 0;
    }

    updateParticle(particle) {
      particle.lifetime++;

      // Update position
      particle.y -= particle.speed;
      particle.phase += CONFIG.oscillationSpeed;
      particle.x = particle.baseX + Math.sin(particle.phase + particle.oscillationOffset) * CONFIG.oscillationAmplitude;

      // State machine for fade in/out
      switch (particle.state) {
        case 'fadingIn':
          particle.stateTimer++;
          particle.alpha = Math.min(1, particle.stateTimer / CONFIG.fadeInDuration) * 0.6;
          if (particle.stateTimer >= CONFIG.fadeInDuration) {
            particle.state = 'alive';
            particle.stateTimer = 0;
          }
          break;

        case 'alive':
          particle.alpha = 0.6;
          // Start fading out when near the top
          if (particle.y < this.canvas.height * 0.15) {
            particle.state = 'fadingOut';
            particle.stateTimer = 0;
          }
          break;

        case 'fadingOut':
          particle.stateTimer++;
          particle.alpha = Math.max(0, (1 - particle.stateTimer / CONFIG.fadeOutDuration)) * 0.6;
          if (particle.stateTimer >= CONFIG.fadeOutDuration || particle.y < -20) {
            return false; // Signal to release
          }
          break;
      }

      // Release if particle went off screen
      if (particle.y < -20) {
        return false;
      }

      return true;
    }

    drawParticle(particle) {
      const { x, y, size, colorStr, alpha } = particle;

      // Draw soft bokeh circle using gradient-only blur effect
      // (ctx.filter is not supported on mobile Safari/older browsers)
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      // Use pre-computed color string to avoid per-frame concatenation (reduces GC pressure)
      gradient.addColorStop(0, `rgba(${colorStr}, ${alpha})`);
      gradient.addColorStop(0.3, `rgba(${colorStr}, ${alpha * 0.6})`);
      gradient.addColorStop(0.6, `rgba(${colorStr}, ${alpha * 0.2})`);
      gradient.addColorStop(1, `rgba(${colorStr}, 0)`);

      this.ctx.beginPath();
      this.ctx.arc(x, y, size * 3, 0, Math.PI * 2);
      this.ctx.fillStyle = gradient;
      this.ctx.fill();
    }

    animate() {
      if (!this.isRunning) return;

      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Spawn new particles
      this.spawnTimer++;
      if (this.spawnTimer >= this.spawnInterval && this.pool.getAvailableCount() > 0) {
        this.spawnParticle();
        this.spawnTimer = 0;
      }

      // Update and draw active particles
      const active = this.pool.getActive();
      const toRelease = [];

      for (let i = 0; i < active.length; i++) {
        const particle = active[i];
        const alive = this.updateParticle(particle);

        if (alive) {
          this.drawParticle(particle);
        } else {
          toRelease.push(particle);
        }
      }

      // Release dead particles
      for (let i = 0; i < toRelease.length; i++) {
        this.pool.release(toRelease[i]);
      }

      this.animationId = requestAnimationFrame(() => this.animate());
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ParticleSystem());
  } else {
    new ParticleSystem();
  }
})();
