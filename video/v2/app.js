const videoUpload = document.getElementById("videoUpload");
const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctxOverlay = overlay.getContext("2d");

const modelStatus = document.getElementById("modelStatus");
const sampleRate = document.getElementById("sampleRate");
const personConfidence = document.getElementById("personConfidence");
const maxCrops = document.getElementById("maxCrops");
const keywordInput = document.getElementById("keywordInput");

const analyzeBtn = document.getElementById("analyzeBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const printBtn = document.getElementById("printBtn");

const statusEl = document.getElementById("status");
const framesScannedEl = document.getElementById("framesScanned");
const peopleDetectedEl = document.getElementById("peopleDetected");
const cropsCreatedEl = document.getElementById("cropsCreated");
const keywordHitsEl = document.getElementById("keywordHits");

const summaryNarrative = document.getElementById("summaryNarrative");
const summaryCards = document.getElementById("summaryCards");
const evidenceCards = document.getElementById("evidenceCards");

let model = null;
let ocrWorker = null;
let currentVideoName = "";
let detections = [];
let summary = {};
let totalPeople = 0;
let totalKeywordHits = 0;
let cropCount = 0;

const workCanvas = document.createElement("canvas");
const workCtx = workCanvas.getContext("2d");

const labelOptions = [
  "Unlabeled",
  "Ohio State",
  "Columbia",
  "NKU",
  "UC",
  "Miami",
  "Nike",
  "Adidas",
  "Jordan",
  "Champion",
  "Under Armour",
  "Puma",
  "New Balance",
  "Unknown"
];

async function init() {
  try {
    await tf.setBackend("webgl");
    await tf.ready();

    model = await cocoSsd.load();
    ocrWorker = await Tesseract.createWorker("eng");

    modelStatus.textContent = "AI + OCR ready";
    modelStatus.classList.add("ready");
    statusEl.textContent = "Ready. Upload your student video to begin.";

    analyzeBtn.disabled = !video.src;
  } catch (error) {
    console.error(error);
    modelStatus.textContent = "Load failed";
    statusEl.textContent = "AI/OCR failed to load. Check your internet connection and browser console.";
  }
}

videoUpload.addEventListener("change", () => {
  const file = videoUpload.files[0];
  if (!file) return;

  currentVideoName = file.name;
  resetAll();

  video.src = URL.createObjectURL(file);

  video.onloadedmetadata = () => {
    resizeOverlay();
    analyzeBtn.disabled = !model || !ocrWorker;
    statusEl.textContent = `Loaded "${file.name}" (${Math.round(video.duration)} seconds). Click Analyze Video.`;
  };
});

window.addEventListener("resize", resizeOverlay);
analyzeBtn.addEventListener("click", analyzeVideo);
downloadCsvBtn.addEventListener("click", downloadCsv);
downloadJsonBtn.addEventListener("click", downloadJson);
printBtn.addEventListener("click", () => window.print());

async function analyzeVideo() {
  if (!model || !ocrWorker || !video.duration) return;

  resetAnalysisOnly();

  analyzeBtn.disabled = true;
  downloadCsvBtn.disabled = true;
  downloadJsonBtn.disabled = true;
  printBtn.disabled = true;

  const interval = Number(sampleRate.value);
  const minScore = Number(personConfidence.value);
  const cropLimit = Number(maxCrops.value);
  const duration = video.duration;

  workCanvas.width = video.videoWidth;
  workCanvas.height = video.videoHeight;

  let frameCount = 0;

  for (let time = 0; time < duration; time += interval) {
    if (cropCount >= cropLimit) break;

    await seekVideo(time);
    workCtx.drawImage(video, 0, 0, workCanvas.width, workCanvas.height);

    const predictions = await model.detect(workCanvas);
    const people = predictions.filter(prediction => {
      return prediction.class === "person" && prediction.score >= minScore;
    });

    totalPeople += people.length;
    drawOverlay(people, workCanvas.width, workCanvas.height);

    for (const person of people) {
      if (cropCount >= cropLimit) break;
      await processPersonCrop(person, time);
    }

    frameCount++;
    updateStats(frameCount);

    statusEl.textContent = `Analyzing frame ${frameCount} at ${formatTime(time)}. Crops reviewed: ${cropCount}/${cropLimit}.`;
    await sleep(40);
  }

  renderDashboard();

  statusEl.textContent = `Analysis complete. Reviewed ${cropCount} clothing regions and found ${totalKeywordHits} keyword hit(s).`;
  analyzeBtn.disabled = false;
  downloadCsvBtn.disabled = detections.length === 0;
  downloadJsonBtn.disabled = detections.length === 0;
  printBtn.disabled = detections.length === 0;
}

async function processPersonCrop(person, time) {
  const [x, y, w, h] = person.bbox;

  // Approximate chest/sweatshirt region.
  const cropX = clamp(x + w * 0.06, 0, workCanvas.width);
  const cropY = clamp(y + h * 0.20, 0, workCanvas.height);
  const cropW = clamp(w * 0.88, 1, workCanvas.width - cropX);
  const cropH = clamp(h * 0.48, 1, workCanvas.height - cropY);

  if (cropW < 45 || cropH < 45) return;

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.round(cropW);
  cropCanvas.height = Math.round(cropH);

  const cropCtx = cropCanvas.getContext("2d");
  cropCtx.drawImage(workCanvas, cropX, cropY, cropW, cropH, 0, 0, cropCanvas.width, cropCanvas.height);

  cropCount++;

  const imageData = cropCanvas.toDataURL("image/jpeg", 0.82);
  const ocrText = await readText(cropCanvas);
  const keywordHits = findKeywordHits(ocrText);
  const bestLabel = inferLabel(keywordHits, ocrText);

  if (keywordHits.length > 0) totalKeywordHits++;

  const row = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    videoName: currentVideoName,
    timestamp: formatTime(time),
    seconds: Number(time.toFixed(2)),
    personConfidence: Math.round(person.score * 100),
    ocrText,
    keywordHits,
    predictedLabel: bestLabel,
    manualLabel: bestLabel === "Needs review" ? "Unlabeled" : bestLabel,
    note: "",
    imageData
  };

  detections.push(row);
  addToSummary(row);
  renderEvidenceCard(row, detections.length);
}

async function readText(canvas) {
  try {
    const result = await ocrWorker.recognize(canvas);
    return cleanOcrText(result.data.text);
  } catch (error) {
    console.error("OCR error", error);
    return "";
  }
}

function cleanOcrText(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .replace(/[|]/g, "I")
    .trim();
}

function findKeywordHits(text) {
  const normalizedText = normalize(text);
  if (!normalizedText) return [];

  const keywords = keywordInput.value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  return keywords.filter(keyword => {
    const normalizedKeyword = normalize(keyword);
    return normalizedText.includes(normalizedKeyword);
  });
}

function inferLabel(keywordHits, ocrText) {
  const merged = normalize([ocrText, ...keywordHits].join(" "));

  if (merged.includes("ohio state") || merged.includes("buckeyes") || merged.includes(" osu ")) return "Ohio State";
  if (merged.includes("columbia")) return "Columbia";
  if (merged.includes("northern kentucky") || merged.includes(" nku ")) return "NKU";
  if (merged.includes("cincinnati") || merged.includes(" uc ")) return "UC";
  if (merged.includes("miami")) return "Miami";
  if (merged.includes("nike")) return "Nike";
  if (merged.includes("adidas")) return "Adidas";
  if (merged.includes("jordan")) return "Jordan";
  if (merged.includes("champion")) return "Champion";
  if (merged.includes("under armour")) return "Under Armour";
  if (merged.includes("puma")) return "Puma";
  if (merged.includes("new balance")) return "New Balance";

  return "Needs review";
}

function addToSummary(row) {
  const label = row.predictedLabel;

  if (!summary[label]) {
    summary[label] = {
      label,
      count: 0,
      firstSeen: row.timestamp,
      lastSeen: row.timestamp,
      confidenceValues: [],
      ocrTexts: new Set(),
      evidence: []
    };
  }

  summary[label].count++;
  summary[label].lastSeen = row.timestamp;
  summary[label].confidenceValues.push(row.personConfidence);

  if (row.ocrText) summary[label].ocrTexts.add(row.ocrText);

  if (summary[label].evidence.length < 4) {
    summary[label].evidence.push(row.imageData);
  }
}

function renderDashboard() {
  const entries = Object.values(summary)
    .sort((a, b) => {
      if (a.label === "Needs review") return 1;
      if (b.label === "Needs review") return -1;
      return b.count - a.count;
    });

  if (!entries.length) {
    summaryNarrative.textContent = "No clothing regions were captured. Try lowering person confidence or sampling more frames.";
    summaryCards.innerHTML = "";
    return;
  }

  const recognized = entries.filter(item => item.label !== "Needs review");
  const needsReview = summary["Needs review"]?.count || 0;

  if (recognized.length) {
    const top = recognized
      .slice(0, 4)
      .map(item => `<strong>${escapeHtml(item.label)}</strong> (${item.count})`)
      .join(", ");

    summaryNarrative.innerHTML = `
      The video appears to include apparel text/branding for ${top}.
      ${needsReview ? `${needsReview} clothing region(s) still need manual review.` : "No additional review-only regions were flagged."}
    `;
  } else {
    summaryNarrative.innerHTML = `
      No clear keyword matches were found. ${needsReview} clothing region(s) were captured for manual review.
      Try adding more keywords or sampling more frames.
    `;
  }

  summaryCards.innerHTML = entries.map(item => {
    const avg = Math.round(item.confidenceValues.reduce((a, b) => a + b, 0) / item.confidenceValues.length);
    const ocrPreview = [...item.ocrTexts].slice(0, 2).join(" | ") || "No readable text";

    return `
      <article class="summary-card">
        <h3>${escapeHtml(item.label)}</h3>
        <div class="big">${item.count}</div>
        <p>
          First seen: ${item.firstSeen}<br>
          Last seen: ${item.lastSeen}<br>
          Avg. person confidence: ${avg}%<br>
          OCR preview: ${escapeHtml(ocrPreview)}
        </p>
      </article>
    `;
  }).join("");
}

function renderEvidenceCard(row, number) {
  const card = document.createElement("article");
  card.className = "evidence-card";
  card.dataset.id = row.id;

  const hitText = row.keywordHits.length
    ? `<span class="hit">${row.keywordHits.map(escapeHtml).join(", ")}</span>`
    : `<span class="low">None</span>`;

  const options = labelOptions.map(label => {
    const selected = label === row.manualLabel ? "selected" : "";
    return `<option value="${escapeHtml(label)}" ${selected}>${escapeHtml(label)}</option>`;
  }).join("");

  card.innerHTML = `
    <img src="${row.imageData}" alt="Clothing evidence crop ${number}" />
    <div class="evidence-body">
      <div class="evidence-top">
        <strong>Evidence ${number}</strong>
        <span class="pill dark">${row.timestamp}</span>
      </div>

      <p class="evidence-meta">
        <strong>Predicted:</strong> ${escapeHtml(row.predictedLabel)}<br>
        <strong>OCR hits:</strong> ${hitText}<br>
        <strong>OCR text:</strong> ${escapeHtml(row.ocrText || "No readable text")}<br>
        <strong>Person confidence:</strong> ${row.personConfidence}%
      </p>

      <label class="manual-label">
        Manual label
        <select data-action="label">${options}</select>
      </label>

      <label class="manual-label">
        Notes
        <input data-action="note" type="text" placeholder="Example: red Ohio State sweatshirt..." />
      </label>
    </div>
  `;

  const labelSelect = card.querySelector('[data-action="label"]');
  const noteInput = card.querySelector('[data-action="note"]');

  labelSelect.addEventListener("change", event => {
    row.manualLabel = event.target.value;
  });

  noteInput.addEventListener("input", event => {
    row.note = event.target.value;
  });

  evidenceCards.appendChild(card);
}

function drawOverlay(people, sourceW, sourceH) {
  resizeOverlay();
  ctxOverlay.clearRect(0, 0, overlay.width, overlay.height);

  const scaleX = overlay.width / sourceW;
  const scaleY = overlay.height / sourceH;

  people.forEach(person => {
    const [x, y, w, h] = person.bbox;

    ctxOverlay.lineWidth = 3;
    ctxOverlay.strokeStyle = "#facc15";
    ctxOverlay.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);

    const label = `student/person ${Math.round(person.score * 100)}%`;
    ctxOverlay.font = "14px Arial";
    const labelWidth = ctxOverlay.measureText(label).width + 16;

    ctxOverlay.fillStyle = "rgba(0,0,0,.76)";
    ctxOverlay.fillRect(x * scaleX, y * scaleY - 30, labelWidth, 26);

    ctxOverlay.fillStyle = "#ffffff";
    ctxOverlay.fillText(label, x * scaleX + 8, y * scaleY - 12);
  });
}

function updateStats(frameCount) {
  framesScannedEl.textContent = frameCount;
  peopleDetectedEl.textContent = totalPeople;
  cropsCreatedEl.textContent = cropCount;
  keywordHitsEl.textContent = totalKeywordHits;
}

function downloadCsv() {
  const header = [
    "videoName",
    "timestamp",
    "seconds",
    "predictedLabel",
    "manualLabel",
    "ocrText",
    "keywordHits",
    "personConfidence",
    "note"
  ];

  const rows = detections.map(row => [
    row.videoName,
    row.timestamp,
    row.seconds,
    row.predictedLabel,
    row.manualLabel,
    row.ocrText,
    row.keywordHits.join("; "),
    `${row.personConfidence}%`,
    row.note
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  downloadBlob(csv, "logolens-dashboard-results.csv", "text/csv");
}

function downloadJson() {
  const safeDetections = detections.map(({ imageData, ...rest }) => rest);
  const safeSummary = Object.values(summary).map(item => ({
    label: item.label,
    count: item.count,
    firstSeen: item.firstSeen,
    lastSeen: item.lastSeen,
    averagePersonConfidence: Math.round(item.confidenceValues.reduce((a, b) => a + b, 0) / item.confidenceValues.length),
    ocrTexts: [...item.ocrTexts]
  }));

  const payload = {
    project: "LogoLens Dashboard",
    version: "GitHub Pages V3",
    generatedAt: new Date().toISOString(),
    videoName: currentVideoName,
    summary: safeSummary,
    detections: safeDetections
  };

  downloadBlob(JSON.stringify(payload, null, 2), "logolens-dashboard-results.json", "application/json");
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function resizeOverlay() {
  overlay.width = video.clientWidth || 1;
  overlay.height = video.clientHeight || 1;
}

function seekVideo(time) {
  return new Promise(resolve => {
    video.currentTime = Math.min(time, video.duration || time);
    video.onseeked = () => resolve();
  });
}

function resetAll() {
  resetAnalysisOnly();
  ctxOverlay.clearRect(0, 0, overlay.width, overlay.height);
  summaryNarrative.textContent = "Results will appear here after analysis.";
}

function resetAnalysisOnly() {
  detections = [];
  summary = {};
  totalPeople = 0;
  totalKeywordHits = 0;
  cropCount = 0;

  evidenceCards.innerHTML = "";
  summaryCards.innerHTML = "";
  summaryNarrative.textContent = "Analysis in progress...";

  updateStats(0);

  downloadCsvBtn.disabled = true;
  downloadJsonBtn.disabled = true;
  printBtn.disabled = true;
}

function normalize(value) {
  return ` ${String(value).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()} `;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
