import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { ArrowRight, BarChart3, Zap, Shield, Loader2 } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'signin') {
        await login(email, password);
      } else {
        if (!name.trim()) { setError('Name is required'); setLoading(false); return; }
        await register(email, password, name);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

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
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col lg:flex-row items-start gap-16">
          {/* Left: Hero */}
          <div className="flex-1 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-slate-800 text-sky-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              API Cost Intelligence for Dev Teams
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white font-['Manrope'] tracking-tight mb-6">
              Stop getting surprise<br />
              <span className="text-sky-400">AI API bills</span>
            </h1>

            <p className="text-lg text-slate-400 mb-10">
              Know exactly which feature and which user is driving your OpenAI and Anthropic costs.
              One line of code. Full attribution.
            </p>

            <div className="grid gap-4">
              {[
                { icon: BarChart3, title: 'Cost Attribution', desc: 'See exactly which feature is costing you the most. Break down by user, model, and time.' },
                { icon: Zap, title: 'One Line Change', desc: 'Just change your base URL. No SDK rewrites, no complex setup. Works in 60 seconds.' },
                { icon: Shield, title: 'Smart Alerts', desc: 'Get notified before costs spike. Set thresholds for daily spend, hourly spikes, and more.' }
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4 bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                  <div className="w-10 h-10 bg-sky-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white font-['Manrope']">{title}</h3>
                    <p className="text-slate-400 text-sm mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Auth form */}
          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-8">
              {/* Tabs */}
              <div className="flex bg-slate-900 rounded-lg p-1 mb-6">
                <button
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'signin' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  onClick={() => { setTab('signin'); setError(''); }}
                >
                  Sign In
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'signup' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  onClick={() => { setTab('signup'); setError(''); }}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {tab === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Jane Smith"
                      required={tab === 'signup'}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white py-2.5 font-semibold"
                  data-testid="auth-submit-button"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  )}
                  {tab === 'signin' ? 'Sign In' : 'Create Account'}
                </Button>
              </form>

              <p className="text-center text-slate-500 text-xs mt-6">
                {tab === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  className="text-sky-400 hover:text-sky-300"
                  onClick={() => { setTab(tab === 'signin' ? 'signup' : 'signin'); setError(''); }}
                >
                  {tab === 'signin' ? 'Sign up free' : 'Sign in'}
                </button>
              </p>
            </div>

            {/* How it works - compact */}
            <div className="mt-6 bg-slate-800/30 border border-slate-700 rounded-xl p-5">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Integration in 60 seconds</p>
              <pre className="text-xs text-slate-300 font-['JetBrains_Mono'] overflow-x-auto leading-relaxed">
{`client = openai.OpenAI(
  base_url="https://your-api/proxy/openai",
  default_headers={
    "X-TL-Key": "tl_live_xxx",
    "X-TL-Feature": "chat"
  }
)`}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
