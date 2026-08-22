import React from 'react';
import { Table, Layers, FileText, Info } from 'lucide-react';

export default function DataViewer({ metadata, activeSheet, onSheetChange }) {
  if (!metadata || !metadata.sheets) return null;

  const sheets = Object.keys(metadata.sheets);
  const activeSheetData = metadata.sheets[activeSheet] || metadata.sheets[sheets[0]];
  const columns = activeSheetData.columns || [];
  const previewData = activeSheetData.preview || [];
  const totalRows = activeSheetData.rowCount || 0;

  return (
    <div style={styles.container}>
      {/* Sheet Tabs */}
      {sheets.length > 1 && (
        <div style={styles.sheetTabs}>
          <span style={styles.sheetLabel}>
            <Layers size={14} color="var(--text-muted)" />
            Workbook Sheets:
          </span>
          {sheets.map((sheetName) => (
            <button
              key={sheetName}
              onClick={() => onSheetChange(sheetName)}
              style={{
                ...styles.sheetTabBtn,
                color: activeSheet === sheetName ? 'white' : 'var(--text-muted)',
                background: activeSheet === sheetName ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                borderColor: activeSheet === sheetName ? 'var(--primary)' : 'var(--border)'
              }}
            >
              <FileText size={14} />
              {sheetName}
            </button>
          ))}
        </div>
      )}

      {/* Dataset Summary Stats */}
      <div className="glass-panel" style={styles.statsPanel}>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Active Sheet</span>
          <span style={styles.statValue}>{activeSheet}</span>
        </div>
        <div style={styles.divider}></div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Total Record Count</span>
          <span style={styles.statValue}>{totalRows.toLocaleString()} rows</span>
        </div>
        <div style={styles.divider}></div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Data Attributes</span>
          <span style={styles.statValue}>{columns.length} columns</span>
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div style={styles.gridHeader}>
        <h3 style={styles.gridTitle}>Spreadsheet Preview</h3>
        <span style={styles.gridBadge}>
          <Info size={12} />
          Showing first 10 rows
        </span>
      </div>

      <div className="table-container" style={styles.tableWrapper}>
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center', backgroundColor: '#131326' }}>#</th>
              {columns.map((col) => (
                <th key={col}>
                  <div style={styles.thContent}>
                    <span>{col}</span>
                    <span style={styles.dataType}>
                      {activeSheetData.dtypes[col] || 'object'}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewData.length > 0 ? (
              previewData.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.01)', fontWeight: 'bold' }}>
                    {idx + 1}
                  </td>
                  {columns.map((col) => {
                    const val = row[col];
                    const isStatus = col.toLowerCase() === 'status';
                    
                    return (
                      <td key={col}>
                        {isStatus ? (
                          <span className={`badge badge-${val?.toString().toLowerCase().replace(' ', '')}`}>
                            {val}
                          </span>
                        ) : (
                          formatValue(val, col)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '24px' }}>
                  No data preview available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Simple formatter for display
function formatValue(val, colName) {
  if (val === null || val === undefined) return '-';
  
  const colLower = colName.toLowerCase();
  
  // Format numeric values
  if (typeof val === 'number') {
    if (colLower.includes('amount') || colLower.includes('value') || colLower.includes('balance') || colLower.includes('invoiced') || colLower.includes('paid') || colLower.includes('outstanding')) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    return val.toLocaleString();
  }
  
  return val.toString();
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '24px',
    overflowY: 'auto'
  },
  sheetTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '20px'
  },
  sheetLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginRight: '8px',
    fontWeight: '500'
  },
  sheetTabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  statsPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '16px 24px',
    marginBottom: '24px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)'
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  statValue: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'white',
    fontFamily: 'var(--font-display)'
  },
  divider: {
    width: '1px',
    height: '32px',
    background: 'var(--border)'
  },
  gridHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  gridTitle: {
    fontSize: '1.1rem',
    color: 'white'
  },
  gridBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  tableWrapper: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 320px)'
  },
  thContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  dataType: {
    fontSize: '0.65rem',
    color: 'var(--text-dark)',
    textTransform: 'lowercase',
    fontFamily: 'var(--font-mono)'
  }
};
