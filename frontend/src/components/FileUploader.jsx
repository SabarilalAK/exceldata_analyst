import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../api';

export default function FileUploader({ onUploadSuccess }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    
    // Check extension
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      setError("Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Failed to upload spreadsheet.');
      }

      const data = await response.json();
      onUploadSuccess(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error uploading file. Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const loadDemoDataset = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/load-demo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Failed to load demo dataset.');
      }

      const data = await response.json();
      onUploadSuccess(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not load demo dataset. Make sure the server generated mock invoices first.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div 
        className="glass-panel" 
        style={{
          ...styles.dropZone,
          borderColor: isDragActive ? 'var(--primary)' : 'var(--border)',
          boxShadow: isDragActive ? 'var(--shadow-neon)' : 'var(--shadow-md)',
          background: isDragActive ? 'rgba(139, 92, 246, 0.05)' : 'var(--bg-panel)'
        }}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          style={{ display: 'none' }}
          accept=".xlsx,.xls,.csv"
          onChange={handleChange}
        />
        
        {loading ? (
          <div style={styles.loadingContainer}>
            <Loader2 className="animate-spin" size={48} color="var(--primary)" />
            <h3 style={styles.loadingText}>Processing Spreadsheet...</h3>
            <p style={styles.subtext}>Reading sheets, columns, and parsing table schema...</p>
          </div>
        ) : (
          <div style={styles.content}>
            <div style={styles.iconCircle}>
              <UploadCloud size={32} color="var(--primary)" />
            </div>
            <h2 style={styles.title}>AI Excel Data Analyst</h2>
            <p style={styles.subtext}>
              Drag and drop your spreadsheet here, or{' '}
              <span onClick={onButtonClick} style={styles.browseLink}>browse files</span>
            </p>
            <p style={styles.formatText}>Supports Excel (.xlsx, .xls) and CSV (.csv) formats</p>
            
            <div style={styles.divider}>
              <span style={styles.dividerLine}></span>
              <span style={styles.dividerText}>OR</span>
              <span style={styles.dividerLine}></span>
            </div>

            <button 
              className="btn-primary" 
              onClick={loadDemoDataset}
              style={styles.demoBtn}
            >
              <Sparkles size={16} />
              Load Sample Invoice Dataset (5k records)
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={styles.errorAlert}>
          <AlertCircle size={18} color="var(--accent-red)" style={{ flexShrink: 0 }} />
          <span style={styles.errorText}>{error}</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '640px',
    padding: '20px',
  },
  dropZone: {
    width: '100%',
    padding: '48px 32px',
    textAlign: 'center',
    cursor: 'pointer',
    borderStyle: 'dashed',
    borderWidth: '2px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '1.5rem',
    marginBottom: '8px',
    background: 'linear-gradient(to right, #ffffff, #c7d2fe)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtext: {
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    marginBottom: '8px',
  },
  browseLink: {
    color: 'var(--primary)',
    fontWeight: '600',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  formatText: {
    color: 'var(--text-dark)',
    fontSize: '0.8rem',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    width: '80%',
    margin: '24px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'var(--border)',
  },
  dividerText: {
    padding: '0 12px',
    fontSize: '0.75rem',
    color: 'var(--text-dark)',
    fontWeight: '600',
  },
  demoBtn: {
    width: '100%',
    maxWidth: '380px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px',
  },
  loadingText: {
    fontSize: '1.2rem',
    marginTop: '16px',
    marginBottom: '8px',
    color: 'white',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    padding: '12px 16px',
    borderRadius: '10px',
    marginTop: '16px',
    width: '100%',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: '0.875rem',
    textAlign: 'left',
  }
};
