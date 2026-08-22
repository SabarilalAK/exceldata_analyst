import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const __dirname = path.resolve();
const dbDir = path.join(__dirname, 'database');

// Ensure dedicated database folder exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'excel_analyst.db');

// Initialize Single SQLite Database Connection in dedicated backend/database/ folder
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ SQLite Database Connection Error:", err.message);
  } else {
    console.log(`🗄️ Connected to SQLite Database in dedicated folder (${dbPath})`);
  }
});

// Initialize Tables
db.serialize(() => {
  // 1. Datasets Table
  db.run(`
    CREATE TABLE IF NOT EXISTS datasets (
      filename TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      metadata_json TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL
    )
  `);

  // 2. Dataset Row Records Table (stores full spreadsheet table data for SQL calculations)
  db.run(`
    CREATE TABLE IF NOT EXISTS dataset_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      record_json TEXT NOT NULL
    )
  `);

  // 3. Chat History & Analytical Logs Table
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      active_sheet TEXT NOT NULL,
      query TEXT NOT NULL,
      text_response TEXT NOT NULL,
      table_data_json TEXT,
      table_columns_json TEXT,
      has_chart INTEGER DEFAULT 0,
      chart_url TEXT,
      timestamp INTEGER NOT NULL
    )
  `);
});

/**
 * Save or update dataset metadata and row records in SQLite
 */
export function saveDataset(filename, originalName, size, metadata, rows = []) {
  return new Promise((resolve, reject) => {
    const uploadedAt = Date.now();
    const metadataJson = JSON.stringify(metadata);

    db.run(
      `INSERT OR REPLACE INTO datasets (filename, original_name, size, metadata_json, uploaded_at) VALUES (?, ?, ?, ?, ?)`,
      [filename, originalName, size, metadataJson, uploadedAt],
      function (err) {
        if (err) return reject(err);

        if (rows && rows.length > 0) {
          const stmt = db.prepare(
            `INSERT INTO dataset_records (filename, sheet_name, row_index, record_json) VALUES (?, ?, ?, ?)`
          );
          const defaultSheet = metadata.defaultSheet || 'Sheet1';
          rows.forEach((row, idx) => {
            stmt.run(filename, defaultSheet, idx, JSON.stringify(row));
          });
          stmt.finalize();
        }

        resolve({ filename, originalName, size, metadata, uploadedAt });
      }
    );
  });
}

/**
 * Fetch all datasets from SQLite database
 */
export function getDatasets() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM datasets ORDER BY uploaded_at DESC`, [], (err, rows) => {
      if (err) return reject(err);
      const datasets = rows.map(r => ({
        id: r.filename,
        filename: r.filename,
        originalName: r.original_name,
        size: r.size,
        metadata: JSON.parse(r.metadata_json),
        uploadedAt: r.uploaded_at,
        primaryDatabase: 'SQLite Database (backend/database/excel_analyst.db)'
      }));
      resolve(datasets);
    });
  });
}

/**
 * Fetch past chat history for a dataset from SQLite database
 */
export function getDatasetHistory(filename) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM chat_history WHERE filename = ? ORDER BY timestamp ASC`,
      [filename],
      (err, rows) => {
        if (err) return reject(err);
        const history = rows.map(r => ({
          id: r.id,
          filename: r.filename,
          activeSheet: r.active_sheet,
          query: r.query,
          textResponse: r.text_response,
          tableData: r.table_data_json ? JSON.parse(r.table_data_json) : null,
          tableColumns: r.table_columns_json ? JSON.parse(r.table_columns_json) : null,
          hasChart: Boolean(r.has_chart),
          chartUrl: r.chart_url,
          timestamp: r.timestamp
        }));
        resolve(history);
      }
    );
  });
}

/**
 * Save query prompt and AI response to SQLite chat_history table
 */
export function saveQueryHistory(filename, activeSheet, query, textResponse, tableData, tableColumns, hasChart, chartUrl) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const tableDataJson = tableData ? JSON.stringify(tableData) : null;
    const tableColumnsJson = tableColumns ? JSON.stringify(tableColumns) : null;
    const hasChartVal = hasChart ? 1 : 0;

    db.run(
      `INSERT INTO chat_history (filename, active_sheet, query, text_response, table_data_json, table_columns_json, has_chart, chart_url, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [filename, activeSheet, query, textResponse, tableDataJson, tableColumnsJson, hasChartVal, chartUrl, timestamp],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, filename, query, timestamp });
      }
    );
  });
}

export { db };
