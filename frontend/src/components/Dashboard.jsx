import React from 'react';
import { Image, BarChart3, PieChart, LineChart, HelpCircle } from 'lucide-react';

export default function Dashboard({ charts }) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Visualizations Hub</h2>
        <p style={styles.subtitle}>Gallery of all generated charts and graphical analytics from this session.</p>
      </div>

      {charts.length === 0 ? (
        <div className="glass-panel" style={styles.emptyState}>
          <HelpCircle size={48} color="var(--primary)" style={{ opacity: 0.8 }} />
          <h3 style={styles.emptyTitle}>No Visualizations Generated Yet</h3>
          <p style={styles.emptyText}>
            Ask the AI Analyst to generate charts in the <strong>Chat Analysis</strong> tab. Try prompts like:
          </p>
          <div style={styles.tipsList}>
            <div style={styles.tipItem}>
              <BarChart3 size={16} color="var(--secondary)" />
              <span>"Generate a bar chart of invoice status"</span>
            </div>
            <div style={styles.tipItem}>
              <PieChart size={16} color="var(--accent-pink)" />
              <span>"Generate a pie chart based on overdue-day ranges"</span>
            </div>
            <div style={styles.tipItem}>
              <LineChart size={16} color="var(--accent-green)" />
              <span>"Compare invoice values across categories using a bar graph"</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {charts.map((chart) => (
            <div key={chart.id} className="glass-panel" style={styles.chartCard}>
              <div style={styles.cardHeader}>
                <h4 style={styles.cardTitle}>{chart.title}</h4>
              </div>
              <div style={styles.imageWrapper}>
                <img 
                  src={chart.url} 
                  alt={chart.title} 
                  style={styles.chartImage}
                  onClick={() => window.open(chart.url, '_blank')}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    height: '100%',
    overflowY: 'auto',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '1.4rem',
    color: 'white',
    marginBottom: '4px'
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: '500px',
    margin: '40px auto',
    padding: '32px',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    color: 'white',
    marginTop: '16px',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    marginBottom: '20px'
  },
  tipsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
    textAlign: 'left'
  },
  tipItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    fontSize: '0.85rem',
    color: 'var(--text-main)',
    fontWeight: '500'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: '24px',
  },
  chartCard: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '320px',
  },
  cardHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.01)'
  },
  cardTitle: {
    fontSize: '0.875rem',
    color: 'white',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  imageWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#12121e',
    overflow: 'hidden',
    cursor: 'pointer'
  },
  chartImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    transition: 'transform 0.3s ease',
    ':hover': {
      transform: 'scale(1.03)'
    }
  }
};
