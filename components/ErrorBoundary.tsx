import React, { ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 text-white text-center font-mono">
          <div className="border-4 border-red-600 p-8 bg-black max-w-2xl w-full shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-red-600 animate-pulse"></div>
             <h1 className="text-4xl text-red-500 mb-6 font-bold tracking-widest uppercase glitch-text">SYSTEM FAILURE</h1>
             <p className="mb-6 text-gray-300">The simulation encountered a critical breach.</p>
             
             <div className="bg-gray-900 p-4 rounded border border-gray-700 mb-8 max-h-48 overflow-auto text-left">
                <code className="text-xs text-red-400 font-mono">
                 {this.state.error?.message || "Unknown Error"}
                 <br/>
                 {this.state.error?.stack}
                </code>
             </div>
             
             <button
               className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white uppercase font-bold tracking-wider transition-all hover:scale-105"
               onClick={() => window.location.reload()}
             >
               REBOOT SYSTEM
             </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
