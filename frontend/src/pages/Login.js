import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { ArrowRight, BarChart3, Zap, Shield } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900" data-testid="login-page">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white font-['Manrope']">TokenLens</span>
            </div>
            <Button 
              onClick={login}
              data-testid="header-signin-button"
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-slate-800 text-sky-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            API Cost Intelligence for Dev Teams
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white font-['Manrope'] tracking-tight mb-6">
            Stop getting surprise<br />
            <span className="text-sky-400">AI API bills</span>
          </h1>
          
          <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
            Know exactly which feature and which user is driving your OpenAI and Anthropic costs. 
            One line of code. Full attribution.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              onClick={login}
              size="lg"
              data-testid="hero-signin-button"
              className="bg-sky-500 hover:bg-sky-600 text-white px-8 py-6 text-lg font-semibold"
            >
              Get Started with Google
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-24">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-6 h-6 text-sky-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 font-['Manrope']">Cost Attribution</h3>
            <p className="text-slate-400 text-sm">
              See exactly which feature is costing you the most. Break down by user, model, and time.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-sky-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 font-['Manrope']">One Line Change</h3>
            <p className="text-slate-400 text-sm">
              Just change your base URL. No SDK rewrites, no complex setup. Works in 60 seconds.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-sky-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 font-['Manrope']">Smart Alerts</h3>
            <p className="text-slate-400 text-sm">
              Get notified before costs spike. Set thresholds for daily spend, hourly spikes, and more.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-24 bg-slate-800/30 border border-slate-700 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white text-center mb-8 font-['Manrope']">How it works</h2>
          <div className="bg-slate-900 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-slate-300 font-['JetBrains_Mono']">
{`import openai

client = openai.OpenAI(
    api_key="sk-your-openai-key",
    base_url="https://tokenlens.io/proxy/openai",  # ← One line change
    default_headers={
        "X-TL-Key": "tl_live_xxxxxxxxxxxx",
        "X-TL-Feature": "chat-assistant",
        "X-TL-User": "user_123"
    }
)`}
            </pre>
          </div>
          <p className="text-center text-slate-400 mt-4">That's it. Your calls are now tracked.</p>
        </div>
      </main>
    </div>
  );
}
