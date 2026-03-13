// =============================================================
// SAMIT AGENT POS — CONFIGURATION
// Edit this file to set up the app for each agent's device.
// =============================================================
const CONFIG = {
    // Google Sheets API Key (from Google Cloud Console, restricted to Sheets API)
    SHEETS_API_KEY: 'AIzaSyCbcaFnfMfwA5MTNy8cwwx3juIg7Sz8RME',
    // Google Spreadsheet ID (from the sheet URL)
    SPREADSHEET_ID: '1bB5FyDPlGEuFxxl1IRXJny6Evs39Z-qBySDJhHn-TMs',
    // Google Apps Script Web App URL (handles all writes)
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbweL64lxdGtCbw7CjsIuIUhiPQDIHp623J8vSST8j0oRW_fwyzmyjmfb21KyCYvWFA/exec',
    // Agent name shown in the app and written to all records
    AGENT_NAME: 'Raul',
    // Timezone offset in hours (Philippines = 8)
    TZ_OFFSET: 8,
    // Discount labels
    DISCOUNT_1_LABEL: '3%',
    DISCOUNT_1_PCT: 0.03,
    DISCOUNT_2_LABEL: '2%',
    DISCOUNT_2_PCT: 0.02,
    DISCOUNT_3_LABEL: '1%',
    DISCOUNT_3_PCT: 0.01,
    // Sheet tab names
    SHEETS: {
        LOAD:         'Load',
        TRANSACTIONS: 'Transactions',
        ITEMS:        'Items',
        COLLECTIONS:  'Collections',
        REMITTANCES:  'Remittances',
        RETURNS:      'Returns',
        CUSTOMERS:    'Customers',
    }
};
