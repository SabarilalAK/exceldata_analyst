import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, MessageSquare, Table, BarChart3, 
  Sparkles, FileText, RefreshCw, XCircle, Info, Database 
} from 'lucide-react';
import FileUploader from './components/FileUploader';
import ChatInterface from './components/ChatInterface';
import DataViewer from './components/DataViewer';
import Dashboard from './components/Dashboard';
import { API_BASE_URL } from './api';

export default function App() {
  const [fileInfo, setFileInfo] = useState(null);
  const [activeSheet, setActiveSheet] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'data', 'charts'
  const [charts, setCharts] = useState([]);
  const [dbStatus, setDbStatus] = useState({ connected: false, mode: 'Connecting...' });

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/db-status`)
      .then(res => res.json())
      .then(data => setDbStatus(data))
      .catch(() => setDbStatus({ connected: true, mode: 'SQLite (Single Unified Database)' }));
  }, []);

  const handleUploadSuccess = (data) => {
    setFileInfo(data);
    setActiveSheet(data.metadata.defaultSheet);
    setActiveTab('chat');
    setCharts([]);
  };

  const handleReset = () => {
    setFileInfo(null);
    setActiveSheet('');
    setActiveTab('chat');
    setCharts([]);
  };

  const handleAddChart = (newChart) => {
    setCharts(prev => [...prev, newChart]);
  };

  // Helper to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="app-container">
      {!fileInfo ? (
        // 1. Upload View
        <div style={styles.uploadWrapper}>
          <div style={styles.brandingHeader}>
            <div className="logo-icon">📊</div>
            <h1 style={styles.brandingTitle}>AI-POWERED EXCEL ANALYST</h1>
            <p style={styles.brandingSub}>Upload any business spreadsheet to query payments, outstanding balances, and generate instant dashboards using AI & SQLite Database.</p>
            
            <div style={styles.dbBadge}>
              <Database size={14} color="#10b981" />
              <span>Database: <strong>{dbStatus.mode}</strong></span>
            </div>
          </div>
          
          <FileUploader onUploadSuccess={handleUploadSuccess} />
        </div>
      ) : (
        // 2. Dashboard Interface
        <>
          {/* Sidebar */}
          <div className="sidebar">
            <div className="logo-container">
              <div className="logo-icon">📊</div>
              <div className="logo-text">
                <h1>Excel Analyst</h1>
                <p>AI & SQLite Workspace</p>
              </div>
            </div>

            {/* File info card */}
            <div className="glass-panel" style={styles.fileCard}>
              <div style={styles.fileHeader}>
                <FileSpreadsheet size={20} color="var(--primary)" />
                <h4 style={styles.fileName} title={fileInfo.originalName}>
                  {fileInfo.originalName}
                </h4>
              </div>
              <div style={styles.fileDetails}>
                <div style={styles.detailRow}>
                  <span>Size</span>
                  <strong>{formatFileSize(fileInfo.size)}</strong>
                </div>
                <div style={styles.detailRow}>
                  <span>Active Sheet</span>
                  <strong style={{ color: 'var(--secondary)' }}>{activeSheet}</strong>
                </div>
                <div style={styles.detailRow}>
                  <span>Database</span>
                  <strong style={{ color: '#10b981', fontSize: '0.75rem' }}>
                    {dbStatus.mode}
                  </strong>
                </div>
              </div>
              
              <button onClick={handleReset} style={styles.resetBtn}>
                <XCircle size={14} />
                Close File & Reset
              </button>
            </div>

            {/* Sidebar Guidelines */}
            <div style={styles.infoBox}>
              <h5 style={styles.infoTitle}>
                <Info size={14} color="var(--secondary)" />
                Tips
              </h5>
              <p style={styles.infoText}>
                All datasets, table schemas, and query logs are stored in a single SQLite database (excel_analyst.db).
              </p>
            </div>
            
            <div style={styles.footer}>
              <span>Powered by Single SQLite Database & AI</span>
            </div>
          </div>

          {/* Main workspace */}
          <div className="main-content">
            {/* Top Navigation Tabs */}
            <div style={styles.topNav}>
              <div style={styles.tabContainer}>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                >
                  <MessageSquare size={16} />
                  Chat Analysis
                </button>
                <button
                  onClick={() => setActiveTab('data')}
                  className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
                >
                  <Table size={16} />
                  Spreadsheet View
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
                >
                  <BarChart3 size={16} />
                  Visualizations ({charts.length})
                </button>
              </div>
            </div>

            {/* Main view panel */}
            <div style={styles.viewPanel}>
              {activeTab === 'chat' && (
                <ChatInterface 
                  filename={fileInfo.filename} 
                  activeSheet={activeSheet}
                  onAddChart={handleAddChart}
                />
              )}
              {activeTab === 'data' && (
                <DataViewer 
                  metadata={fileInfo.metadata} 
                  activeSheet={activeSheet}
                  onSheetChange={setActiveSheet}
                />
              )}
              {activeTab === 'charts' && (
                <Dashboard charts={charts} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  uploadWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100vh',
    padding: '24px'
  },
  brandingHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '24px',
    maxWidth: '560px'
  },
  brandingTitle: {
    fontSize: '2rem',
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
    background: 'linear-gradient(to right, #ffffff, var(--primary), var(--secondary))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginTop: '16px',
    marginBottom: '8px',
    letterSpacing: '-0.03em'
  },
  brandingSub: {
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    marginBottom: '12px'
  },
  dbBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border)',
    fontSize: '0.8rem',
    color: 'var(--text-muted)'
  },
  fileCard: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: 'rgba(255, 255, 255, 0.02)',
    marginBottom: '24px'
  },
  fileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '10px'
  },
  fileName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'white',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1
  },
  fileDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '0.8rem'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'var(--text-muted)'
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    background: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--accent-red)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    padding: '8px',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
    transition: 'all 0.2s ease',
    ':hover': {
      background: 'rgba(239, 68, 68, 0.2)'
    }
  },
  infoBox: {
    background: 'rgba(6, 182, 212, 0.03)',
    border: '1px solid rgba(6, 182, 212, 0.1)',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: 'auto'
  },
  infoTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--secondary)',
    fontSize: '0.85rem',
    fontWeight: '600',
    marginBottom: '6px'
  },
  infoText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4'
  },
  footer: {
    fontSize: '0.7rem',
    color: 'var(--text-dark)',
    textAlign: 'center',
    borderTop: '1px solid var(--border)',
    paddingTop: '12px'
  },
  topNav: {
    padding: '16px 24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(6, 6, 12, 0.2)',
    backdropFilter: 'blur(4px)'
  },
  tabContainer: {
    display: 'flex',
    gap: '12px',
  },
  viewPanel: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative'
  }
};
