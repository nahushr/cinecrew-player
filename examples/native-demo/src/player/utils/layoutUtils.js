export function getFontSize(baseSize, windowWidth = 390, windowHeight = 0) {
  const width = Number(windowWidth) || 390;
  const height = Number(windowHeight) || width;
  const shortSide = Math.min(width, height);
  const scale = Math.max(0.85, Math.min(1.15, shortSide / 390));
  return Math.max(9, Math.round(Number(baseSize) * scale));
}

export function getFontWeight(baseWeight) {
  const weights = { normal: 400, bold: 700 };
  return String(weights[baseWeight] || Number(baseWeight) || 400);
}
