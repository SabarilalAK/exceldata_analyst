import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const __dirname = path.resolve();
const dbDir = path.join(__dirname, 'database');

// Ensure dedicated database folder exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const masterDbPath = path.join(dbDir, 'system_master.db');

// Initialize Master System SQLite Database Connection
const db = new sqlite3.Database(masterDbPath, (err) => {
  if (err) {
    console.error("❌ Master SQLite Database Connection Error:", err.message);
  } else {
    console.log(`🗄️ Connected to Master System SQLite Database (${masterDbPath})`);
  }
});

// Initialize Master System Tables
db.serialize(() => {
  // Datasets Metadata Registry
  db.run(`
    CREATE TABLE IF NOT EXISTS datasets (
      filename TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      metadata_json TEXT NOT NULL,
      separate_db_file TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL
    )
  `);

  // Chat History Table
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
 * Creates a separate, standalone .db database file for each uploaded dataset/document on disk.
 */
export function createSeparateDatabaseFile(filename, columns = [], rows = []) {
  return new Promise((resolve, reject) => {
    const cleanDbName = filename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '.db';
    const separateDbPath = path.join(dbDir, cleanDbName);
    
    // Create or connect to separate standalone SQLite database file
    const sepDb = new sqlite3.Database(separateDbPath, (err) => {
      if (err) return reject(err);
    });

    if (!columns || columns.length === 0) {
      sepDb.close();
      return resolve({ dbFileName: cleanDbName, dbPath: separateDbPath, rowCount: 0 });
    }

    const sanitizedCols = columns.map((c, i) => c ? String(c).replace(/[^a-zA-Z0-9_]/g, '_') : `col_${i}`);
    const colDefs = sanitizedCols.map(c => `"${c}" TEXT`).join(', ');

    sepDb.serialize(() => {
      sepDb.run(`DROP TABLE IF EXISTS dataset_values`);
      sepDb.run(`CREATE TABLE dataset_values (row_id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs})`, (err) => {
        if (err) {
          sepDb.close();
          return reject(err);
        }

        if (rows && rows.length > 0) {
          const colNames = sanitizedCols.map(c => `"${c}"`).join(', ');
          const placeholders = columns.map(() => '?').join(', ');
          const stmt = sepDb.prepare(`INSERT INTO dataset_values (${colNames}) VALUES (${placeholders})`);

          rows.forEach(row => {
            const vals = columns.map(c => (row[c] !== undefined && row[c] !== null) ? String(row[c]) : '');
            stmt.run(vals);
          });
          
          stmt.finalize((finalizeErr) => {
            sepDb.close();
            if (finalizeErr) return reject(finalizeErr);
            console.log(`🗄️ Created standalone database file '${cleanDbName}' with ${rows.length} rows.`);
            resolve({ dbFileName: cleanDbName, dbPath: separateDbPath, rowCount: rows.length });
          });
        } else {
          sepDb.close();
          resolve({ dbFileName: cleanDbName, dbPath: separateDbPath, rowCount: 0 });
        }
      });
    });
  });
}

/**
 * Save dataset metadata in Master SQLite Database
 */
export function saveDataset(filename, originalName, size, metadata, separateDbFile = '') {
  return new Promise((resolve, reject) => {
    const uploadedAt = Date.now();
    const metadataJson = JSON.stringify(metadata);

    db.run(
      `INSERT OR REPLACE INTO datasets (filename, original_name, size, metadata_json, separate_db_file, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [filename, originalName, size, metadataJson, separateDbFile, uploadedAt],
      function (err) {
        if (err) return reject(err);
        resolve({ filename, originalName, size, metadata, separateDbFile, uploadedAt });
      }
    );
  });
}

/**
 * Fetch all datasets from Master SQLite database
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
        separateDbFile: r.separate_db_file,
        primaryDatabase: `Standalone SQLite DB (backend/database/${r.separate_db_file})`
      }));
      resolve(datasets);
    });
  });
}

/**
 * Fetch past chat history for a dataset from Master SQLite database
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
 * Save query prompt and AI response to Master SQLite chat_history table
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
