import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getExcelMetadata, analyzeData } from './utils.js';
import { saveDataset, getDatasets, getDatasetHistory, saveQueryHistory } from './database.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all routes (Vite frontend on 5173, backend on 5000)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup file paths
const __dirname = path.resolve();
const uploadDir = path.join(__dirname, 'uploads');
const chartsDir = path.join(__dirname, 'charts');
const tempDir = path.join(__dirname, 'temp');

// Ensure directories exist
[uploadDir, chartsDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer for uploading sheets
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed.'));
    }
  }
});

// Static folder to serve generated chart images
app.use('/api/charts', express.static(chartsDir));

/**
 * Endpoint: GET /api/db-status
 * Returns connection status and mode of Single Unified SQLite Database.
 */
app.get('/api/db-status', (req, res) => {
  res.json({
    connected: true,
    isPrimaryDb: true,
    mode: 'SQLite (Single Unified Database)'
  });
});

// Alias for backwards compatibility
app.get('/api/firebase-status', (req, res) => {
  res.json({
    connected: true,
    isPrimaryDb: true,
    mode: 'SQLite (Single Unified Database)'
  });
});

/**
 * Endpoint: GET /api/datasets
 * Primary Database Query: Reads all dataset documents from SQLite database.
 */
app.get('/api/datasets', async (req, res) => {
  try {
    const datasets = await getDatasets();
    res.json({ success: true, datasets });
  } catch (error) {
    console.error("Error reading datasets from SQLite:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: GET /api/datasets/:filename/history
 * Primary Database Query: Fetches past chat & analysis history from SQLite database.
 */
app.get('/api/datasets/:filename/history', async (req, res) => {
  try {
    const { filename } = req.params;
    const history = await getDatasetHistory(filename);
    res.json({ success: true, history });
  } catch (error) {
    console.error("Error fetching chat history from SQLite:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: POST /api/upload
 * Handles file uploads, extracts dataset metadata, and saves into single SQLite database.
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    console.log(`Uploaded file stored at: ${filePath}`);
    
    // Extract metadata
    const metadata = await getExcelMetadata(filePath);
    
    if (metadata.error) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: `Could not parse file: ${metadata.error}` });
    }

    // Save into single SQLite Database `excel_analyst.db`
    await saveDataset(req.file.filename, req.file.originalname, req.file.size, metadata);
    console.log(`🗄️ Saved dataset to Single Unified SQLite Database: ${req.file.filename}`);

    res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      metadata: metadata,
      primaryDatabase: 'SQLite (Single Unified Database)'
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message || 'Internal server error during upload.' });
  }
});

/**
 * Endpoint: POST /api/load-demo
 * Loads pre-generated mock_invoices.xlsx file directly and saves into single SQLite database.
 */
app.post('/api/load-demo', async (req, res) => {
  try {
    const demoFileName = 'mock_invoices.xlsx';
    const filePath = path.join(uploadDir, demoFileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Demo spreadsheet file not found.' });
    }
    
    const metadata = await getExcelMetadata(filePath);
    
    if (metadata.error) {
      return res.status(400).json({ error: `Could not parse demo file: ${metadata.error}` });
    }

    // Save into single SQLite Database `excel_analyst.db`
    await saveDataset(demoFileName, 'mock_invoices.xlsx', fs.statSync(filePath).size, metadata);
    console.log(`🗄️ Registered demo dataset in Single Unified SQLite Database.`);

    res.json({
      success: true,
      filename: demoFileName,
      originalName: 'mock_invoices.xlsx',
      size: fs.statSync(filePath).size,
      metadata: metadata,
      primaryDatabase: 'SQLite (Single Unified Database)'
    });
  } catch (error) {
    console.error("Demo load error:", error);
    res.status(500).json({ error: error.message || 'Internal server error during demo load.' });
  }
});

/**
 * Endpoint: POST /api/query
 * Analyzes spreadsheet and logs query execution history in single SQLite database.
 */
app.post('/api/query', async (req, res) => {
  const { filename, activeSheet, query, history } = req.body;
  
  if (!filename || !query || !activeSheet) {
    return res.status(400).json({ error: 'Missing required parameters (filename, activeSheet, or query).' });
  }
  
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Spreadsheet file not found on server. Please upload again.' });
  }

  try {
    const analysisResult = await analyzeData(filePath, activeSheet, query, history || []);
    
    // Save prompt and analysis output into SQLite chat_history table
    try {
      await saveQueryHistory(
        filename,
        activeSheet,
        query,
        analysisResult.textResponse,
        analysisResult.tableData,
        analysisResult.tableColumns,
        analysisResult.hasChart,
        analysisResult.chartUrl
      );
      console.log(`🗄️ Saved query result to SQLite Database for file: ${filename}`);
    } catch (dbErr) {
      console.error("SQLite save query error:", dbErr);
    }

    res.json(analysisResult);
  } catch (error) {
    console.error("Query execution error:", error);
    res.status(500).json({ 
      error: error.message || 'An error occurred while analyzing the dataset. Please refine your query.' 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`AI Excel Analyst Server running on port ${PORT} with SQLite as Single Unified Database`);
});
