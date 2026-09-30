// Turns camera photos into a clean multi-page PDF.

import { loadScript } from './extract.js';

const MAX_DIMENSION = 2200;

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image. Try JPEG or PNG.'));
    };
    img.src = url;
  });
}

/**
 * Downscales a photo and optionally boosts it for legibility (grayscale +
 * contrast stretch, like a document scanner). Returns a canvas.
 */
export async function preparePage(blob, { enhance = true } = {}) {
  const img = await loadImage(blob);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (enhance) enhanceCanvas(ctx, canvas.width, canvas.height);
  return canvas;
}

function enhanceCanvas(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    px[i] = g;
    hist[g | 0]++;
  }
  // Map the paper (most pixels are paper, so use the 60th percentile) to white
  // and the darkest ink to black. Text can be well under 1% of the pixels on a
  // sparse page, so the black point is capped rather than taken as a percentile
  // of the whole image.
  const total = w * h;
  const percentile = (p) => {
    let v = 0;
    for (let acc = hist[0]; v < 255 && acc < total * p; acc += hist[++v]);
    return v;
  };
  const hi = Math.max(percentile(0.6), 64);
  const lo = Math.min(percentile(0.005), Math.round(hi * 0.5));
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / range));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Combines page canvases into a single PDF. Returns a Uint8Array. */
export async function pagesToPdf(canvases) {
  await loadScript('jspdf/jspdf.umd.min.js');
  const { jsPDF } = window.jspdf;
  let pdf;
  for (const c of canvases) {
    // Letter width (612pt); keep the photo's aspect ratio.
    const w = 612;
    const h = Math.round((c.height / c.width) * w);
    const orientation = w > h ? 'l' : 'p';
    if (!pdf) pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation, compress: true });
    else pdf.addPage([w, h], orientation);
    pdf.addImage(c.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, w, h, undefined, 'FAST');
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}
