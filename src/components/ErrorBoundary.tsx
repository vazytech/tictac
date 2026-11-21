import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = error.message || 'An unexpected application error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        displayMessage = `${parsed.operationType ? `${parsed.operationType.toUpperCase()}: ` : ''}${parsed.error}`;
      }
    } catch {
      // Non-JSON error message
    }
    return { hasError: true, message: displayMessage };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Tactix ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#EFECE2] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#FAF8F2] border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0F172A] p-8">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="font-display text-lg font-bold text-slate-900">
                System Error
              </h1>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed mb-6 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="font-display inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-bold border-2 border-slate-900 shadow-[3px_3px_0px_0px_#1D4ED8] hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Return to Lobby</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
