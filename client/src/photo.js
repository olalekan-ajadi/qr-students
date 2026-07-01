// Client-side passport photo validation.
// Enforces that an upload actually looks like a passport photograph: a JPEG/PNG
// of adequate resolution, in a portrait or square frame (not a landscape
// snapshot or a wide screenshot), and carrying real visual detail (not a blank
// or solid-colour image). Admins still review every photo at approval.

const MIN_DIM   = 300;             // px on the shortest side
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MIN_BYTES = 3 * 1024;        // 3 KB
const MIN_RATIO = 0.62;            // width / height — portrait limit
const MAX_RATIO = 1.05;            // ~square; anything wider is landscape

export async function processPhoto(file) {
  if (!file) throw new Error("Please choose a photo");

  if (!/^image\/(jpeg|jpg|png)$/.test(file.type))
    throw new Error("Photo must be a JPEG or PNG image");

  if (file.size > MAX_BYTES) throw new Error("Photo must be 2 MB or smaller");
  if (file.size < MIN_BYTES)
    throw new Error("Photo file is too small — please use a proper photograph");

  const dataUrl = await readDataUrl(file);
  const img = await loadImage(dataUrl);

  if (img.width < MIN_DIM || img.height < MIN_DIM)
    throw new Error(`Photo resolution is too low — use at least ${MIN_DIM} × ${MIN_DIM} pixels`);

  const ratio = img.width / img.height;
  if (ratio > MAX_RATIO)
    throw new Error("This looks like a landscape image. Use a portrait or square passport photo (head and shoulders).");
  if (ratio < MIN_RATIO)
    throw new Error("This photo is too narrow. Use a standard portrait or square passport photo.");

  if (isNearlyBlank(img))
    throw new Error("This image looks blank or has too little detail. Upload a clear passport photograph.");

  return { dataUrl, meta: { width: img.width, height: img.height } };
}

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("Could not read the file"));
    fr.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload  = () => resolve(i);
    i.onerror = () => reject(new Error("Invalid or corrupted image file"));
    i.src = src;
  });
}

// Reject near-uniform images (blank pages, solid colours, plain gradients) by
// measuring how much the brightness varies across a small downscaled copy.
// A real photograph has a high spread; a flat image is close to zero.
function isNearlyBlank(img) {
  try {
    const N = 32;
    const c = document.createElement("canvas");
    c.width = N; c.height = N;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, N, N);
    const { data } = ctx.getImageData(0, 0, N, N);
    let sum = 0, sum2 = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += l; sum2 += l * l; n++;
    }
    const mean = sum / n;
    const stddev = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    return stddev < 8;
  } catch {
    return false; // if the canvas is unavailable, don't reject a valid photo
  }
}
