
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
    if (!audioContext && (window.AudioContext || (window as any).webkitAudioContext)) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
};

export const resumeAudioContext = (): void => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume();
    }
};

const playSound = (frequency: number, duration: number): void => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
        console.error("Error playing sound: ", e);
    }
};

export const playFocusStartSound = () => { playSound(523.25, 0.15); setTimeout(() => playSound(659.25, 0.15), 150); setTimeout(() => playSound(783.99, 0.2), 300); setTimeout(() => playSound(1046.50, 0.25), 450); };
export const playFocusEndSound = () => { playSound(1046.50, 0.1); setTimeout(() => playSound(1174.66, 0.1), 100); setTimeout(() => playSound(1318.51, 0.1), 200); setTimeout(() => playSound(1567.98, 0.2), 300); setTimeout(() => playSound(1567.98, 0.1), 500); setTimeout(() => playSound(1318.51, 0.3), 600); };
export const playBreakStartSound = () => { playSound(880, 0.2); setTimeout(() => playSound(783.99, 0.2), 200); setTimeout(() => playSound(659.25, 0.2), 400); setTimeout(() => playSound(523.25, 0.3), 600); };
export const playBreakEndSound = () => { playSound(659.25, 0.15); setTimeout(() => playSound(659.25, 0.15), 200); setTimeout(() => playSound(783.99, 0.2), 400); setTimeout(() => playSound(1046.50, 0.25), 600); };
export const playAlertLoop = () => { playSound(1000, 0.3); setTimeout(() => playSound(1200, 0.3), 400); };
