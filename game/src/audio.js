// Procedural WebAudio sound: every effect is synthesised, no audio files.
// Engine hum, two-tone siren, gunshot, pickup chime, crash thud, UI click and
// a quiet bass-and-hat music loop, all from oscillators and filtered noise.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noiseHit(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  return {
    ensure,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    ui() {
      blip(660, 0.07, 'square', 0.12);
    },
    pickup() {
      blip(523, 0.09, 'sine', 0.2);
      setTimeout(() => blip(784, 0.12, 'sine', 0.2), 70);
      setTimeout(() => blip(1047, 0.16, 'sine', 0.18), 140);
    },
    coin() {
      blip(880, 0.08, 'triangle', 0.18, 1320);
    },
    shot() {
      noiseHit(0.16, 0.5, 2600);
      blip(180, 0.1, 'square', 0.25, 60);
    },
    enemyShot() {
      noiseHit(0.12, 0.22, 1800);
    },
    crash() {
      noiseHit(0.35, 0.55, 500);
      blip(90, 0.3, 'sine', 0.4, 40);
    },
    punch() {
      noiseHit(0.09, 0.35, 900);
    },
    bust() {
      blip(392, 0.25, 'sawtooth', 0.2, 196);
      blip(311, 0.4, 'sawtooth', 0.2, 155);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110));
    },
    // Continuous engine hum; call every frame with speed 0..1 (0 = off).
    engine(speed01) {
      if (!ensure() || muted) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const target = speed01 <= 0.01 ? 0 : 0.05 + speed01 * 0.11;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
    },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.05;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = true;
        sirenTimer = setInterval(() => {
          if (!sirenOsc) return;
          sirenOsc.frequency.setTargetAtTime(high ? 880 : 620, ctx.currentTime, 0.05);
          high = !high;
        }, 420);
      } else if (!on && sirenOsc) {
        clearInterval(sirenTimer);
        sirenTimer = null;
        sirenOsc.stop();
        sirenOsc.disconnect();
        sirenOsc = null;
        sirenGain = null;
      }
    },
    // A slow laid-back loop: root-note bass on a 8-step cycle plus a soft hat.
    startMusic() {
      if (!ensure() || musicTimer) return;
      const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 65.4, 58.3, 0];
      musicTimer = setInterval(() => {
        if (muted) return;
        const note = bass[musicStep % bass.length];
        if (note) blip(note, 0.32, 'triangle', 0.14);
        if (musicStep % 2 === 0) noiseHit(0.03, 0.05, 6000);
        musicStep += 1;
      }, 240);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
