import { readFile, writeFile } from 'node:fs/promises';

const stylesPath = new URL('../src/web/styles.css', import.meta.url);
const generatedPath = new URL('../src/web/inlineStyles.generated.js', import.meta.url);
const css = await readFile(stylesPath, 'utf8');
const cssLines = css.replace(/\r\n/g, '\n').split('\n');
const source = [
  '// Generated from styles.css by scripts/generate-web-inline-styles.mjs.',
  'export const WEB_PLAYER_STYLES = [',
  ...cssLines.map((line) => `  ${JSON.stringify(line)},`),
  "].join('\\n');",
  '',
].join('\n');

await writeFile(generatedPath, source);
