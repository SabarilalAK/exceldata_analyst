import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getExcelMetadata, analyzeData } from './utils.js';
import { saveDataset, getDatasets, getDatasetHistory, saveQueryHistory, createSeparateDatabaseFile } from './database.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __dirname = path.resolve();
const uploadDir = path.join(__dirname, 'uploads');
const chartsDir = path.join(__dirname, 'charts');
const tempDir = path.join(__dirname, 'temp');

[uploadDir, chartsDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf', '.docx', '.doc', '.json', '.txt', '.tsv'];

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type '${ext}'. Supported formats: Excel (.xlsx, .xls), CSV/TSV (.csv, .tsv, .txt), PDF (.pdf), Word (.docx, .doc), and JSON (.json).`));
    }
  }
});

app.use('/api/charts', express.static(chartsDir));

app.get('/api/db-status', (req, res) => {
  res.json({
    connected: true,
    isPrimaryDb: true,
    mode: 'SQLite (Standalone Database File per Dataset)'
  });
});

app.get('/api/firebase-status', (req, res) => {
  res.json({
    connected: true,
    isPrimaryDb: true,
    mode: 'SQLite (Standalone Database File per Dataset)'
  });
});

app.get('/api/datasets', async (req, res) => {
  try {
    const datasets = await getDatasets();
    res.json({ success: true, datasets });
  } catch (error) {
    console.error("Error reading datasets from SQLite:", error);
    res.status(500).json({ error: error.message });
  }
});

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

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    console.log(`Uploaded document stored at: ${filePath}`);
    
    const metadata = await getExcelMetadata(filePath);
    
    if (metadata.error) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: `Could not parse document: ${metadata.error}` });
    }

    // 1. Create isolated, standalone .db database file for this uploaded dataset
    const defaultSheet = metadata.defaultSheet || 'Sheet1';
    const sheetInfo = metadata.sheets ? metadata.sheets[defaultSheet] : null;
    let sepDbResult = null;
    if (sheetInfo && sheetInfo.columns) {
      sepDbResult = await createSeparateDatabaseFile(req.file.filename, sheetInfo.columns, sheetInfo.preview);
    }

    // 2. Register dataset in master system database
    await saveDataset(req.file.filename, req.file.originalname, req.file.size, metadata, sepDbResult?.dbFileName || '');

    console.log(`🗄️ Created standalone dataset database file '${sepDbResult?.dbFileName}'`);

    res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      metadata: metadata,
      separateDbFile: sepDbResult?.dbFileName,
      primaryDatabase: `SQLite (backend/database/${sepDbResult?.dbFileName})`
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message || 'Internal server error during upload.' });
  }
});

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

    const defaultSheet = metadata.defaultSheet || 'Invoices';
    const sheetInfo = metadata.sheets ? metadata.sheets[defaultSheet] : null;
    let sepDbResult = null;
    if (sheetInfo && sheetInfo.columns) {
      sepDbResult = await createSeparateDatabaseFile(demoFileName, sheetInfo.columns, sheetInfo.preview);
    }

    await saveDataset(demoFileName, 'mock_invoices.xlsx', fs.statSync(filePath).size, metadata, sepDbResult?.dbFileName || '');

    res.json({
      success: true,
      filename: demoFileName,
      originalName: 'mock_invoices.xlsx',
      size: fs.statSync(filePath).size,
      metadata: metadata,
      separateDbFile: sepDbResult?.dbFileName,
      primaryDatabase: `SQLite (backend/database/${sepDbResult?.dbFileName})`
    });
  } catch (error) {
    console.error("Demo load error:", error);
    res.status(500).json({ error: error.message || 'Internal server error during demo load.' });
  }
});

app.post('/api/query', async (req, res) => {
  const { filename, activeSheet, query, history } = req.body;
  
  if (!filename || !query || !activeSheet) {
    return res.status(400).json({ error: 'Missing required parameters (filename, activeSheet, or query).' });
  }
  
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document file not found on server. Please upload again.' });
  }

  try {
    const analysisResult = await analyzeData(filePath, activeSheet, query, history || []);
    
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
    } catch (dbErr) {
      console.error("SQLite save query error:", dbErr);
    }

    res.json(analysisResult);
  } catch (error) {
    console.error("Query execution error:", error);
    res.status(500).json({ 
      error: error.message || 'An error occurred while analyzing the document. Please refine your query.' 
    });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`AI Multi-Format Analyst Server running on port ${PORT} with SQLite (Standalone Database File per Dataset)`);
});
