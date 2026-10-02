import React, { Component, ErrorInfo, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";

const queryClient = new QueryClient();

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppleErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AppleErrorBoundary] Uncaught game error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem("meteorSplit_pendingSlowMo");
      localStorage.removeItem("meteorSplit_tutorialSeen");
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#07112a] text-white select-none">
          <div className="w-full max-w-md p-6 rounded-3xl apple-bento-tile text-center space-y-4 border border-white/10 shadow-2xl backdrop-blur-2xl bg-white/[0.04]">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center bg-sky-500/10 border border-sky-400/20 text-sky-400 text-3xl">
              ☄
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent uppercase">
                Meteor Split Mania
              </h1>
              <p className="text-xs text-slate-300/80 mt-1">
                A cosmic disturbance occurred. Your saved high scores and skins remain preserved.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] font-mono text-amber-300 text-left overflow-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl font-semibold text-xs tracking-wider uppercase bg-sky-500 hover:bg-sky-400 active:scale-98 transition text-white shadow-lg shadow-sky-500/20"
              >
                Resume Game
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 rounded-xl text-xs tracking-wider uppercase bg-white/5 hover:bg-white/10 text-slate-300 transition border border-white/10"
              >
                Safe Reboot
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <AppleErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/index.html" element={<Index />} />
            <Route path="*" element={<Index />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppleErrorBoundary>
);

export default App;
