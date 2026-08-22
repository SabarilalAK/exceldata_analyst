import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Sparkles, Image, RefreshCw, AlertCircle, FileSpreadsheet, 
  Eye, Download, FileCode, Table as TableIcon, FileText, Printer 
} from 'lucide-react';
import { API_BASE_URL } from '../api';

const SUGGESTED_PROMPTS = [
  "Generate a pie chart of invoice status distribution — Paid, Overdue, etc.",
  "Identify the top 10 customers by total invoice value.",
  "Generate a pie chart based on overdue-day ranges.",
  "Calculate total invoiced, paid and outstanding amounts.",
  "Compare invoice breakdown across categories and cities."
];

export default function ChatInterface({ filename, activeSheet, onAddChart }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      if (!filename) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/datasets/${filename}/history`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.history && data.history.length > 0 && isMounted) {
            const formatted = [];
            data.history.forEach(item => {
              formatted.push({ role: 'user', text: item.query });
              formatted.push({
                role: 'assistant',
                text: item.textResponse,
                tableData: item.tableData,
                tableColumns: item.tableColumns,
                chartUrl: item.chartUrl ? `${API_BASE_URL}${item.chartUrl}` : null
              });
              if (item.hasChart && item.chartUrl) {
                onAddChart({
                  id: Date.now() + Math.random(),
                  title: item.query,
                  url: `${API_BASE_URL}${item.chartUrl}`
                });
              }
            });
            setMessages(formatted);
          }
        }
      } catch (err) {
        console.warn("Could not load chat history:", err);
      }
    }
    loadHistory();
    return () => { isMounted = false; };
  }, [filename]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text) => {
    if (!text.trim() || loading) return;
    
    setError(null);
    setInput('');
    
    const userMessage = { role: 'user', text: text };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    const history = messages.map(m => ({ role: m.role, text: m.text }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename,
          activeSheet,
          query: text,
          history: history
        })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Server returned an error.');
      }

      const data = await response.json();
      
      const botMessage = {
        role: 'assistant',
        text: data.textResponse,
        tableData: data.tableData,
        tableColumns: data.tableColumns,
        chartUrl: data.chartUrl ? `${API_BASE_URL}${data.chartUrl}` : null
      };

      setMessages(prev => [...prev, botMessage]);
      
      if (data.hasChart && data.chartUrl) {
        onAddChart({
          id: Date.now(),
          title: text,
          url: `${API_BASE_URL}${data.chartUrl}`
        });
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to analyze data.');
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: "Sorry, I encountered an error while trying to process your request. Make sure your dataset aligns with the query.",
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  // Multi-Format Data & Report Export Functions
  const exportPDFReport = (msg, defaultTitle = 'AI_Analysis_Report') => {
    const printWindow = window.open('', '_blank');
    const chartHtml = msg.chartUrl ? `
      <div style="margin-top: 25px; text-align: center;">
        <h3 style="color:#475569;margin-bottom:10px;">Generated Analysis Pie Chart</h3>
        <img src="${msg.chartUrl}" style="max-width: 90%; max-height: 420px; border-radius: 12px; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
      </div>
    ` : '';
    
    let tableHtml = '';
    if (msg.tableData && msg.tableColumns) {
      const headers = msg.tableColumns.map(c => `<th style="background:#8b5cf6;color:#ffffff;padding:10px;border:1px solid #cbd5e1;text-align:left;">${c}</th>`).join('');
      const rows = msg.tableData.map(r => `<tr>${msg.tableColumns.map(c => `<td style="padding:8px 10px;border:1px solid #cbd5e1;">${r[c] ?? '-'}</td>`).join('')}</tr>`).join('');
      tableHtml = `
        <h3 style="color:#475569;margin-top:20px;">Analyzed Summary Data Table</h3>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      `;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${defaultTitle}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; color: #1e293b; line-height: 1.6; }
          h1 { color: #7c3aed; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; font-size: 24px; }
          .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
          .content { background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>📊 AI Excel & Data Analytics Report</h1>
        <div class="meta">Generated by AI Universal Analyst | ${new Date().toLocaleString()}</div>
        <div class="content">${formatMarkdown(msg.text)}</div>
        ${tableHtml}
        ${chartHtml}
        <script>
          setTimeout(() => { window.print(); }, 600);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const exportWordReport = (msg, defaultTitle = 'AI_Analysis_Report') => {
    const chartHtml = msg.chartUrl ? `
      <p align="center" style="margin-top:20px;">
        <h3>Generated Analysis Pie Chart</h3>
        <img src="${msg.chartUrl}" width="550" />
      </p>
    ` : '';
    
    let tableHtml = '';
    if (msg.tableData && msg.tableColumns) {
      const headers = msg.tableColumns.map(c => `<th style="background-color:#8b5cf6;color:#ffffff;padding:8px;border:1px solid #cccccc;">${c}</th>`).join('');
      const rows = msg.tableData.map(r => `<tr>${msg.tableColumns.map(c => `<td style="padding:8px;border:1px solid #cccccc;">${r[c] ?? '-'}</td>`).join('')}</tr>`).join('');
      tableHtml = `<br/><h3>Summary Table</h3><table border="1" style="width:100%;border-collapse:collapse;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }

    const wordContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><title>${defaultTitle}</title><style>body{font-family:Arial;line-height:1.5;}</style></head>
      <body>
        <h2 style="color:#7c3aed;">AI Universal Analytics Report</h2>
        <p style="color:#666666;font-size:12px;">Generated on ${new Date().toLocaleString()}</p>
        <hr/>
        <div>${formatMarkdown(msg.text)}</div>
        ${tableHtml}
        ${chartHtml}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + wordContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    downloadFile(url, `${defaultTitle}.doc`);
  };

  const exportCSV = (data, columns, defaultName = 'analysis_export.csv') => {
    if (!data || !columns) return;
    const headers = columns.join(',');
    const rows = data.map(row => columns.map(col => `"${(row[col] ?? '').toString().replace(/"/g, '""')}"`).join(','));
    const content = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers, ...rows].join('\n'));
    downloadFile(content, defaultName);
  };

  const exportExcel = (data, columns, defaultName = 'analysis_export.xls') => {
    if (!data || !columns) return;
    const headers = columns.join('\t');
    const rows = data.map(row => columns.map(col => (row[col] ?? '').toString().replace(/\t/g, ' ')).join('\t'));
    const content = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent([headers, ...rows].join('\n'));
    downloadFile(content, defaultName);
  };

  const exportJSON = (data, defaultName = 'analysis_export.json') => {
    if (!data) return;
    const content = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    downloadFile(content, defaultName);
  };

  const downloadFile = (uri, filename) => {
    const link = document.createElement('a');
    link.href = uri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatMarkdown = (text) => {
    if (!text) return '';
    
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    html = html.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/^\s*[\-\*]\s+(.*?)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*?<\/li>\s*)+)/gs, '<ul>$1</ul>');

    const paragraphs = html.split(/\n\n+/);
    const parsed = paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    });

    return parsed.join('');
  };

  return (
    <div style={styles.chatContainer}>
      <div style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div style={styles.welcomeContainer}>
            <div style={styles.welcomeIcon}>
              <Sparkles size={28} color="var(--primary)" />
            </div>
            <h2 style={styles.welcomeTitle}>AI Universal Document Analyst Ready</h2>
            <p style={styles.welcomeText}>
              I have loaded your document and analyzed sheet/section <strong>"{activeSheet}"</strong>.
              Ask any questions, generate pie charts, and export reports directly to PDF, Word, Excel, CSV, or JSON.
            </p>

            <div style={styles.suggestionTitle}>Suggested Queries:</div>
            <div style={styles.suggestionsGrid}>
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSend(prompt)}
                  style={styles.suggestionBtn}
                  className="glass-panel"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              style={{
                ...styles.messageRow,
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div 
                className="glass-panel"
                style={{
                  ...styles.messageBubble,
                  background: msg.role === 'user' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-panel)',
                  borderColor: msg.role === 'user' ? 'var(--primary-glow)' : 'var(--border)'
                }}
              >
                <div 
                  className="markdown-content"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text) }} 
                  style={{
                    color: msg.isError ? '#fca5a5' : 'var(--text-main)'
                  }}
                />

                {/* Multi-Format Export Bar (PDF with Pie Chart, Word with Pie Chart, Excel, CSV, JSON) */}
                {msg.role === 'assistant' && !msg.isError && (
                  <div style={styles.exportBar}>
                    <span style={styles.exportLabel}>
                      <Download size={13} color="var(--secondary)" />
                      Export Report & Pie Chart:
                    </span>
                    
                    <button onClick={() => exportPDFReport(msg)} style={{...styles.exportBtn, background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)'}}>
                      <Printer size={12} color="#fca5a5" /> PDF Report + Pie Chart
                    </button>
                    
                    <button onClick={() => exportWordReport(msg)} style={{...styles.exportBtn, background: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.4)'}}>
                      <FileText size={12} color="#93c5fd" /> Word (.doc) + Pie Chart
                    </button>

                    {msg.tableData && msg.tableData.length > 0 && (
                      <>
                        <button onClick={() => exportExcel(msg.tableData, msg.tableColumns)} style={styles.exportBtn}>
                          <FileSpreadsheet size={12} /> Excel (.xls)
                        </button>
                        <button onClick={() => exportCSV(msg.tableData, msg.tableColumns)} style={styles.exportBtn}>
                          <TableIcon size={12} /> CSV
                        </button>
                        <button onClick={() => exportJSON(msg.tableData)} style={styles.exportBtn}>
                          <FileCode size={12} /> JSON
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Inline Tables */}
                {msg.tableData && msg.tableData.length > 0 && (
                  <div style={styles.tableBlock}>
                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            {msg.tableColumns.map((col, idx) => (
                              <th key={idx}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.tableData.map((row, rowIdx) => (
                            <tr key={rowIdx}>
                              {msg.tableColumns.map((col, colIdx) => {
                                const val = row[col];
                                const isStatus = col.toLowerCase() === 'status';
                                return (
                                  <td key={colIdx}>
                                    {isStatus ? (
                                      <span className={`badge badge-${val?.toString().toLowerCase().replace(' ', '')}`}>
                                        {val}
                                      </span>
                                    ) : (
                                      formatTableCell(val, col)
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Inline Visualizations */}
                {msg.chartUrl && (
                  <div style={styles.chartBlock}>
                    <div style={styles.chartHeader}>
                      <span style={styles.chartHeaderTitle}>
                        <Image size={14} color="var(--secondary)" />
                        Generated Analysis Pie Chart
                      </span>
                      <a href={msg.chartUrl} target="_blank" rel="noopener noreferrer" style={styles.zoomLink}>
                        <Eye size={12} /> View Full Chart
                      </a>
                    </div>
                    <img 
                      src={msg.chartUrl} 
                      alt="Data Analysis Pie Chart" 
                      style={styles.chartImage}
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
            <div className="glass-panel" style={styles.messageBubble}>
              <div style={styles.skeletonContainer}>
                <div className="animate-pulse" style={styles.skeletonTitle}></div>
                <div className="animate-pulse" style={styles.skeletonLine}></div>
                <div className="animate-pulse" style={{ ...styles.skeletonLine, width: '60%' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      <div style={styles.inputArea}>
        <div className="glass-panel" style={styles.inputWrapper}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={`Ask a question about "${activeSheet}"...`}
            rows={1}
            style={styles.textarea}
            disabled={loading}
          />
          <button
            onClick={() => handleSend(input)}
            style={{
              ...styles.sendBtn,
              background: input.trim() ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
              cursor: input.trim() && !loading ? 'pointer' : 'default'
            }}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={18} color="white" />
            ) : (
              <Send size={18} color="white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTableCell(val, colName) {
  if (val === null || val === undefined) return '-';
  const name = colName.toLowerCase();
  
  if (typeof val === 'number') {
    if (name.includes('amount') || name.includes('value') || name.includes('balance') || name.includes('invoiced') || name.includes('paid') || name.includes('outstanding')) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    return val.toLocaleString();
  }
  return val.toString();
}

const styles = {
  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'relative'
  },
  messagesContainer: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    paddingBottom: '100px'
  },
  welcomeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: '600px',
    margin: '40px auto',
    padding: '24px'
  },
  welcomeIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'rgba(139, 92, 246, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    boxShadow: 'var(--shadow-neon)'
  },
  welcomeTitle: {
    fontSize: '1.4rem',
    marginBottom: '10px',
    color: 'white'
  },
  welcomeText: {
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
    marginBottom: '32px'
  },
  suggestionTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-dark)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '16px',
    width: '100%',
    textAlign: 'left'
  },
  suggestionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    width: '100%'
  },
  suggestionBtn: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: 'rgba(255,255,255,0.01)',
    fontWeight: '500',
    lineHeight: '1.4',
    ':hover': {
      color: 'white',
      borderColor: 'var(--primary)',
      background: 'rgba(139, 92, 246, 0.05)'
    }
  },
  messageRow: {
    display: 'flex',
    width: '100%'
  },
  messageBubble: {
    maxWidth: '80%',
    padding: '18px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    borderRadius: '16px',
    lineHeight: '1.6'
  },
  tableBlock: {
    marginTop: '16px',
    width: '100%',
    overflowX: 'auto'
  },
  exportBar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border)'
  },
  exportLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginRight: '4px'
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  chartBlock: {
    marginTop: '16px',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    background: 'rgba(255,255,255,0.02)'
  },
  chartHeaderTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: '600'
  },
  zoomLink: {
    color: 'var(--secondary)',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: '500'
  },
  chartImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
    maxHeight: '400px',
    objectFit: 'contain'
  },
  inputArea: {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    padding: '16px 24px 24px 24px',
    background: 'linear-gradient(to top, var(--bg-main) 70%, transparent)'
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: '14px',
    background: 'rgba(15, 15, 30, 0.8)',
    boxShadow: 'var(--shadow-lg)'
  },
  textarea: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: 'white',
    fontSize: '0.925rem',
    resize: 'none',
    outline: 'none',
    padding: '8px',
    fontFamily: 'var(--font-sans)',
    maxHeight: '120px'
  },
  sendBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  skeletonContainer: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  skeletonTitle: {
    height: '14px',
    background: 'rgba(255,255,255,0.06)',
    width: '40%',
    borderRadius: '4px'
  },
  skeletonLine: {
    height: '10px',
    background: 'rgba(255,255,255,0.04)',
    width: '100%',
    borderRadius: '3px'
  }
};
