import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#07090f', color: '#f77171', height: '100vh', overflow: 'auto' }}>
          <div style={{ fontSize: 18, marginBottom: 16, color: '#f0b429' }}>RENDER ERROR — copy this and share it</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>
            {this.state.err.toString()}{'\n\n'}{this.state.err.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App /></ErrorBoundary>
)
