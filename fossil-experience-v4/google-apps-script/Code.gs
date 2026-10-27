const SHEET_NAME = 'Events';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const event = payload.event || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Received At','Event Name','Session ID','Event Type','Event At','Elapsed ms',
        'Scan Attempt','Confidence','Fossil Probability','Other Probability','Background Probability',
        'Scan Time ms','Observe Choice','Look Closer','Next Action','Manual Bypass',
        'Total Time ms','Screen','User Agent'
      ]);
      sheet.setFrozenRows(1);
    }

    const probs = event.probabilities || {};
    const observeChoice = event.observe ?? (event.type === 'observe-choice' ? event.value : '');
    const lookCloser = event.lookCloser ?? (event.type === 'look-closer' ? event.value : '');
    const nextAction = event.next ?? (event.type === 'next-action' ? event.value : '');
    sheet.appendRow([
      new Date(),
      payload.eventName || '',
      payload.sessionId || '',
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
      payload.userAgent || ''
    ]);

    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}

function setupWorkbook() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let events = ss.getSheetByName(SHEET_NAME);
  if (!events) events = ss.insertSheet(SHEET_NAME);
  if (events.getLastRow() === 0) {
    events.appendRow([
      'Received At','Event Name','Session ID','Event Type','Event At','Elapsed ms',
      'Scan Attempt','Confidence','Fossil Probability','Other Probability','Background Probability',
      'Scan Time ms','Observe Choice','Look Closer','Next Action','Manual Bypass',
      'Total Time ms','Screen','User Agent'
    ]);
    events.setFrozenRows(1);
  }

  let summary = ss.getSheetByName('Summary');
  if (!summary) summary = ss.insertSheet('Summary');
  summary.clear();
  summary.getRange('A1:B8').setValues([
    ['AI Day Metric','Value'],
    ['Unique sessions','=COUNTA(UNIQUE(FILTER(Events!C2:C,Events!C2:C<>"")))'],
    ['Completed sessions','=COUNTIF(Events!D2:D,"session-complete")'],
    ['Successful scans','=COUNTIF(Events!D2:D,"scan-success")'],
    ['Looked closer: Yes','=COUNTIFS(Events!D2:D,"look-closer",Events!N2:N,"yes")'],
    ['Looked closer: A little','=COUNTIFS(Events!D2:D,"look-closer",Events!N2:N,"a-little")'],
    ['Manual scan bypasses','=COUNTIF(Events!D2:D,"manual-bypass")'],
    ['Last event','=MAX(Events!A2:A)']
  ]);
  summary.setFrozenRows(1);
  summary.autoResizeColumns(1,2);
  events.autoResizeColumns(1,19);
}