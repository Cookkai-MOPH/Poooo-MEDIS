import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded p-6">
            <div className="flex items-center gap-3 text-[#DC2626] mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="font-display text-lg font-semibold text-[#0D1C2E]">
                ไม่สามารถโหลดข้อมูลระบบได้
              </h2>
            </div>
            <p className="text-sm text-[#3E4946] leading-relaxed mb-5 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D7A68] text-white text-sm font-medium rounded hover:bg-[#075E54] transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              โหลดหน้าใหม่
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
