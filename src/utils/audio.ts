const DEFAULT_SOUND_DATA_URI = (() => {
  const sampleRate = 22050;
  const durationSeconds = 0.18;
  const frameCount = Math.floor(sampleRate * durationSeconds);
  const amplitude = 0.35;
  const bytes = new Uint8Array(44 + frameCount * 2);
  const view = new DataView(bytes.buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      bytes[offset + i] = value.charCodeAt(i);
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + frameCount * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, frameCount * 2, true);

  for (let i = 0; i < frameCount; i += 1) {
    const t = i / sampleRate;
    const frequency = 880 + (i % 11) * 40;
    const envelope = Math.exp(-3 * t / 0.18);
    const sample = Math.max(-1, Math.min(1, Math.sin(2 * Math.PI * frequency * t) * envelope));
    const intSample = Math.round(sample * amplitude * 0x7fff);
    view.setInt16(44 + i * 2, intSample, true);
  }

  let base64: string;
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  base64 = btoa(binary);

  return `data:audio/wav;base64,${base64}`;
})();

export function createDefaultSoundDataUrl(): string {
  return DEFAULT_SOUND_DATA_URI;
}

export function getSoundSourceOrDefault(source: string | null | undefined): string {
  return source && source.trim() ? source : DEFAULT_SOUND_DATA_URI;
}
