
let audioContext: AudioContext | null = null;
let whiteNoiseNode: AudioBufferSourceNode | null = null;
let whiteNoiseGainNode: GainNode | null = null;

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
        
    }
};

export const playFocusStartSound = () => { playSound(523.25, 0.15); setTimeout(() => playSound(659.25, 0.15), 150); setTimeout(() => playSound(783.99, 0.2), 300); setTimeout(() => playSound(1046.50, 0.25), 450); };
export const playFocusEndSound = () => { playSound(1046.50, 0.1); setTimeout(() => playSound(1174.66, 0.1), 100); setTimeout(() => playSound(1318.51, 0.1), 200); setTimeout(() => playSound(1567.98, 0.2), 300); setTimeout(() => playSound(1567.98, 0.1), 500); setTimeout(() => playSound(1318.51, 0.3), 600); };
export const playBreakStartSound = () => { playSound(880, 0.2); setTimeout(() => playSound(783.99, 0.2), 200); setTimeout(() => playSound(659.25, 0.2), 400); setTimeout(() => playSound(523.25, 0.3), 600); };
export const playBreakEndSound = () => { playSound(659.25, 0.15); setTimeout(() => playSound(659.25, 0.15), 200); setTimeout(() => playSound(783.99, 0.2), 400); setTimeout(() => playSound(1046.50, 0.25), 600); };
export const playAlertLoop = () => { playSound(1000, 0.3); setTimeout(() => playSound(1200, 0.3), 400); };
export const playNotificationSound = () => { playSound(880.00, 0.1); setTimeout(() => playSound(1046.50, 0.2), 120); };


// --- White Noise ---
export const playWhiteNoise = (): void => {
    const ctx = getAudioContext();
    if (!ctx || whiteNoiseNode) return;

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    whiteNoiseNode = ctx.createBufferSource();
    whiteNoiseNode.buffer = noiseBuffer;
    whiteNoiseNode.loop = true;

    whiteNoiseGainNode = ctx.createGain();
    whiteNoiseGainNode.gain.setValueAtTime(0.1, ctx.currentTime);

    whiteNoiseNode.connect(whiteNoiseGainNode).connect(ctx.destination);
    whiteNoiseNode.start();
};

export const stopWhiteNoise = (): void => {
    if (whiteNoiseNode) {
        whiteNoiseNode.stop();
        whiteNoiseNode.disconnect();
        whiteNoiseNode = null;
    }
    if (whiteNoiseGainNode) {
        whiteNoiseGainNode.disconnect();
        whiteNoiseGainNode = null;
    }
};

export const setWhiteNoiseVolume = (volume: number): void => {
    const ctx = getAudioContext();
    if (whiteNoiseGainNode && ctx) {
        // Volume is between 0 and 1, but we want it to be quiet. Max at 0.2
        const effectiveVolume = Math.max(0, Math.min(0.2, volume));
        whiteNoiseGainNode.gain.setValueAtTime(effectiveVolume, ctx.currentTime);
    }
};