// =============================================================
// SAMIT AGENT POS — CONFIGURATION
// Edit this file to set up the app for each agent's device.
// =============================================================

const CONFIG = {
    // Google Sheets API Key (from Google Cloud Console, restricted to Sheets API)
    SHEETS_API_KEY: 'AIzaSyCbcaFnfMfwA5MTNy8cwwx3juIg7Sz8RME',

    // Google Spreadsheet ID (from the sheet URL)
    SPREADSHEET_ID: '1bB5FyDPlGEuFxxl1IRXJny6Evs39Z-qBySDJhHn-TMs',

    // Agent name shown in the app and written to all records
    AGENT_NAME: 'Raul',

    // Timezone offset in hours (Philippines = 8)
    TZ_OFFSET: 8,

    // Flask server URL — used to sync data back to MSSQL when online.
    // Set to null to disable server sync entirely.
    SERVER_URL: 'http://10.0.0.51:5002',

    // Backup server URL (optional)
    BACKUP_SERVER_URL: 'http://100.93.146.72:5002',

    // Discount labels (must match what's configured on the server)
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
