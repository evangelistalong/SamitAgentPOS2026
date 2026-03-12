# Samit Agent POS — GitHub Pages Frontend

Standalone web app for field agents. Runs entirely from a browser (iPad/phone), writes directly to Google Sheets, and syncs to the Flask/MSSQL server when the server PC is online.

## Files

| File | Purpose |
|---|---|
| `config.js` | **Edit this first** — agent name, Sheets ID, API key |
| `sheets.js` | Google Sheets read/write helpers + offline queue |
| `base.js` | Shared UI (toast, connection bar, sync badge) |
| `base.css` | All shared styles (matches the Flask app exactly) |
| `index.html` | Home launcher with daily stats |
| `load.html` | Morning truck load |
| `pos.html` | Point of sale / new transaction |
| `collections.html` | Record customer payments |
| `returns.html` | End-of-day returns |
| `remittance.html` | Submit remittance to office |

---

## Setup

### 1. Google Sheets — API Key (read access)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project → **APIs & Services → Credentials**
3. Create an **API key**, restrict it to **Google Sheets API** and your GitHub Pages domain
4. Paste it into `config.js` → `SHEETS_API_KEY`

### 2. Google Sheets — Service Account (write access)
Writes go through the Flask server's `/api/sheets-write` endpoint (already built in `sheets_sync.py`).  
The `service_account.json` stays on the server — the frontend never touches it.

### 3. config.js
Open `config.js` and set:
- `AGENT_NAME` — the agent's name (written to every record)
- `SHEETS_API_KEY` — from step 1
- `SPREADSHEET_ID` — already set (`1bB5FyDPlGEuFxxl1IRXJny6Evs39Z-qBySDJhHn-TMs`)
- `SERVER_URL` — Flask server IP (for write-through and offline sync)

### 4. GitHub Repo
```
New repo (e.g. samit-agent-pos)
Upload all files from this folder
Settings → Pages → Deploy from main branch / root
```
URL will be: `https://yourusername.github.io/samit-agent-pos/`

---

## Google Sheets Structure

The app expects these tab names (configurable in `config.js`):

### `Items` tab (catalog — populated from server)
| SKU | Name | Wholesale | Discountable | Commission |
|---|---|---|---|---|

### `Customers` tab
| Code | Name | Balance |
|---|---|---|

### `Load` tab
| Date | Agent | LoadID | SKU | Name | Price | LoadQty | SoldQty | ReturnQty | Verified | CheckerName |
|---|---|---|---|---|---|---|---|---|---|---|

### `Transactions` tab
| Date | Agent | TxID | CustomerCode | CustomerName | Total | DiscountPct | PaymentMethod | CashAmount | ChequeAmount | ChequeNumber | GCashAmount | GCashRef | CreditAmount | PreviousBalance | RemittanceNo | Notes | Timestamp |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

### `Collections` tab
| Date | Agent | CustomerCode | CustomerName | Amount | PaymentMethod | ChequeNumber | GCashRef | RemittanceNo | Notes | Timestamp |
|---|---|---|---|---|---|---|---|---|---|---|

### `Remittances` tab
| Date | Agent | RemittanceNo | Cash | Cheque | GCash | Total | Expected | Difference | Notes | Timestamp |
|---|---|---|---|---|---|---|---|---|---|---|

### `Returns` tab
| Date | Agent | LoadID | SKU | Name | ReturnQty | Timestamp |
|---|---|---|---|---|---|---|

---

## Offline Mode
- When the server is unreachable, writes are queued in `localStorage`
- Queue syncs automatically when connection is restored
- The sync badge (🔴 number) shows pending count
- Tap **🔄 Sync** manually to force a sync attempt

## Flask server endpoint needed
Add this route to your `app.py` (or a new route file):
```
POST /api/sheets-write
Body: { action, agent, ...data }
```
This is the single endpoint the GitHub Pages app calls for all writes.
The server validates the agent, writes to Sheets via the service account, and also writes to MSSQL.

---

## Per-Agent Deployment
Each agent gets their own fork/copy with their name in `config.js`.  
Or use a single repo and load the agent name from a URL parameter:
```javascript
// In config.js:
const urlAgent = new URLSearchParams(location.search).get('agent');
const CONFIG = { AGENT_NAME: urlAgent || 'Agent 1', ... };
// Access as: https://yourrepo.github.io/samit-agent-pos/?agent=Maria
```
