"""Pista de sonido del video, sintetizada (sin samples ni licencias).
Uso: python3 audio.py audio-events.json salida.wav
Eventos: ping, hum_start, bip (audio logo), pad_start (acordes), beat (pulso), whoosh, hit, riser, tick, click, chime, final.
"""
import json, sys, wave
import numpy as np

SR = 44100
def env(n, a=0.004, d=0.08):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)
def tone(f, dur, d=0.08, h=()):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.sin(2 * np.pi * f * t)
    for k, amp in h: s += amp * np.sin(2 * np.pi * f * k * t)
    return s * env(n, d=d)
def verb(x, mix=.18):
    out = x.copy()
    for dl, g in ((0.031, .5), (0.047, .4), (0.071, .3), (0.113, .2)):
        k = int(dl * SR); y = np.zeros_like(x); y[k:] = x[:-k] * g; out += y * mix * 3
    return out
def bip():  # B · "que resuelve": dos notas que suben (bi-ip)
    return verb(np.concatenate([tone(1319, .07, d=.03), tone(1976, .30, d=.08)]))

def pluck(f, dur):  # marimba: fundamental + parcial alto que se apaga rápido
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 9) + .35 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t * 30)) * np.minimum(t / .002, 1)

def add(buf, t, x, v=1.0):
    i = int(t * SR); e = min(len(buf), i + len(x))
    if i < len(buf): buf[i:e] += x[:e - i] * v

def main(src, dst):
    cfg = json.load(open(src)); dur = cfg['dur']; ev = cfg['events']
    buf = np.zeros(int(dur * SR) + SR)
    tb = next(e['t'] for e in ev if e['type'] == 'bip')
    for e in ev:
        if e['type'] == 'ping' and e['t'] < tb:
            add(buf, e['t'], tone(e['f'], .14, d=.045, h=((2, .2),)), .18 * e['v'])
        elif e['type'] == 'hum_start':
            n = int((tb - e['t']) * SR); t = np.arange(n) / SR; g = np.linspace(0, 1, n) ** 1.6
            rng = np.random.default_rng(3)
            hum = .05 * np.sin(2 * np.pi * 55 * t) + .03 * np.sin(2 * np.pi * 110.5 * t) + .02 * rng.standard_normal(n)
            add(buf, e['t'], hum * g)
        elif e['type'] == 'bip':
            add(buf, e['t'], bip(), .55)
        elif e['type'] == 'pad_start':  # acordes que cambian cada 2,3 s: Do, La m, Fa, Sol
            CH = [(261.6, 329.6, 392.0), (220.0, 261.6, 329.6), (174.6, 220.0, 261.6), (196.0, 246.9, 293.7)]
            n = int((dur - e['t']) * SR); t = np.arange(n) / SR; seg = int(2.3 * SR); pad = np.zeros(n)
            for k, i in enumerate(range(0, n, seg)):
                j = min(n, i + seg); tt = t[i:j] - t[i]; ch = CH[k % 4]
                pad[i:j] = sum(np.sin(2 * np.pi * f * tt) + .3 * np.sin(4 * np.pi * f * tt) for f in ch) * np.minimum(tt / .25, 1) * np.minimum((t[j-1] - t[i] - tt + .01) / .25, 1)
            g = np.minimum(t / 1.5, 1) * .035
            add(buf, e['t'], pad * g)
        elif e['type'] == 'beat':  # pulso: bombo en cada tiempo, hi-hat a contratiempo, palmas en 2 y 4
            spb = 60 / e['bpm']; rng = np.random.default_rng(5); k = 0; tb = e['t']
            while tb < e['end']:
                n = int(.2 * SR); tt = np.arange(n) / SR
                kick = np.sin(2 * np.pi * (45 * tt + 75 * (1 - np.exp(-tt * 30)) / 30)) * np.exp(-tt * 14)
                add(buf, tb, kick, .5)
                h = rng.standard_normal(int(.04 * SR)); h = np.diff(h, prepend=0) * np.exp(-np.arange(len(h)) / SR * 90)
                add(buf, tb + spb / 2, h, .06)
                if k % 2 == 1:
                    c = rng.standard_normal(int(.12 * SR)) * np.exp(-np.arange(int(.12 * SR)) / SR * 30)
                    add(buf, tb, c, .07)
                tb += spb; k += 1
        elif e['type'] == 'whoosh':  # transición: dos notas de marimba que suben (sin ruido ni barrido)
            for k, (dt, f) in enumerate(((0, 783.99), (.09, 1174.66))):
                add(buf, e['t'] - .05 + dt, verb(pluck(f, .35)), .12 - k * .02)
        elif e['type'] == 'hit':  # golpe grave + click
            n = int(.5 * SR); tt = np.arange(n) / SR
            boom = np.sin(2 * np.pi * (38 * tt + 90 * (1 - np.exp(-tt * 18)) / 18)) * np.exp(-tt * 6)
            add(buf, e['t'], boom, .45); add(buf, e['t'], tone(3200, .02, d=.004), .2)
        elif e['type'] == 'riser':  # antes de un cambio: arpegio de marimba que sube y se acelera (sin barrido)
            d = e.get('d', 1.0); notes = (261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5)
            for k, f in enumerate(notes):
                add(buf, e['t'] + d * (1 - (1 - k / len(notes)) ** 1.6), verb(pluck(f, .4)), .07 + .015 * k)
        elif e['type'] == 'tick':
            add(buf, e['t'], tone(e.get('f', 1200), .09, d=.025), .16)
        elif e['type'] == 'click':
            add(buf, e['t'], tone(2400, .05, d=.006) + .5 * tone(900, .05, d=.012), .3)
        elif e['type'] == 'chime':
            add(buf, e['t'], verb(sum(tone(f, .9, d=.35) for f in (523.3, 659.3, 784.0))), .12)
        elif e['type'] == 'final':
            add(buf, e['t'] + .05, verb(sum(tone(f, 2.6, d=1.1, h=((2, .15),)) for f in (261.6, 392.0, 523.3, 659.3)), .25), .1)
    buf = buf[:int(dur * SR)]
    fade = int(.25 * SR); buf[-fade:] *= np.linspace(1, 0, fade)
    buf = buf / max(1e-9, np.max(np.abs(buf))) * .89
    w = wave.open(dst, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((buf * 32767).astype(np.int16).tobytes()); w.close()

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
