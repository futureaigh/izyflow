import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  isQuotaError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isQuotaError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, isQuotaError: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    try {
      const parsedError = JSON.parse(error.message);
      this.setState({ errorInfo: JSON.stringify(parsedError, null, 2) });
      
      // Check for quota error
      if (parsedError.error && parsedError.error.includes('Quota limit exceeded')) {
        this.setState({ isQuotaError: true });
      }
    } catch (e) {
      this.setState({ errorInfo: error.message });
      if (error.message.includes('Quota limit exceeded')) {
        this.setState({ isQuotaError: true });
      }
    }
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-2xl w-full space-y-8 text-center">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-destructive/10">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tight text-foreground">
                {this.state.isQuotaError ? 'Daily Limit Reached' : 'Oops! Something went wrong'}
              </h1>
              <p className="text-xl text-muted-foreground">
                {this.state.isQuotaError 
                  ? "Your application has reached the free daily limit for database reads. This resets automatically every 24 hours (at midnight Pacific Time)."
                  : "We encountered an unexpected error. This might be due to a connection issue or a configuration problem."}
              </p>
              {this.state.isQuotaError && (
                <div className="space-y-4">
                  <div className="bg-indigo-600/10 border border-indigo-600/20 p-6 rounded-2xl text-indigo-600 text-sm font-medium mt-4 text-left">
                    <p className="font-bold mb-2">Why am I seeing this on the Blaze plan?</p>
                    <p className="mb-4">If you have already upgraded to the Blaze plan, you might have a <strong>"Usage Cap"</strong> or <strong>"Budget Limit"</strong> set in your Google Cloud Console that is stopping services once a certain amount is spent.</p>
                    <p className="font-bold mb-1">How to fix:</p>
                    <ol className="list-decimal ml-5 space-y-1">
                      <li>Go to the <strong>Google Cloud Console</strong> &gt; <strong>Billing</strong> &gt; <strong>Budgets & Alerts</strong>.</li>
                      <li>Check if there is a budget with <strong>"Disconnect services when budget is reached"</strong> enabled.</li>
                      <li>Either increase the budget or uncheck that option to allow the Blaze plan to scale.</li>
                    </ol>
                  </div>
                  <div className="bg-amber-600/10 border border-amber-600/20 p-4 rounded-2xl text-amber-700 text-sm font-medium">
                    If you haven't upgraded yet, you can do so in the Firebase Console to remove the 50,000 daily read limit.
                  </div>
                </div>
              )}
            </div>

            {this.state.errorInfo && (
              <div className="mt-8 p-6 rounded-3xl bg-card border border-border text-left overflow-auto max-h-[300px]">
                <p className="text-sm font-bold text-muted-foreground mb-2 uppercase tracking-widest">Error Details</p>
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                  {this.state.errorInfo}
                </pre>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
              <Button
                onClick={this.handleReset}
                className="h-14 px-8 rounded-2xl bg-indigo-600 font-black text-lg text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                Reload Application
              </Button>
              <Button
                variant="outline"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="h-14 px-8 rounded-2xl border-border bg-background font-bold text-foreground hover:bg-accent transition-all active:scale-[0.98]"
              >
                Try Again
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground pt-8">
              If the problem persists, please contact support with the error details shown above.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
