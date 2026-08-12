/** Small seeded PRNG (mulberry32) whose state can be read/written for save/load. */
export class Rng {
  a: number;

  constructor(seed: number) {
    this.a = seed | 0;
  }

  next(): number {
    this.a |= 0;
    this.a = (this.a + 0x6d2b79f5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
