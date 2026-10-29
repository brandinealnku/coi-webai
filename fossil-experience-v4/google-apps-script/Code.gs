const SHEET_NAME = 'Events';
const TRAINING_SHEET = 'Training';

const HEADERS = [
  'Received At','Event Name','Session ID','Event Type','Event At','Elapsed ms',
  'Scan Attempt','Confidence','Fossil Probability','Other Probability','Background Probability',
  'Scan Time ms','Observe Choice','Noticed New','Next Action','Manual Bypass',
  'Total Time ms','Screen','User Agent',
  'Study Code','Observer Help','Looked Back','Attention','Companion Talk','Outcome','Observer Notes',
  'Recognized Specimen','Probabilities JSON',
  'Mode','Selected Object','Observed Session ID',
  'Design Variant','Release','Journey ID','Recognition Method'
];

const TRAINING_HEADERS = [
  'Received At','Batch ID','Label','Embedding JSON','User Agent'
];

const TRAINING_LABELS = ['fossil1','fossil2','fossil3','other','background'];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');

    if (payload.kind === 'training-example') {
      return saveTrainingExample_(payload);
    }

    const event = payload.event || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

    ensureHeaders_(sheet);

    const probs = event.probabilities || {};
    const sessionId = String(payload.sessionId || '');
    const studyCode = String(event.studyCode || sessionId.slice(0, 6)).trim().toUpperCase();
    const observeChoice = event.observe ?? (event.type === 'observe-choice' ? event.value : '');
    const noticedNew = event.noticedNew ?? (event.type === 'noticed-new' ? event.value : '');
    const nextAction = event.next ?? (event.type === 'next-action' ? event.value : '');
    const recognizedSpecimen = event.recognizedSpecimen || '';
    const mode = String(event.mode || 'live').toLowerCase() === 'test' ? 'test' : 'live';
    const selectedObject = event.selectedObject || '';
    const observedSessionId = event.observedSessionId || '';
    const design = event.design || '';
    const release = event.release || '';
    const journeyId = event.journeyId || '';
    const recognitionMethod = event.recognitionMethod || '';

    sheet.appendRow([
      new Date(), payload.eventName || '', sessionId, event.type || '', event.at || '',
      event.elapsedMs ?? '', event.attempt ?? '', event.confidence ?? '',
      probs.fossil ?? '', probs.other ?? '', probs.background ?? '',
      event.scanTimeMs ?? '', observeChoice, noticedNew, nextAction,
      event.manualBypass ?? '', event.totalMs ?? '', event.screen ?? '',
      payload.userAgent || '', studyCode,
      event.observerHelp ?? '', event.lookedBack ?? '', event.attention ?? '',
      event.companionTalk ?? '', event.outcome ?? '', event.observerNotes ?? '',
      recognizedSpecimen, Object.keys(probs).length ? JSON.stringify(probs) : '',
      mode, selectedObject, observedSessionId,
      design, release, journeyId, recognitionMethod
    ]);

    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}

function doGet(e) {
  try {
    const action = String(e.parameter.action || '');

    if (action === 'active') {
      return getActiveSessions_(e);
    }

    if (action !== 'training') {
      return ContentService.createTextOutput('ok');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(TRAINING_SHEET);
    const out = {
      version: 4.3,
      classes: {fossil1: [], fossil2: [], fossil3: [], other: [], background: []}
    };

    if (sheet && sheet.getLastRow() > 1) {
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, TRAINING_HEADERS.length).getValues();
      rows.forEach(row => {
        const label = String(row[2] || '');
        if (!out.classes[label]) return;
        try {
          const embedding = JSON.parse(String(row[3] || '[]'));
          if (Array.isArray(embedding) && embedding.length) out.classes[label].push(embedding);
        } catch (_) {}
      });
    }

    return jsonOrJsonp_(out, e);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getActiveSessions_(e) {
  const requestedMode = String(e.parameter.mode || 'live').toLowerCase() === 'test' ? 'test' : 'live';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const sessions = {};

  if (sheet && sheet.getLastRow() > 1) {
    ensureHeaders_(sheet);
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();

    rows.forEach(row => {
      const eventType = String(row[3] || '');
      if (eventType === 'observer-note') return;

      const mode = String(row[28] || 'live').toLowerCase();
      if (mode !== requestedMode) return;

      const sessionId = String(row[2] || '');
      if (!sessionId) return;

      const receivedAt = row[0] instanceof Date ? row[0].getTime() : new Date(row[0]).getTime();
      if (!Number.isFinite(receivedAt) || now - receivedAt > windowMs) return;

      const s = sessions[sessionId] || {
        sessionId: sessionId,
        studyCode: String(row[19] || sessionId.slice(0, 6)).toUpperCase(),
        selectedObject: '',
        recognizedSpecimen: '',
        startedAt: '',
        lastAt: '',
        completed: false,
        mode: mode,
        design: String(row[31] || ''),
        release: String(row[32] || ''),
        journeyId: String(row[33] || ''),
        recognitionMethod: String(row[34] || '')
      };

      const eventAt = String(row[4] || '');
      if (!s.startedAt || eventType === 'page-open' || eventType === 'session-start') {
        s.startedAt = s.startedAt || eventAt || new Date(receivedAt).toISOString();
      }
      s.lastAt = eventAt || new Date(receivedAt).toISOString();

      if (row[29]) s.selectedObject = String(row[29]);
      if (row[26]) s.recognizedSpecimen = String(row[26]);
      if (row[31]) s.design = String(row[31]);
      if (row[32]) s.release = String(row[32]);
      if (row[33]) s.journeyId = String(row[33]);
      if (row[34]) s.recognitionMethod = String(row[34]);
      if (eventType === 'session-complete') s.completed = true;

      sessions[sessionId] = s;
    });
  }

  const out = Object.values(sessions)
    .filter(s => s.selectedObject)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, 12);

  return jsonOrJsonp_({mode: requestedMode, sessions: out}, e);
}

function jsonOrJsonp_(data, e) {
  const json = JSON.stringify(data);
  const callback = String((e && e.parameter && e.parameter.callback) || '');
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function saveTrainingExample_(payload) {
  const label = String(payload.label || '');
  if (!TRAINING_LABELS.includes(label)) {
    throw new Error('Invalid training label');
  }

  const embedding = payload.embedding;
  if (!Array.isArray(embedding) || !embedding.length) {
    throw new Error('Missing embedding');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TRAINING_SHEET);
  if (!sheet) sheet = ss.insertSheet(TRAINING_SHEET);
  ensureTrainingHeaders_(sheet);

  sheet.appendRow([
    new Date(),
    payload.batchId || '',
    label,
    JSON.stringify(embedding),
    payload.userAgent || ''
  ]);

  return ContentService.createTextOutput('ok');
}

function ensureHeaders_(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
}

function ensureTrainingHeaders_(sheet) {
  sheet.getRange(1, 1, 1, TRAINING_HEADERS.length).setValues([TRAINING_HEADERS]);
  sheet.setFrozenRows(1);
}

function setupWorkbook() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('America/New_York');

  let events = ss.getSheetByName(SHEET_NAME);
  if (!events) events = ss.insertSheet(SHEET_NAME);
  ensureHeaders_(events);

  let training = ss.getSheetByName(TRAINING_SHEET);
  if (!training) training = ss.insertSheet(TRAINING_SHEET);
  ensureTrainingHeaders_(training);

  let summary = ss.getSheetByName('Summary');
  if (!summary) summary = ss.insertSheet('Summary');
  summary.clear();

  summary.getRange('A1:B26').setValues([
    ['AI Day Metric','Value'],
    ['Unique LIVE visitor sessions','=COUNTA(UNIQUE(FILTER(Events!C2:C,Events!C2:C<>"",Events!D2:D<>"observer-note",Events!AC2:AC="live")))'],
    ['Completed LIVE sessions','=COUNTIFS(Events!D2:D,"session-complete",Events!AC2:AC,"live")'],
    ['Successful LIVE scans','=COUNTIFS(Events!D2:D,"scan-success",Events!AC2:AC,"live")'],
    ['Recognized Object 1','=COUNTIFS(Events!D2:D,"scan-success",Events!AA2:AA,"fossil1",Events!AC2:AC,"live")'],
    ['Recognized Object 2','=COUNTIFS(Events!D2:D,"scan-success",Events!AA2:AA,"fossil2",Events!AC2:AC,"live")'],
    ['Recognized Object 3','=COUNTIFS(Events!D2:D,"scan-success",Events!AA2:AA,"fossil3",Events!AC2:AC,"live")'],
    ['Selected = recognized','=SUMPRODUCT((Events!D2:D="scan-success")*(Events!AC2:AC="live")*(Events!AA2:AA=Events!AD2:AD))'],
    ['Noticed something new: Yes','=COUNTIFS(Events!D2:D,"noticed-new",Events!N2:N,"yes",Events!AC2:AC,"live")'],
    ['Noticed something new: Maybe','=COUNTIFS(Events!D2:D,"noticed-new",Events!N2:N,"maybe",Events!AC2:AC,"live")'],
    ['Noticed something new: No','=COUNTIFS(Events!D2:D,"noticed-new",Events!N2:N,"no",Events!AC2:AC,"live")'],
    ['Would continue to next stop: Yes','=COUNTIFS(Events!D2:D,"next-action",Events!O2:O,"yes",Events!AC2:AC,"live")'],
    ['Would continue to next stop: Maybe','=COUNTIFS(Events!D2:D,"next-action",Events!O2:O,"maybe",Events!AC2:AC,"live")'],
    ['Would continue to next stop: No','=COUNTIFS(Events!D2:D,"next-action",Events!O2:O,"no",Events!AC2:AC,"live")'],
    ['Manual scan bypasses','=COUNTIFS(Events!D2:D,"manual-bypass",Events!AC2:AC,"live")'],
    ['Observer: attention returned to object','=COUNTIFS(Events!D2:D,"observer-note",Events!V2:V,"yes",Events!AC2:AC,"live")'],
    ['Observer: needed help','=COUNTIFS(Events!D2:D,"observer-note",Events!U2:U,"yes",Events!AC2:AC,"live")'],
    ['Paired observer records','=COUNTIFS(Events!D2:D,"observer-note",Events!AE2:AE,"<>",Events!AC2:AC,"live")'],
    ['TEST sessions','=COUNTA(UNIQUE(FILTER(Events!C2:C,Events!C2:C<>"",Events!D2:D<>"observer-note",Events!AC2:AC="test")))'],
    ['TEST completed sessions','=COUNTIFS(Events!D2:D,"session-complete",Events!AC2:AC,"test")'],
    ['TEST observer records','=COUNTIFS(Events!D2:D,"observer-note",Events!AC2:AC,"test")'],
    ['NKU-theme sessions','=COUNTA(UNIQUE(FILTER(Events!C2:C,Events!AF2:AF="nku",Events!D2:D<>"observer-note")))'],
    ['Non-NKU theme sessions','=COUNTA(UNIQUE(FILTER(Events!C2:C,Events!AF2:AF<>"nku",Events!AF2:AF<>"",Events!D2:D<>"observer-note")))'],
    ['Model recognitions','=COUNTIFS(Events!D2:D,"scan-success",Events!AI2:AI,"model")'],
    ['Manual selections','=COUNTIF(Events!D2:D,"manual-selection")'],
    ['Last event','=MAX(Events!A2:A)']
  ]);

  summary.setFrozenRows(1);
  summary.autoResizeColumns(1, 2);
  events.autoResizeColumns(1, HEADERS.length);
  training.autoResizeColumns(1, TRAINING_HEADERS.length);
}