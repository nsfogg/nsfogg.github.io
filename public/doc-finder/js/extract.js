// Text extraction so documents are searchable by their contents.
// Runs fully in the browser: PDF text via pdf.js, images and scanned PDFs via
// Tesseract OCR. All libraries and OCR data are self-hosted under vendor/.

const VENDOR = new URL('../vendor/', import.meta.url);
const vendorUrl = (p) => new URL(p, VENDOR).href;

const MAX_OCR_PDF_PAGES = 20;
const MIN_TEXT_CHARS_PER_PAGE = 25;

const scripts = new Map();
export function loadScript(path) {
  if (!scripts.has(path)) {
    scripts.set(path, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = vendorUrl(path);
      s.onload = resolve;
      s.onerror = () => {
        scripts.delete(path);
        reject(new Error(`Failed to load ${path}`));
      };
      document.head.appendChild(s);
    }));
  }
  return scripts.get(path);
}

let pdfjsReady;
export function loadPdfJs() {
  pdfjsReady ??= loadScript('pdfjs/pdf.min.js').then(() => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = vendorUrl('pdfjs/pdf.worker.min.js');
    return window.pdfjsLib;
  });
  return pdfjsReady;
}

let ocrWorker;
let ocrProgress = () => {};
async function getOcrWorker() {
  if (!ocrWorker) {
    ocrWorker = (async () => {
      await loadScript('tesseract/tesseract.min.js');
      return window.Tesseract.createWorker('eng', 1, {
        workerPath: vendorUrl('tesseract/worker.min.js'),
        workerBlobURL: false,
        corePath: vendorUrl('tesseract/core/'),
        langPath: vendorUrl('tesseract/lang'),
        logger: (m) => ocrProgress(m),
      });
    })();
    ocrWorker.catch(() => { ocrWorker = null; });
  }
  return ocrWorker;
}

async function ocr(image, onProgress) {
  const worker = await getOcrWorker();
  ocrProgress = (m) => {
    if (m.status === 'recognizing text') onProgress?.(m.progress);
  };
  try {
    const { data } = await worker.recognize(image);
    return data.text || '';
  } finally {
    ocrProgress = () => {};
  }
}

async function renderPdfPage(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

async function extractPdf(bytes, onStatus) {
  const pdfjs = await loadPdfJs();
  // pdf.js may transfer (detach) the buffer it is given, so hand it a copy.
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  try {
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      onStatus?.(`Reading page ${i} of ${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join(''));
    }
    const text = pages.join('\n').trim();
    if (text.replace(/\s/g, '').length >= MIN_TEXT_CHARS_PER_PAGE * pdf.numPages) {
      return { text, source: 'pdf' };
    }
    // Little or no embedded text: it's a scan. OCR the pages.
    const n = Math.min(pdf.numPages, MAX_OCR_PDF_PAGES);
    const ocrPages = [];
    for (let i = 1; i <= n; i++) {
      const canvas = await renderPdfPage(await pdf.getPage(i), 2);
      ocrPages.push(await ocr(canvas, (p) => onStatus?.(`OCR page ${i} of ${n}: ${Math.round(p * 100)}%`)));
    }
    return { text: [text, ...ocrPages].join('\n').trim(), source: 'ocr' };
  } finally {
    pdf.destroy();
  }
}

/** Extracts searchable text. Returns { text, source } where source is pdf | ocr | text | none. */
export async function extractText(bytes, mime, fileName, onStatus) {
  const name = (fileName || '').toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return extractPdf(bytes, onStatus);
  if (mime.startsWith('image/')) {
    const blob = new Blob([bytes], { type: mime });
    const text = await ocr(blob, (p) => onStatus?.(`OCR: ${Math.round(p * 100)}%`));
    return { text: text.trim(), source: 'ocr' };
  }
  if (mime.startsWith('text/') || /\.(txt|md|csv|json|eml)$/.test(name)) {
    return { text: new TextDecoder().decode(bytes).slice(0, 500_000), source: 'text' };
  }
  return { text: '', source: 'none' };
}

/** OCR for already-rendered page images (used by the scanner). */
export function ocrImages(images, onStatus) {
  return images.reduce(async (acc, img, i) => {
    const prev = await acc;
    const t = await ocr(img, (p) => onStatus?.(`OCR page ${i + 1} of ${images.length}: ${Math.round(p * 100)}%`));
    return prev ? `${prev}\n${t}` : t;
  }, Promise.resolve(''));
}

