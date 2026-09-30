const loadedFonts = new Set();

function resolveFontSource(source) {
  if (typeof source === 'string') return source;
  if (source && typeof source.uri === 'string') return source.uri;
  if (source && typeof source.default === 'string') return source.default;
  return null;
}

export function isLoaded(fontFamily) {
  return loadedFonts.has(fontFamily);
}

export async function loadAsync(fontMap) {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') {
    throw new Error('Electron icon fonts require the browser FontFace API.');
  }

  await Promise.all(Object.entries(fontMap || {}).map(async ([fontFamily, source]) => {
    if (loadedFonts.has(fontFamily)) return;

    const fontUrl = resolveFontSource(source);
    if (!fontUrl) throw new Error(`No font asset was provided for "${fontFamily}".`);

    const fontFace = new FontFace(fontFamily, `url("${fontUrl}")`);
    await fontFace.load();
    document.fonts.add(fontFace);
    loadedFonts.add(fontFamily);
  }));
}
