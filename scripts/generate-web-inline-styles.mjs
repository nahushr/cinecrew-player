import { readFile, writeFile } from 'node:fs/promises';

const styleModules = [
  { key: 'CORE_STYLES', file: 'core.css' },
  { key: 'CONTROLS_STYLES', file: 'controls.css' },
  { key: 'BRIGHTNESS_STYLES', file: 'brightness.css' },
  { key: 'AUDIO_CARD_STYLES', file: 'audio-card.css' },
  { key: 'RECORDING_STYLES', file: 'recording.css' },
  { key: 'PANEL_STYLES', file: 'panels.css' },
  { key: 'DIAGNOSTICS_STYLES', file: 'diagnostics.css' },
  { key: 'EMOJI_PICKER_STYLES', file: 'emoji-picker.css' },
  { key: 'RESPONSIVE_STYLES', file: 'responsive.css' },
];

const moduleContents = await Promise.all(
  styleModules.map(async ({ key, file }) => {
    const filePath = new URL(`../src/styles/${file}`, import.meta.url);
    const content = (await readFile(filePath, 'utf8')).replace(/\r\n/g, '\n').trim();
    return { key, file, content };
  })
);

const fullCss = moduleContents.map((m) => m.content).join('\n\n') + '\n';

// Write combined styles.css in src/styles/ and src/web/
await writeFile(new URL('../src/styles/styles.css', import.meta.url), fullCss);
await writeFile(new URL('../src/web/styles.css', import.meta.url), fullCss);

// Generate inlineStyles.generated.js with modular and combined exports
const generatedPath = new URL('../src/web/inlineStyles.generated.js', import.meta.url);

const exportBlocks = moduleContents.map(({ key, content }) => {
  const lines = content.split('\n');
  return [
    `export const ${key} = [`,
    ...lines.map((line) => `  ${JSON.stringify(line)},`),
    "].join('\\n');",
  ].join('\n');
});

const fullLines = fullCss.split('\n');
const combinedBlock = [
  'export const WEB_PLAYER_STYLES = [',
  ...fullLines.map((line) => `  ${JSON.stringify(line)},`),
  "].join('\\n');",
].join('\n');

const generatedSource = [
  '// Generated from src/styles/*.css by scripts/generate-web-inline-styles.mjs.',
  ...exportBlocks,
  '',
  combinedBlock,
  '',
].join('\n\n');

await writeFile(generatedPath, generatedSource);
