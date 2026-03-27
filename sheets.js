// =============================================================
// SAMIT AGENT POS — GOOGLE SHEETS HELPER
// Reads via public Sheets API (API key).
// Writes via Google Apps Script web app proxy.
// Falls back to offline queue when unreachable.
// =============================================================

const Sheets = {

    // ── UTILITIES ────────────────────────────────────────────

    today() {
        const now = new Date(Date.now() + CONFIG.TZ_OFFSET * 3600000);
        return now.toISOString().slice(0, 10);
    },

    now() {
        const now = new Date(Date.now() + CONFIG.TZ_OFFSET * 3600000);
        return now.toISOString().slice(0, 19).replace('T', ' ');
    },

    fmt(n) {
        return '\u20b1' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    // ── LOW-LEVEL SHEETS API ──────────────────────────────────

    async readSheet(tabName) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(tabName)}?key=${CONFIG.SHEETS_API_KEY}`;
        try {
            const r = await fetch(url);
            if (!r.ok) throw new Error('Sheets API ' + r.status);
            const data = await r.json();
            return data.values || [];
        } catch (e) {
            console.error('[Sheets.readSheet]', tabName, e);
            return null;
        }
    },

    // Write via Apps Script proxy — falls back to offline queue
    async writeRows(action, payload) {
        const body = { action, agent: CONFIG.AGENT_NAME, ...payload };
        try {
            const r = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10000)
            });
            const result = await r.json();
            if (result.success) return result;
            console.warn('[Sheets.writeRows] Apps Script error:', result.error);
        } catch (e) {
            console.warn('[Sheets.writeRows] Apps Script unreachable:', e.message);
        }
        return OfflineQueue.enqueue(action, body);
    },

    // ── LOAD ─────────────────────────────────────────────────

    async getLoad() {
        const rows = await this.readSheet(CONFIG.SHEETS.LOAD);
        if (!rows) return null;
        if (rows.length < 2) return [];
        const [headers, ...data] = rows;
        const h = headers.map(x => x.trim().toLowerCase());
        return data
            .filter(r => (r[h.indexOf('date')] || '') === this.today() &&
                         (r[h.indexOf('agent')] || '') === CONFIG.AGENT_NAME)
            .map(r => ({
                loadId:      r[h.indexOf('loadid')] || '',
                sku:         r[h.indexOf('sku')] || '',
                name:        r[h.indexOf('name')] || '',
                price:       parseFloat(r[h.indexOf('price')]) || 0,
                loadQty:     parseInt(r[h.indexOf('loadqty')]) || 0,
                soldQty:     parseInt(r[h.indexOf('soldqty')]) || 0,
                returnQty:   parseInt(r[h.indexOf('returnqty')]) || 0,
                verified:    (r[h.indexOf('verified')] || '').toLowerCase() === 'true',
                checkerName: r[h.indexOf('checkername')] || '',
            }));
    },

    async addLoadItem(sku, name, price, qty) {
        return this.writeRows('load_add', { sku, name, price, qty, date: this.today() });
    },

    async updateReturnQty(loadId, returnQty) {
        return this.writeRows('load_return', { loadId, returnQty });
    },

    // ── ITEMS CATALOG ─────────────────────────────────────────

    async getAllItems() {
        const cached = Cache.get('items');
        if (cached) return cached;
        const rows = await this.readSheet(CONFIG.SHEETS.ITEMS);
        if (!rows || rows.length < 2) return [];
        const [headers, ...data] = rows;
        const h = headers.map(x => x.trim().toLowerCase());
        const iOnHand = h.indexOf('onhand');  // NEW: OnHand from PBEST-POS
        const items = data.map(r => ({
            sku:          r[h.indexOf('sku')] || '',
            name:         r[h.indexOf('name')] || '',
            wholesale:    parseFloat(r[h.indexOf('wholesale')]) || 0,
            discountable: (r[h.indexOf('discountable')] || 'true').toLowerCase() !== 'false',
            commission:   parseFloat(r[h.indexOf('commission')]) || 0,
            onhand:       iOnHand >= 0 ? (parseFloat(r[iOnHand]) || 0) : null,  // NEW
            active:       (r[h.indexOf('active')] || 'Yes').toLowerCase() === 'yes',
        })).filter(i => i.sku);
        Cache.set('items', items, 30 * 60 * 1000);
        return items;
    },

    async getLoadedItems() {
        const load = await this.getLoad();
        if (!load) return [];
        const items = await this.getAllItems();
        return load.map(l => {
            const catalog = items.find(i => i.sku === l.sku) || {};
            return {
                ...l,
                wholesale:    l.price || catalog.wholesale || 0,
                discountable: catalog.discountable !== false,
                commission:   catalog.commission || 0,
                onhand:       catalog.onhand,   // NEW
                remaining:    l.loadQty - l.soldQty,
            };
        }).filter(i => i.remaining > 0);
    },

    // ── CUSTOMERS ─────────────────────────────────────────────

    async getCustomers() {
        const cached = Cache.get('customers');
        if (cached) return cached;
        const rows = await this.readSheet(CONFIG.SHEETS.CUSTOMERS);
        if (!rows || rows.length < 2) return [];
        const [headers, ...data] = rows;
        const h = headers.map(x => x.trim().toLowerCase());
        // Support multiple possible header names from different sources
        const iCode = Math.max(h.indexOf('code'), h.indexOf('customercode'));
        const iName = Math.max(h.indexOf('name'), h.indexOf('customername'));
        const iBal  = h.indexOf('balance');
        const customers = data.map(r => ({
            code:    (iCode >= 0 ? r[iCode] : '') || '',
            name:    (iName >= 0 ? r[iName] : '') || '',
            balance: iBal >= 0 ? (parseFloat(r[iBal]) || 0) : 0,
        })).filter(c => c.code && c.name);
        Cache.set('customers', customers, 5 * 60 * 1000);
        return customers;
    },

    // ── TRANSACTIONS ──────────────────────────────────────────

    async postTransaction(payload) {
        return this.writeRows('transaction', {
            date: this.today(),
            timestamp: this.now(),
            ...payload
        });
    },

    async getTodayTransactions() {
        const rows = await this.readSheet(CONFIG.SHEETS.TRANSACTIONS);
        if (!rows || rows.length < 2) return [];
        const [headers, ...data] = rows;
        const h = headers.map(x => x.trim().toLowerCase());
        return data
            .filter(r => (r[h.indexOf('date')] || '') === this.today() &&
                         (r[h.indexOf('agent')] || '') === CONFIG.AGENT_NAME)
            .map(r => ({
                txId:         r[h.indexOf('txid')] || '',
                customerName: r[h.indexOf('customername')] || 'Walk-in',
                total:        parseFloat(r[h.indexOf('total')]) || 0,
                method:       r[h.indexOf('paymentmethod')] || '',
                timestamp:    r[h.indexOf('timestamp')] || '',
            }))
            .reverse();
    },

    // ── COLLECTIONS ───────────────────────────────────────────

    async postCollection(payload) {
        return this.writeRows('collection', {
            date: this.today(),
            timestamp: this.now(),
            ...payload
        });
    },

    async getTodayCollections() {
        const rows = await this.readSheet(CONFIG.SHEETS.COLLECTIONS);
        if (!rows || rows.length < 2) return [];
        const [headers, ...data] = rows;
        const h = headers.map(x => x.trim().toLowerCase());
        return data
            .filter(r => (r[h.indexOf('date')] || '') === this.today() &&
                         (r[h.indexOf('agent')] || '') === CONFIG.AGENT_NAME)
            .map(r => ({
                customerName: r[h.indexOf('customername')] || '',
                amount:       parseFloat(r[h.indexOf('amount')]) || 0,
                method:       r[h.indexOf('paymentmethod')] || '',
                timestamp:    r[h.indexOf('timestamp')] || '',
            }))
            .reverse();
    },

    // ── REMITTANCE ────────────────────────────────────────────

    async getRemittanceData() {
        const [txRows, collRows, remRows] = await Promise.all([
            this.readSheet(CONFIG.SHEETS.TRANSACTIONS),
            this.readSheet(CONFIG.SHEETS.COLLECTIONS),
            this.readSheet(CONFIG.SHEETS.REMITTANCES),
        ]);
        const today = this.today();
        const agent = CONFIG.AGENT_NAME;

        const parseRows = (rows) => {
            if (!rows || rows.length < 2) return [];
            const [h, ...data] = rows;
            const hi = h.map(x => x.trim().toLowerCase());
            return data.filter(r =>
                (r[hi.indexOf('date')] || '') === today &&
                (r[hi.indexOf('agent')] || '') === agent
            ).map(r => {
                const obj = {};
                hi.forEach((k, i) => obj[k] = r[i] || '');
                return obj;
            });
        };

        const txs   = parseRows(txRows);
        const colls = parseRows(collRows);
        const rems  = parseRows(remRows);

        const tx1 = txs.filter(t => (t['remittanceno'] || '1') === '1');
        const e1 = {
            cash:   tx1.filter(t => t['paymentmethod'] === 'Cash').reduce((s, t) => s + parseFloat(t['cashamount'] || t['total'] || 0), 0),
            cheque: tx1.filter(t => t['paymentmethod'] === 'Cheque').reduce((s, t) => s + parseFloat(t['chequeamount'] || t['total'] || 0), 0),
            gcash:  tx1.filter(t => t['paymentmethod'] === 'GCash').reduce((s, t) => s + parseFloat(t['gcashamount'] || t['total'] || 0), 0),
        };
        e1.total = e1.cash + e1.cheque + e1.gcash;

        const coll1 = colls.filter(c => (c['remittanceno'] || '1') === '1');
        e1.cash   += coll1.filter(c => c['paymentmethod'] === 'Cash').reduce((s, c) => s + parseFloat(c['amount'] || 0), 0);
        e1.cheque += coll1.filter(c => c['paymentmethod'] === 'Cheque').reduce((s, c) => s + parseFloat(c['amount'] || 0), 0);
        e1.gcash  += coll1.filter(c => c['paymentmethod'] === 'GCash').reduce((s, c) => s + parseFloat(c['amount'] || 0), 0);
        e1.total = e1.cash + e1.cheque + e1.gcash;

        const tx2    = txs.filter(t => (t['remittanceno'] || '1') === '2');
        const coll2  = colls.filter(c => (c['remittanceno'] || '1') === '2');
        const e2 = { total: 0, cash: 0, cheque: 0, gcash: 0 };
        [...tx2, ...coll2].forEach(r => {
            e2.cash   += parseFloat(r['cashamount']   || (r['paymentmethod'] === 'Cash'   ? (r['amount'] || r['total'] || 0) : 0));
            e2.cheque += parseFloat(r['chequeamount'] || (r['paymentmethod'] === 'Cheque' ? (r['amount'] || r['total'] || 0) : 0));
            e2.gcash  += parseFloat(r['gcashamount']  || (r['paymentmethod'] === 'GCash'  ? (r['amount'] || r['total'] || 0) : 0));
        });
        e2.total = e2.cash + e2.cheque + e2.gcash;

        const submitted = rems.map(r => ({
            no:    parseInt(r['remittanceno']) || 1,
            total: parseFloat(r['total']) || 0,
            diff:  parseFloat(r['difference']) || 0,
        }));

        return { expected1: e1, expected2: e2, remittances: submitted };
    },

    async postRemittance(payload) {
        return this.writeRows('remittance', {
            date: this.today(),
            timestamp: this.now(),
            ...payload
        });
    },
};

// =============================================================
// SIMPLE IN-MEMORY CACHE
// =============================================================
const Cache = {
    _store: {},
    set(key, data, ttlMs) {
        this._store[key] = { data, expires: Date.now() + ttlMs };
    },
    get(key) {
        const entry = this._store[key];
        if (entry && Date.now() < entry.expires) return entry.data;
        delete this._store[key];
        return null;
    },
    clear(key) { delete this._store[key]; }
};

// =============================================================
// OFFLINE QUEUE (localStorage-backed)
// =============================================================
const OfflineQueue = {
    KEY: 'samit_offline_queue',

    getAll() {
        try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
        catch(e) { return []; }
    },

    enqueue(action, data) {
        const queue = this.getAll();
        const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        queue.push({ id, action, data, createdAt: new Date().toISOString(), status: 'pending' });
        localStorage.setItem(this.KEY, JSON.stringify(queue));
        OfflineQueue.updateBadge();
        return { success: true, offline: true, queueId: id };
    },

    markSynced(id) {
        const queue = this.getAll().filter(q => q.id !== id);
        localStorage.setItem(this.KEY, JSON.stringify(queue));
        this.updateBadge();
    },

    pendingCount() {
        return this.getAll().filter(q => q.status === 'pending').length;
    },

    updateBadge() {
        const badge = document.getElementById('syncBadge');
        if (!badge) return;
        const n = this.pendingCount();
        badge.textContent = n;
        badge.style.display = n > 0 ? 'flex' : 'none';
    },

    async syncAll() {
        if (!navigator.onLine) return;
        const queue = this.getAll().filter(q => q.status === 'pending');
        if (!queue.length) return;
        let ok = 0;
        for (const item of queue) {
            try {
                const r = await fetch(CONFIG.APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(item.data),
                    signal: AbortSignal.timeout(10000)
                });
                const result = await r.json();
                if (result.success) { this.markSynced(item.id); ok++; }
            } catch(e) { /* stay queued */ }
        }
        if (ok > 0) showToast('\u2705 Synced ' + ok + ' offline record' + (ok > 1 ? 's' : ''));
        this.updateBadge();
    }
};
