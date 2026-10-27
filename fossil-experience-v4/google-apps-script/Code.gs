const SHEET_NAME = 'Events';

const HEADERS = [
  'Received At','Event Name','Session ID','Study Code','Event Type','Event At','Elapsed ms',
  'Scan Attempt','Confidence','Fossil Probability','Other Probability','Background Probability',
  'Scan Time ms','Observe Choice','Look Closer','Next Action','Manual Bypass',
  'Total Time ms','Screen','User Agent',
  'Observer Help','Looked Back','Attention','Companion Talk','Outcome','Observer Notes'
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const event = payload.event || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

    ensureHeaders_(sheet);

    const probs = event.probabilities || {};
    const sessionId = String(payload.sessionId || '');
    const studyCode = sessionId.slice(0, 6).toUpperCase();
    const observeChoice = event.observe ?? (event.type === 'observe-choice' ? event.value : '');
    const lookCloser = event.lookCloser ?? (event.type === 'look-closer' ? event.value : '');
    const nextAction = event.next ?? (event.type === 'next-action' ? event.value : '');

    sheet.appendRow([
      new Date(),
      payload.eventName || '',
      sessionId,
      studyCode,
      event.type || '',
      event.at || '',
      event.elapsedMs ?? '',
      event.attempt ?? '',
      event.confidence ?? '',
      probs.fossil ?? '',
      probs.other ?? '',
      probs.background ?? '',
      event.scanTimeMs ?? '',
      observeChoice,
      lookCloser,
      nextAction,
      event.manualBypass ?? '',
      event.totalMs ?? '',
      event.screen ?? '',
      payload.userAgent || '',
      event.observerHelp ?? '',
      event.lookedBack ?? '',
      event.attention ?? '',
      event.companionTalk ?? '',
      event.outcome ?? '',
      event.observerNotes ?? ''
    ]);

    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}

function ensureHeaders_(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  let mismatch = false;
  for (let i = 0; i < HEADERS.length; i++) {
    if (existing[i] !== HEADERS[i]) { mismatch = true; break; }
  }
  if (sheet.getLastRow() === 0 || mismatch) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function setupWorkbook() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('America/New_York');

  let events = ss.getSheetByName(SHEET_NAME);
  if (!events) events = ss.insertSheet(SHEET_NAME);
  ensureHeaders_(events);

  let summary = ss.getSheetByName('Summary');
  if (!summary) summary = ss.insertSheet('Summary');
  summary.clear();

  summary.getRange('A1:B12').setValues([
    ['AI Day Metric','Value'],
    ['Unique sessions','=COUNTA(UNIQUE(FILTER(Events!C2:C,Events!C2:C<>"")))'],
    ['Completed sessions','=COUNTIF(Events!E2:E,"session-complete")'],
    ['Successful scans','=COUNTIF(Events!E2:E,"scan-success")'],
    ['Scanner made them look more closely','=COUNTIFS(Events!E2:E,"look-closer",Events!O2:O,"more")'],
    ['About the same','=COUNTIFS(Events!E2:E,"look-closer",Events!O2:O,"same")'],
    ['Looked less closely','=COUNTIFS(Events!E2:E,"look-closer",Events!O2:O,"less")'],
    ['Manual scan bypasses','=COUNTIF(Events!E2:E,"manual-bypass")'],
    ['Observer: looked back at fossil','=COUNTIFS(Events!E2:E,"observer-note",Events!V2:V,"yes")'],
    ['Observer: needed help','=COUNTIFS(Events!E2:E,"observer-note",Events!U2:U,"yes")'],
    ['Observer notes','=COUNTIF(Events!E2:E,"observer-note")'],
    ['Last event','=MAX(Events!A2:A)']
  ]);
  summary.setFrozenRows(1);
  summary.autoResizeColumns(1, 2);
  events.autoResizeColumns(1, HEADERS.length);
}