import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { getAuthHeaders } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Eye, EyeOff, Copy, Check, RefreshCw, Info } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ApiKeys() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetchApiKey();
  }, []);

  const fetchApiKey = async () => {
    try {
      const response = await fetch(`${API}/api-keys`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.api_key);
      }
    } catch (error) {
      console.error('Error fetching API key:', error);
      toast.error('Failed to load API key');
    } finally {
      setLoading(false);
    }
  };

  const regenerateKey = async () => {
    setRegenerating(true);
    try {
      const response = await fetch(`${API}/api-keys/regenerate`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.api_key);
        toast.success('API key regenerated successfully');
      }
    } catch (error) {
      console.error('Error regenerating API key:', error);
      toast.error('Failed to regenerate API key');
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const maskKey = (key) => {
    if (!key) return '';
    return key.slice(0, 8) + '••••••••••••••••••••' + key.slice(-4);
  };

  const pythonCode = `import openai

client = openai.OpenAI(
    api_key="sk-your-openai-key",
    base_url="https://tokenlens.io/proxy/openai",
    default_headers={
        "X-TL-Key": "${apiKey || 'tl_live_xxxxxxxxxxxx'}",
        "X-TL-Feature": "chat-assistant",
        "X-TL-User": "user_123"
    }
)

# Make API calls as usual
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)`;

  const nodeCode = `const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://tokenlens.io/proxy/openai",
    defaultHeaders: {
        "X-TL-Key": "${apiKey || 'tl_live_xxxxxxxxxxxx'}",
        "X-TL-Feature": "chat-assistant",
        "X-TL-User": "user_123"
    }
});

// Make API calls as usual
const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello!" }]
});`;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64" data-testid="api-keys-loading">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-4xl" data-testid="api-keys-page">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Manrope'] tracking-tight" data-testid="api-keys-title">
            API Keys
          </h1>
          <p className="text-slate-500 mt-1">Manage your TokenLens API key and integrate with your applications</p>
        </div>

        {/* API Key Card */}
        <Card className="border-slate-200 shadow-sm" data-testid="api-key-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
              Your TokenLens API Key
            </CardTitle>
            <CardDescription className="text-slate-500">
              Use this key in your API calls to track costs. Keep it secret and never expose it in client-side code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-100 rounded-lg px-4 py-3 font-mono text-sm text-slate-700">
                {showKey ? apiKey : maskKey(apiKey)}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKey(!showKey)}
                data-testid="toggle-key-visibility"
                className="border-slate-200"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(apiKey)}
                data-testid="copy-key-button"
                className="border-slate-200"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                onClick={regenerateKey}
                disabled={regenerating}
                data-testid="regenerate-key-button"
                className="border-slate-200"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Integration Guide */}
        <Card className="border-slate-200 shadow-sm" data-testid="integration-guide-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
              Integration Guide
            </CardTitle>
            <CardDescription className="text-slate-500">
              Add these headers to your OpenAI or Anthropic API calls to start tracking costs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="python" className="w-full">
              <TabsList className="h-auto p-1 bg-slate-100 rounded-lg mb-4">
                <TabsTrigger 
                  value="python" 
                  data-testid="tab-python"
                  className="data-[state=active]:bg-slate-900 data-[state=active]:text-white px-4 py-2"
                >
                  Python
                </TabsTrigger>
                <TabsTrigger 
                  value="nodejs" 
                  data-testid="tab-nodejs"
                  className="data-[state=active]:bg-slate-900 data-[state=active]:text-white px-4 py-2"
                >
                  Node.js
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="python">
                <div className="relative">
                  <div className="bg-slate-900 rounded-xl p-6 overflow-x-auto">
                    <pre className="text-sm text-slate-300 font-['JetBrains_Mono'] leading-relaxed">
                      {pythonCode}
                    </pre>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-3 right-3 text-slate-400 hover:text-white hover:bg-slate-800"
                    onClick={() => copyToClipboard(pythonCode)}
                    data-testid="copy-python-code"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="nodejs">
                <div className="relative">
                  <div className="bg-slate-900 rounded-xl p-6 overflow-x-auto">
                    <pre className="text-sm text-slate-300 font-['JetBrains_Mono'] leading-relaxed">
                      {nodeCode}
                    </pre>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-3 right-3 text-slate-400 hover:text-white hover:bg-slate-800"
                    onClick={() => copyToClipboard(nodeCode)}
                    data-testid="copy-nodejs-code"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Callout */}
            <div className="mt-6 bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3" data-testid="integration-callout">
              <Info className="w-5 h-5 text-sky-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sky-900 text-sm">That's it. One line change.</p>
                <p className="text-sky-700 text-sm mt-1">
                  Just change your <code className="bg-sky-100 px-1.5 py-0.5 rounded text-sky-800 font-mono text-xs">base_url</code> and add the headers. 
                  Your API calls are now tracked with full cost attribution.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Headers Reference */}
        <Card className="border-slate-200 shadow-sm" data-testid="headers-reference-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
              Header Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                <code className="bg-slate-200 px-2 py-1 rounded text-sm font-mono text-slate-800">X-TL-Key</code>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Required</p>
                  <p className="text-slate-600 text-sm">Your TokenLens API key for authentication.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                <code className="bg-slate-200 px-2 py-1 rounded text-sm font-mono text-slate-800">X-TL-Feature</code>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Recommended</p>
                  <p className="text-slate-600 text-sm">Name of the feature making this API call (e.g., "chat-assistant", "doc-summarizer").</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                <code className="bg-slate-200 px-2 py-1 rounded text-sm font-mono text-slate-800">X-TL-User</code>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Optional</p>
                  <p className="text-slate-600 text-sm">Your internal user ID to attribute costs per user.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
