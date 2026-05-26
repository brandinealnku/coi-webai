const videoUpload = document.getElementById("videoUpload");
const sourceVideo = document.getElementById("sourceVideo");
const outputCanvas = document.getElementById("outputCanvas");
const outputCtx = outputCanvas.getContext("2d");

const modelStatus = document.getElementById("modelStatus");
const confidenceSelect = document.getElementById("confidence");
const detectEverySelect = document.getElementById("detectEvery");

const previewBtn = document.getElementById("previewBtn");
const exportBtn = document.getElementById("exportBtn");
const pauseBtn = document.getElementById("pauseBtn");
const snapshotBtn = document.getElementById("snapshotBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadSummaryBtn = document.getElementById("downloadSummaryBtn");

const blurStrength = document.getElementById("blurStrength");
const torsoTop = document.getElementById("torsoTop");
const torsoHeight = document.getElementById("torsoHeight");
const torsoWidth = document.getElementById("torsoWidth");

const blurStrengthValue = document.getElementById("blurStrengthValue");
const torsoTopValue = document.getElementById("torsoTopValue");
const torsoHeightValue = document.getElementById("torsoHeightValue");
const torsoWidthValue = document.getElementById("torsoWidthValue");

const statusEl = document.getElementById("status");
const framesProcessedEl = document.getElementById("framesProcessed");
const peopleDetectedEl = document.getElementById("peopleDetected");
const blurRegionsEl = document.getElementById("blurRegions");
const lastTimestampEl = document.getElementById("lastTimestamp");
const snapshotsEl = document.getElementById("snapshots");

let model = null;
let videoFileName = "";
let isProcessing = false;
let isExporting = false;
let animationId = null;
let frameCounter = 0;
let lastDetections = [];
let stats = [];
let mediaRecorder = null;
let recordedChunks = [];

const tempCanvas = document.createElement("canvas");
const tempCtx = tempCanvas.getContext("2d");

const pixelCanvas = document.createElement("canvas");
const pixelCtx = pixelCanvas.getContext("2d");

async function init() {
  try {
    await tf.setBackend("webgl");
    await tf.ready();

    model = await cocoSsd.load();

    modelStatus.textContent = "TensorFlow ready";
    modelStatus.classList.add("ready");
    statusEl.textContent = "Ready. Upload a video and preview the blur.";

    previewBtn.disabled = !sourceVideo.src;
  } catch (error) {
    console.error(error);
    modelStatus.textContent = "Load failed";
    statusEl.textContent = "TensorFlow failed to load. Check internet/browser console.";
  }
}

videoUpload.addEventListener("change", () => {
  const file = videoUpload.files[0];
  if (!file) return;

  videoFileName = file.name;
  const url = URL.createObjectURL(file);

  resetStats();
  sourceVideo.src = url;
  sourceVideo.muted = true;

  sourceVideo.onloadedmetadata = () => {
    outputCanvas.width = sourceVideo.videoWidth;
    outputCanvas.height = sourceVideo.videoHeight;

    previewBtn.disabled = !model;
    exportBtn.disabled = !model;
    snapshotBtn.disabled = false;
    pauseBtn.disabled = false;
    downloadSummaryBtn.disabled = false;

    drawCurrentFrame();
    statusEl.textContent = `Loaded "${file.name}". Preview blur, adjust sliders, then export.`;
  };
});

previewBtn.addEventListener("click", async () => {
  if (!model || !sourceVideo.src) return;

  if (isProcessing) {
    stopProcessing();
    previewBtn.textContent = "Preview Blur";
    return;
  }

  resetStats();
  isProcessing = true;
  previewBtn.textContent = "Stop Preview";
  statusEl.textContent = "Preview running. Adjust sliders until clothing text is covered.";

  sourceVideo.currentTime = 0;
  await sourceVideo.play();
  processLoop();
});

pauseBtn.addEventListener("click", () => {
  if (sourceVideo.paused) {
    sourceVideo.play();
    pauseBtn.textContent = "Pause Preview";
  } else {
    sourceVideo.pause();
    pauseBtn.textContent = "Resume Preview";
  }
});

exportBtn.addEventListener("click", async () => {
  if (!model || !sourceVideo.src) return;
  await exportBlurredVideo();
});

snapshotBtn.addEventListener("click", () => {
  saveSnapshot();
});

clearBtn.addEventListener("click", () => {
  stopProcessing();
  resetStats();
  sourceVideo.pause();
  sourceVideo.currentTime = 0;
  drawCurrentFrame();
  statusEl.textContent = "Cleared review stats. Ready to preview again.";
});

downloadSummaryBtn.addEventListener("click", downloadSummaryCsv);

[blurStrength, torsoTop, torsoHeight, torsoWidth].forEach(input => {
  input.addEventListener("input", updateSliderLabels);
});

function updateSliderLabels() {
  blurStrengthValue.textContent = blurStrength.value;
  torsoTopValue.textContent = `${torsoTop.value}%`;
  torsoHeightValue.textContent = `${torsoHeight.value}%`;
  torsoWidthValue.textContent = `${torsoWidth.value}%`;
}
updateSliderLabels();

async function processLoop() {
  if (!isProcessing || sourceVideo.paused || sourceVideo.ended) {
    if (sourceVideo.ended) {
      stopProcessing();
      previewBtn.textContent = "Preview Blur";
      statusEl.textContent = "Preview complete.";
    }
    return;
  }

  await processFrame();

  animationId = requestAnimationFrame(processLoop);
}

async function processFrame() {
  if (!sourceVideo.videoWidth || !sourceVideo.videoHeight) return;

  frameCounter++;

  outputCanvas.width = sourceVideo.videoWidth;
  outputCanvas.height = sourceVideo.videoHeight;

  outputCtx.drawImage(sourceVideo, 0, 0, outputCanvas.width, outputCanvas.height);

  const detectEvery = Number(detectEverySelect.value);
  const minConfidence = Number(confidenceSelect.value);

  if (frameCounter % detectEvery === 0 || lastDetections.length === 0) {
    const predictions = await model.detect(outputCanvas);
    lastDetections = predictions.filter(prediction => {
      return prediction.class === "person" && prediction.score >= minConfidence;
    });
  }

  let blurCount = 0;

  lastDetections.forEach(person => {
    const region = getTorsoRegion(person.bbox, outputCanvas.width, outputCanvas.height);
    applyBlurRegion(region);
    drawRegionOutline(region);
    blurCount++;
  });

  const row = {
    timestamp: formatTime(sourceVideo.currentTime),
    seconds: Number(sourceVideo.currentTime.toFixed(2)),
    peopleDetected: lastDetections.length,
    blurRegionsApplied: blurCount
  };

  stats.push(row);
  updateStats(row);
}

function getTorsoRegion(bbox, canvasWidth, canvasHeight) {
  const [x, y, w, h] = bbox;

  const topPct = Number(torsoTop.value) / 100;
  const heightPct = Number(torsoHeight.value) / 100;
  const widthPct = Number(torsoWidth.value) / 100;

  const regionW = w * widthPct;
  const regionH = h * heightPct;
  const regionX = x + (w - regionW) / 2;
  const regionY = y + h * topPct;

  return {
    x: clamp(regionX, 0, canvasWidth),
    y: clamp(regionY, 0, canvasHeight),
    w: clamp(regionW, 1, canvasWidth - regionX),
    h: clamp(regionH, 1, canvasHeight - regionY)
  };
}

function applyBlurRegion(region) {
  const blur = Number(blurStrength.value);

  tempCanvas.width = Math.max(1, Math.round(region.w));
  tempCanvas.height = Math.max(1, Math.round(region.h));

  tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.drawImage(
    outputCanvas,
    region.x, region.y, region.w, region.h,
    0, 0, tempCanvas.width, tempCanvas.height
  );

  // Pixelation pass. More reliable in browsers than relying on canvas filter alone.
  const pixelSize = Math.max(4, Math.round(blur / 1.4));
  pixelCanvas.width = Math.max(1, Math.round(tempCanvas.width / pixelSize));
  pixelCanvas.height = Math.max(1, Math.round(tempCanvas.height / pixelSize));

  pixelCtx.imageSmoothingEnabled = false;
  pixelCtx.clearRect(0, 0, pixelCanvas.width, pixelCanvas.height);
  pixelCtx.drawImage(tempCanvas, 0, 0, pixelCanvas.width, pixelCanvas.height);

  outputCtx.save();
  outputCtx.imageSmoothingEnabled = false;
  outputCtx.drawImage(pixelCanvas, region.x, region.y, region.w, region.h);

  // Soft blur overlay.
  outputCtx.filter = `blur(${Math.round(blur / 3)}px)`;
  outputCtx.drawImage(tempCanvas, region.x, region.y, region.w, region.h);
  outputCtx.filter = "none";
  outputCtx.restore();
}

function drawRegionOutline(region) {
  outputCtx.save();
  outputCtx.lineWidth = Math.max(3, outputCanvas.width / 360);
  outputCtx.strokeStyle = "rgba(250, 204, 21, 0.9)";
  outputCtx.strokeRect(region.x, region.y, region.w, region.h);

  outputCtx.fillStyle = "rgba(0,0,0,.72)";
  outputCtx.fillRect(region.x, region.y - 28, 158, 24);
  outputCtx.fillStyle = "#ffffff";
  outputCtx.font = "16px Arial";
  outputCtx.fillText("clothing blur zone", region.x + 8, region.y - 10);
  outputCtx.restore();
}

async function exportBlurredVideo() {
  isExporting = true;
  stopProcessing();
  resetStats();

  recordedChunks = [];

  const stream = outputCanvas.captureStream(30);
  mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });

  mediaRecorder.ondataavailable = event => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = makeExportFileName();
    a.click();

    URL.revokeObjectURL(url);
    isExporting = false;
    statusEl.textContent = "Export complete. Your browser downloaded a blurred WEBM video.";
  };

  mediaRecorder.start();

  sourceVideo.currentTime = 0;
  await sourceVideo.play();

  statusEl.textContent = "Exporting blurred video. Keep this tab open until download begins.";

  while (!sourceVideo.ended) {
    await processFrame();
    await waitForNextVideoFrame();
  }

  sourceVideo.pause();
  mediaRecorder.stop();
}

function waitForNextVideoFrame() {
  return new Promise(resolve => {
    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      sourceVideo.requestVideoFrameCallback(() => resolve());
    } else {
      setTimeout(resolve, 33);
    }
  });
}

function getSupportedMimeType() {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];

  return types.find(type => MediaRecorder.isTypeSupported(type)) || "video/webm";
}

function makeExportFileName() {
  const baseName = videoFileName
    ? videoFileName.replace(/\.[^/.]+$/, "")
    : "blurred-video";

  return `${baseName}-safe-promo-blur.webm`;
}

function saveSnapshot() {
  if (!outputCanvas.width || !outputCanvas.height) return;

  const timestamp = formatTime(sourceVideo.currentTime);
  const imageData = outputCanvas.toDataURL("image/jpeg", 0.85);

  const card = document.createElement("article");
  card.className = "snapshot-card";
  card.innerHTML = `
    <img src="${imageData}" alt="Blur review snapshot at ${timestamp}" />
    <div>Review snapshot · ${timestamp}</div>
  `;

  snapshotsEl.prepend(card);
}

function drawCurrentFrame() {
  if (!sourceVideo.videoWidth || !sourceVideo.videoHeight) return;

  outputCanvas.width = sourceVideo.videoWidth;
  outputCanvas.height = sourceVideo.videoHeight;
  outputCtx.drawImage(sourceVideo, 0, 0, outputCanvas.width, outputCanvas.height);
}

function stopProcessing() {
  isProcessing = false;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  previewBtn.textContent = "Preview Blur";
}

function updateStats(row) {
  framesProcessedEl.textContent = stats.length;
  peopleDetectedEl.textContent = stats.reduce((sum, item) => sum + item.peopleDetected, 0);
  blurRegionsEl.textContent = stats.reduce((sum, item) => sum + item.blurRegionsApplied, 0);
  lastTimestampEl.textContent = row.timestamp;
}

function resetStats() {
  frameCounter = 0;
  lastDetections = [];
  stats = [];
  framesProcessedEl.textContent = "0";
  peopleDetectedEl.textContent = "0";
  blurRegionsEl.textContent = "0";
  lastTimestampEl.textContent = "00:00";
}

function downloadSummaryCsv() {
  if (!stats.length) return;

  const header = ["timestamp", "seconds", "peopleDetected", "blurRegionsApplied"];
  const rows = stats.map(row => [
    row.timestamp,
    row.seconds,
    row.peopleDetected,
    row.blurRegionsApplied
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "logolens-safe-promo-blur-summary.csv";
  a.click();

  URL.revokeObjectURL(url);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

init();
