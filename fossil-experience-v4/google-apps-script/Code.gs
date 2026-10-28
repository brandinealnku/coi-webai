const SHEET_NAME = 'Events';
const TRAINING_SHEET = 'Training';

const HEADERS = [
  'Received At','Event Name','Session ID','Event Type','Event At','Elapsed ms',
  'Scan Attempt','Confidence','Fossil Probability','Other Probability','Background Probability',
  'Scan Time ms','Observe Choice','Look Closer','Next Action','Manual Bypass',
  'Total Time ms','Screen','User Agent',
  'Study Code','Observer Help','Looked Back','Attention','Companion Talk','Outcome','Observer Notes',
  'Recognized Specimen','Probabilities JSON'
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
    const lookCloser = event.lookCloser ?? (event.type === 'look-closer' ? event.value : '');
    const nextAction = event.next ?? (event.type === 'next-action' ? event.value : '');
    const recognizedSpecimen = event.recognizedSpecimen || '';

    sheet.appendRow([
      new Date(), payload.eventName || '', sessionId, event.type || '', event.at || '',
      event.elapsedMs ?? '', event.attempt ?? '', event.confidence ?? '',
      probs.fossil ?? '', probs.other ?? '', probs.background ?? '',
      event.scanTimeMs ?? '', observeChoice, lookCloser, nextAction,
      event.manualBypass ?? '', event.totalMs ?? '', event.screen ?? '',
      payload.userAgent || '', studyCode,
      event.observerHelp ?? '', event.lookedBack ?? '', event.attention ?? '',
      event.companionTalk ?? '', event.outcome ?? '', event.observerNotes ?? '',
      recognizedSpecimen, Object.keys(probs).length ? JSON.stringify(probs) : ''
    ]);

    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}

function doGet(e) {
  try {
    const action = String(e.parameter.action || '');
    if (action !== 'training') {
      return ContentService.createTextOutput('ok');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(TRAINING_SHEET);
    const out = {version: 4.2, classes: {fossil1: [], fossil2: [], fossil3: [], other: [], background: []}};

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

    const json = JSON.stringify(out);
    const callback = String(e.parameter.callback || '');
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
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

  summary.getRange('A1:B15').setValues([
    ['AI Day Metric','Value'],
    ['Unique visitor sessions','=COUNTA(UNIQUE(FILTER(Events!C2:C,Events!C2:C<>"",Events!D2:D<>"observer-note")))'],
    ['Completed sessions','=COUNTIF(Events!D2:D,"session-complete")'],
    ['Successful scans','=COUNTIF(Events!D2:D,"scan-success")'],
    ['Recognized Fossil 1','=COUNTIFS(Events!D2:D,"scan-success",Events!AA2:AA,"fossil1")'],
    ['Recognized Fossil 2','=COUNTIFS(Events!D2:D,"scan-success",Events!AA2:AA,"fossil2")'],
    ['Recognized Fossil 3','=COUNTIFS(Events!D2:D,"scan-success",Events!AA2:AA,"fossil3")'],
    ['Scanner made them look more closely','=COUNTIFS(Events!D2:D,"look-closer",Events!N2:N,"more")'],
    ['About the same','=COUNTIFS(Events!D2:D,"look-closer",Events!N2:N,"same")'],
    ['Looked less closely','=COUNTIFS(Events!D2:D,"look-closer",Events!N2:N,"less")'],
    ['Manual scan bypasses','=COUNTIF(Events!D2:D,"manual-bypass")'],
    ['Observer: looked back at object','=COUNTIFS(Events!D2:D,"observer-note",Events!V2:V,"yes")'],
    ['Observer: needed help','=COUNTIFS(Events!D2:D,"observer-note",Events!U2:U,"yes")'],
    ['Paired observer records','=COUNTIFS(Events!D2:D,"observer-note",Events!T2:T,"<>")'],
    ['Last event','=MAX(Events!A2:A)']
  ]);

  summary.setFrozenRows(1);
  summary.autoResizeColumns(1, 2);
  events.autoResizeColumns(1, HEADERS.length);
  training.autoResizeColumns(1, TRAINING_HEADERS.length);
}