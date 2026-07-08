import { mkdirSync, writeFileSync } from 'node:fs';
import { buildActivity } from './sections/activity';
import { buildHeader } from './sections/header';
import { buildLangs } from './sections/langs';
import { buildNeofetch } from './sections/neofetch';

const sections: Array<[string, () => Promise<string>]> = [
  ['header', buildHeader],
  ['neofetch', buildNeofetch],
  ['activity', buildActivity],
  ['langs', buildLangs],
];

mkdirSync('assets', { recursive: true });

let failed = 0;
for (const [name, build] of sections) {
  try {
    const svg = await build();
    writeFileSync(`assets/${name}.svg`, svg);
    console.log(`✓ assets/${name}.svg`);
  } catch (err) {
    failed++;
    console.error(`✗ ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

if (failed > 0) {
  console.error(`${failed} section(s) failed — keeping previous versions.`);
  process.exit(1);
}
