// =============================================================
// SAMIT AGENT POS — Google Apps Script Write Proxy
// Deploy as Web App: Execute as Me, Anyone can access
// =============================================================

const SPREADSHEET_ID   = '1bB5FyDPlGEuFxxl1IRXJny6Evs39Z-qBySDJhHn-TMs';
const AGENTPOS_ID      = '1DDueHEUvbUeCcornosMg_Vxdq6cvTSVSyTypfUNXSTI';

function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
    let result;

    switch (action) {
      case 'load_add':       result = handleLoadAdd(ss, data);       break;
      case 'load_return':    result = handleLoadReturn(ss, data);    break;
      case 'load_remove':    result = handleLoadRemove(ss, data);    break;
      case 'transaction':    result = handleTransaction(ss, data);   break;
      case 'collection':     result = handleCollection(ss, data);    break;
      case 'remittance':     result = handleRemittance(ss, data);    break;
      case 'returns_submit': result = handleReturns(ss, data);       break;
      case 'balance_adjust': result = handleBalanceAdjust(ss, data); break;
      case 'checker_verify': result = handleCheckerVerify(ss, data); break;
      case 'item_update':    result = handleItemUpdate(ss, data);    break;
      case 'sync_agentpos':  result = handleSyncAgentPOS(ss);        break;
      case 'photo_upload':   result = handlePhotoUpload(data);        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Allow CORS preflight
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── HELPERS ──────────────────────────────────────────────────

function getSheet(ss, name) {
  return ss.getSheetByName(name);
}

function nowPH() {
  const now = new Date();
  const ph  = new Date(now.getTime() + 8 * 3600000);
  return Utilities.formatDate(ph, 'UTC', 'yyyy-MM-dd HH:mm:ss');
}

function todayPH() {
  return nowPH().slice(0, 10);
}

function genId(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase();
}

// ── LOAD ADD ─────────────────────────────────────────────────

function handleLoadAdd(ss, data) {
  const ws = getSheet(ss, 'Load');
  if (!ws) return { success: false, error: 'Load sheet not found' };

  const loadId = genId('LD');
  ws.appendRow([
    todayPH(),   // Date
    data.agent,  // Agent
    loadId,      // LoadID
    data.sku,    // SKU
    data.name,   // Name
    data.price,  // Price
    data.qty,    // LoadQty
    0,           // SoldQty
    0,           // ReturnQty
    'FALSE',     // Verified
    '',          // CheckerName
  ]);
  return { success: true, loadId };
}

// ── LOAD RETURN ───────────────────────────────────────────────

function handleLoadReturn(ss, data) {
  const ws = getSheet(ss, 'Load');
  if (!ws) return { success: false, error: 'Load sheet not found' };

  const values  = ws.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const colLoadId    = headers.indexOf('loadid');
  const colReturnQty = headers.indexOf('returnqty');

  for (let i = 1; i < values.length; i++) {
    if (values[i][colLoadId] === data.loadId) {
      ws.getRange(i + 1, colReturnQty + 1).setValue(data.returnQty);
      return { success: true };
    }
  }
  return { success: false, error: 'LoadID not found: ' + data.loadId };
}

// ── LOAD REMOVE ───────────────────────────────────────────────

function handleLoadRemove(ss, data) {
  const ws = getSheet(ss, 'Load');
  if (!ws) return { success: false, error: 'Load sheet not found' };

  const values  = ws.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const colLoadId = headers.indexOf('loadid');

  for (let i = 1; i < values.length; i++) {
    if (values[i][colLoadId] === data.loadId) {
      ws.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'LoadID not found' };
}

// ── TRANSACTION ───────────────────────────────────────────────

function handleTransaction(ss, data) {
  const ws = getSheet(ss, 'Transactions');
  if (!ws) return { success: false, error: 'Transactions sheet not found' };

  const txId = genId('TX');
  ws.appendRow([
    data.date,
    data.agent,
    txId,
    data.customerCode    || '',
    data.customerName    || 'Walk-in',
    data.total           || 0,
    data.discountPct     || 0,
    data.paymentMethod   || '',
    data.cashAmount      || 0,
    data.chequeAmount    || 0,
    data.chequeNumber    || '',
    data.gcashAmount     || 0,
    data.gcashRef        || '',
    data.creditAmount    || 0,
    data.previousBalance || 0,
    data.remittanceNo    || 1,
    data.notes           || '',
    data.timestamp       || nowPH(),
  ]);

  if (data.items && data.items.length > 0) {
    updateSoldQty(ss, data.agent, data.date, data.items);
  }

  if (data.customerCode && data.creditAmount > 0) {
    updateCustomerBalance(ss, data.customerCode, data.creditAmount);
  }

  return { success: true, txId };
}

function updateSoldQty(ss, agent, date, items) {
  const ws = getSheet(ss, 'Load');
  if (!ws) return;
  const values  = ws.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const colAgent   = headers.indexOf('agent');
  const colDate    = headers.indexOf('date');
  const colSku     = headers.indexOf('sku');
  const colSoldQty = headers.indexOf('soldqty');

  items.forEach(item => {
    for (let i = 1; i < values.length; i++) {
      if (values[i][colAgent] === agent &&
          values[i][colDate].toString().slice(0, 10) === date &&
          values[i][colSku] === item.sku) {
        const current = parseInt(values[i][colSoldQty]) || 0;
        ws.getRange(i + 1, colSoldQty + 1).setValue(current + item.qty);
        values[i][colSoldQty] = current + item.qty;
        break;
      }
    }
  });
}

// ── COLLECTION ────────────────────────────────────────────────

function handleCollection(ss, data) {
  const ws = getSheet(ss, 'Collections');
  if (!ws) return { success: false, error: 'Collections sheet not found' };

  ws.appendRow([
    data.date,
    data.agent,
    data.customerCode  || '',
    data.customerName  || '',
    data.amount        || 0,
    data.paymentMethod || '',
    data.chequeNumber  || '',
    data.gcashRef      || '',
    data.remittanceNo  || 1,
    data.notes         || '',
    data.timestamp     || nowPH(),
  ]);

  if (data.customerCode && data.amount > 0) {
    updateCustomerBalance(ss, data.customerCode, -data.amount);
  }

  return { success: true };
}

// ── REMITTANCE ────────────────────────────────────────────────

function handleRemittance(ss, data) {
  const ws = getSheet(ss, 'Remittances');
  if (!ws) return { success: false, error: 'Remittances sheet not found' };

  ws.appendRow([
    data.date,
    data.agent,
    data.remittanceNo || 1,
    data.cash         || 0,
    data.cheque       || 0,
    data.gcash        || 0,
    data.total        || 0,
    data.expected     || 0,
    data.difference   || 0,
    data.notes        || '',
    data.timestamp    || nowPH(),
  ]);
  return { success: true };
}

// ── RETURNS SUBMIT ────────────────────────────────────────────

function handleReturns(ss, data) {
  const ws = getSheet(ss, 'Returns');
  if (!ws) return { success: false, error: 'Returns sheet not found' };

  if (data.items && data.items.length > 0) {
    data.items.forEach(item => {
      ws.appendRow([
        data.date,
        data.agent,
        item.loadId    || '',
        item.sku       || '',
        item.name      || '',
        item.returnQty || 0,
        data.timestamp || nowPH(),
      ]);
    });
  }
  return { success: true };
}

// ── BALANCE ADJUST ────────────────────────────────────────────

function handleBalanceAdjust(ss, data) {
  updateCustomerBalance(ss, data.customerCode, data.adjustment);
  return { success: true };
}

function updateCustomerBalance(ss, customerCode, delta) {
  const ws = getSheet(ss, 'Customers');
  if (!ws) return;
  const values  = ws.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const colCode    = headers.indexOf('code');
  const colBalance = headers.indexOf('balance');

  for (let i = 1; i < values.length; i++) {
    if (values[i][colCode].toString() === customerCode.toString()) {
      const current = parseFloat(values[i][colBalance]) || 0;
      ws.getRange(i + 1, colBalance + 1).setValue(current + delta);
      return;
    }
  }
}

// ── CHECKER VERIFY ────────────────────────────────────────────

function handleCheckerVerify(ss, data) {
  const ws = getSheet(ss, 'Load');
  if (!ws) return { success: false, error: 'Load sheet not found' };

  const values  = ws.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const colLoadId      = headers.indexOf('loadid');
  const colLoadQty     = headers.indexOf('loadqty');
  const colVerified    = headers.indexOf('verified');
  const colCheckerName = headers.indexOf('checkername');

  for (let i = 1; i < values.length; i++) {
    if (values[i][colLoadId] === data.loadId) {
      ws.getRange(i + 1, colVerified    + 1).setValue('TRUE');
      ws.getRange(i + 1, colCheckerName + 1).setValue(data.checkerName);
      if (data.verifiedQty !== undefined) {
        ws.getRange(i + 1, colLoadQty + 1).setValue(data.verifiedQty);
      }
      return { success: true };
    }
  }
  return { success: false, error: 'LoadID not found: ' + data.loadId };
}

// ── ITEM UPDATE ───────────────────────────────────────────────

function handleItemUpdate(ss, data) {
  const ws = getSheet(ss, 'Items');
  if (!ws) return { success: false, error: 'Items sheet not found' };

  const values  = ws.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const colSku  = headers.indexOf('sku');
  const colDisc = headers.indexOf('discountable');
  const colComm = headers.indexOf('commission');

  for (let i = 1; i < values.length; i++) {
    if (values[i][colSku] === data.sku) {
      if (colDisc >= 0) ws.getRange(i + 1, colDisc + 1).setValue(data.discountable);
      if (colComm >= 0) ws.getRange(i + 1, colComm + 1).setValue(data.commission);
      return { success: true };
    }
  }
  return { success: false, error: 'SKU not found: ' + data.sku };
}


// ── PHOTO UPLOAD → GOOGLE DRIVE ──────────────────────────────
// Photos from Load sheet, Returns, and Sale receipts

const PHOTO_FOLDER_ID = '16SzOCLKsjY0Eo8LMCJBXzzq3Qql4Q_s6';

function handlePhotoUpload(data) {
  try {
    const folder   = DriveApp.getFolderById(PHOTO_FOLDER_ID);
    const bytes    = Utilities.base64Decode(data.imageData);
    const blob     = Utilities.newBlob(bytes, 'image/jpeg', data.filename || 'photo.jpg');
    const file     = folder.createFile(blob);

    // Make it viewable by anyone with link (optional)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success:  true,
      fileId:   file.getId(),
      filename: file.getName(),
      url:      file.getUrl(),
      label:    data.label || ''
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ── SYNC AGENTPOS → AGENTFIELDPOS2026 ────────────────────────
// Triggered from the Sync button on index.html (home page)
// or via the daily time-based trigger (syncFromAgentPOS)

function handleSyncAgentPOS(ss) {
  try {
    const src          = SpreadsheetApp.openById(AGENTPOS_ID);
    const dst          = ss; // already opened AgentFieldPOS2026
    const itemsResult  = syncItems(src, dst);
    const custsResult  = syncCustomers(src, dst);
    return { success: true, items: itemsResult, customers: custsResult };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// Standalone function for the daily time-based trigger
function syncFromAgentPOS() {
  const src = SpreadsheetApp.openById(AGENTPOS_ID);
  const dst = SpreadsheetApp.openById(SPREADSHEET_ID);
  const itemsResult  = syncItems(src, dst);
  const custsResult  = syncCustomers(src, dst);
  Logger.log('Items: '     + JSON.stringify(itemsResult));
  Logger.log('Customers: ' + JSON.stringify(custsResult));
}

function syncItems(src, dst) {
  const srcSheet = src.getSheetByName('Items');
  const dstSheet = dst.getSheetByName('Items');
  if (!srcSheet) return { error: 'Source Items sheet not found' };
  if (!dstSheet) return { error: 'Destination Items sheet not found' };

  const srcData    = srcSheet.getDataRange().getValues();
  const srcHeaders = srcData[0].map(h => h.toString().trim());

  const sColSKU   = srcHeaders.indexOf('SKU');
  const sColName  = srcHeaders.indexOf('ItemDescr');
  const sColWhole = srcHeaders.indexOf('Wholesale');
  const sColDisc  = srcHeaders.indexOf('Discountable');
  const sColComm  = srcHeaders.indexOf('Commission');

  const dstData    = dstSheet.getDataRange().getValues();
  const dstHeaders = dstData[0].map(h => h.toString().trim());

  const dColSKU   = dstHeaders.indexOf('SKU');
  const dColName  = dstHeaders.indexOf('Name');
  const dColWhole = dstHeaders.indexOf('Wholesale');
  const dColDisc  = dstHeaders.indexOf('Discountable');
  const dColComm  = dstHeaders.indexOf('Commission');

  const existingRows = {};
  for (let i = 1; i < dstData.length; i++) {
    const sku = dstData[i][dColSKU] ? dstData[i][dColSKU].toString().trim() : '';
    if (sku) existingRows[sku] = i + 1;
  }

  const cleanPrice = val => {
    const s = val ? val.toString().replace(/[₱,\s\-]/g, '') : '';
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  let updated = 0, inserted = 0;

  for (let i = 1; i < srcData.length; i++) {
    const row = srcData[i];
    const sku = row[sColSKU] ? row[sColSKU].toString().trim() : '';
    if (!sku) continue;

    const name  = row[sColName]  || '';
    const whole = cleanPrice(row[sColWhole]);
    const disc  = row[sColDisc]  ? row[sColDisc].toString().toUpperCase().trim()  : 'FALSE';
    const comm  = row[sColComm]  ? row[sColComm].toString().toUpperCase().trim()  : 'FALSE';

    if (existingRows[sku]) {
      const r = existingRows[sku];
      if (dColName  >= 0) dstSheet.getRange(r, dColName  + 1).setValue(name);
      if (dColWhole >= 0) dstSheet.getRange(r, dColWhole + 1).setValue(whole);
      if (dColDisc  >= 0) dstSheet.getRange(r, dColDisc  + 1).setValue(disc);
      if (dColComm  >= 0) dstSheet.getRange(r, dColComm  + 1).setValue(comm);
      updated++;
    } else {
      const newRow = new Array(dstHeaders.length).fill('');
      if (dColSKU   >= 0) newRow[dColSKU]  = sku;
      if (dColName  >= 0) newRow[dColName]  = name;
      if (dColWhole >= 0) newRow[dColWhole] = whole;
      if (dColDisc  >= 0) newRow[dColDisc]  = disc;
      if (dColComm  >= 0) newRow[dColComm]  = comm;
      dstSheet.appendRow(newRow);
      inserted++;
    }
  }

  return { updated, inserted };
}

function syncCustomers(src, dst) {
  const srcSheet = src.getSheetByName('Customers');
  const dstSheet = dst.getSheetByName('Customers');
  if (!srcSheet) return { error: 'Source Customers sheet not found' };
  if (!dstSheet) return { error: 'Destination Customers sheet not found' };

  const srcData    = srcSheet.getDataRange().getValues();
  const srcHeaders = srcData[0].map(h => h.toString().trim());

  const sColCode = srcHeaders.indexOf('Code');
  const sColName = srcHeaders.indexOf('CustomerName');

  const dstData    = dstSheet.getDataRange().getValues();
  const dstHeaders = dstData[0].map(h => h.toString().trim());

  const dColCode = dstHeaders.indexOf('Code');
  const dColName = dstHeaders.indexOf('Name');
  const dColBal  = dstHeaders.indexOf('Balance');
  // Balance is intentionally NEVER overwritten

  const existingRows = {};
  for (let i = 1; i < dstData.length; i++) {
    const code = dstData[i][dColCode] ? dstData[i][dColCode].toString().trim() : '';
    if (code) existingRows[code] = i + 1;
  }

  let updated = 0, inserted = 0;

  for (let i = 1; i < srcData.length; i++) {
    const row  = srcData[i];
    const code = row[sColCode] ? row[sColCode].toString().trim() : '';
    if (!code) continue;

    const name = row[sColName] ? row[sColName].toString().trim() : '';

    if (existingRows[code]) {
      // Only update name — NEVER touch Balance
      const r = existingRows[code];
      if (dColName >= 0) dstSheet.getRange(r, dColName + 1).setValue(name);
      updated++;
    } else {
      // New customer — Balance starts at 0
      const newRow = new Array(dstHeaders.length).fill('');
      if (dColCode >= 0) newRow[dColCode] = code;
      if (dColName >= 0) newRow[dColName] = name;
      if (dColBal  >= 0) newRow[dColBal]  = 0;
      dstSheet.appendRow(newRow);
      inserted++;
    }
  }

  return { updated, inserted };
}
