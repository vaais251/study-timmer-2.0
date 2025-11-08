import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

declare var Tone: any;

interface CelebrationAnimationProps {
    message: string;
    onComplete: () => void;
}

const CelebrationAnimation: React.FC<CelebrationAnimationProps> = ({ message, onComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameIdRef = useRef<number>(0);
    const audioResourcesRef = useRef<{ synth: any | null }>({ synth: null });

    useEffect(() => {
        const onCompleteTimer = setTimeout(onComplete, 8000);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            if (canvas) {
                canvas.width = width;
                canvas.height = height;
            }
        };
        window.addEventListener('resize', handleResize);

        // --- AUDIO ---
        let isAudioReady = false;
        const initAudio = async () => {
            if (isAudioReady) return;
            try {
                await Tone.start();
                const explosionFilter = new Tone.Filter(800, "lowpass").toDestination();
                audioResourcesRef.current.synth = new Tone.NoiseSynth({
                    noise: { type: 'pink' },
                    envelope: { attack: 0.001, decay: 0.8, sustain: 0, release: 0.8 },
                    volume: -5
                }).connect(explosionFilter);
                isAudioReady = true;
            } catch (e) {
                console.error("Could not start audio context:", e);
            }
        };

        const playExplosionSound = () => {
            if (!isAudioReady || !audioResourcesRef.current.synth) return;
            audioResourcesRef.current.synth.triggerAttackRelease("8n", Tone.now() + 0.1);
        };

        initAudio();

        // --- FIREWORKS ENGINE ---
        let particles: Particle[] = [];
        let fireworks: Firework[] = [];

        class Particle {
            x: number; y: number; hue: number; brightness: number; alpha: number; decay: number;
            vx: number; vy: number; gravity: number; friction: number;

            constructor(x: number, y: number, hue: number) {
                this.x = x;
                this.y = y;
                this.hue = hue + (Math.random() * 40 - 20);
                this.brightness = Math.random() * 40 + 50;
                this.alpha = 1;
                this.decay = Math.random() * 0.015 + 0.005;
                const speed = Math.random() * 5 + 2;
                const angle = Math.random() * Math.PI * 2;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.gravity = 0.15;
                this.friction = 0.96;
            }

            update() {
                this.vx *= this.friction;
                this.vy *= this.friction;
                this.vy += this.gravity;
                this.x += this.vx;
                this.y += this.vy;
                this.alpha -= this.decay;
            }

            draw() {
                if (!ctx) return;
                ctx.globalAlpha = this.alpha;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${this.hue}, 100%, ${this.brightness}%, ${this.alpha})`;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        class Firework {
            x: number; y: number; targetY: number; speed: number; angle: number;
            vx: number; vy: number; hue: number; brightness: number; active: boolean;

            constructor() {
                this.x = Math.random() * width;
                this.y = height;
                this.targetY = Math.random() * (height * 0.5) + (height * 0.1);
                this.speed = Math.random() * 3 + 8;
                this.angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.2;
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
                this.hue = Math.random() * 360;
                this.brightness = Math.random() * 30 + 50;
                this.active = true;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.vy += 0.1;

                if (this.vy >= 0 || this.y <= this.targetY) {
                    this.explode();
                    this.active = false;
                }
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = `hsl(${this.hue}, 100%, 50%)`;
                ctx.fill();
            }

            explode() {
                playExplosionSound();
                const particleCount = Math.random() * 50 + 80;
                for (let i = 0; i < particleCount; i++) {
                    particles.push(new Particle(this.x, this.y, this.hue));
                }
            }
        }

        for (let i = 0; i < 5; i++) {
            setTimeout(() => fireworks.push(new Firework()), i * 300);
        }
        
        const animate = () => {
            animationFrameIdRef.current = requestAnimationFrame(animate);

            if (!ctx) return;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.05)';
            ctx.fillRect(0, 0, width, height);
            
            if (Math.random() < 0.05) {
                fireworks.push(new Firework());
            }

            for (let i = fireworks.length - 1; i >= 0; i--) {
                fireworks[i].update();
                fireworks[i].draw();
                if (!fireworks[i].active) {
                    fireworks.splice(i, 1);
                }
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                particles[i].update();
                particles[i].draw();
                if (particles[i].alpha <= 0) {
                    particles.splice(i, 1);
                }
            }
        };

        animate();

        return () => {
            clearTimeout(onCompleteTimer);
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameIdRef.current);
            if (audioResourcesRef.current.synth) {
                audioResourcesRef.current.synth.dispose();
            }
        };
    }, [onComplete]);

    return createPortal(
        <div className="celebration-overlay fixed inset-0 w-full h-screen z-[100] pointer-events-auto" onClick={onComplete}>
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none space-y-4">
                <h1 className="celebration-title text-5xl md:text-8xl font-extrabold tracking-wider text-center px-4">
                    Congratulations!
                </h1>
                <p className="celebration-message text-slate-100 text-xl md:text-2xl text-center max-w-lg px-4" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                    {message}
                </p>
            </div>
        </div>,
        document.body
    );
};

export default CelebrationAnimation;