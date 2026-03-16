import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { Eye, EyeOff, Plus, Trash2, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Provider configurations with instructions
const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Claude 3 Opus, Sonnet, Haiku models',
    logo: '🟤',
    color: 'bg-orange-100 text-orange-700',
    keyPrefix: 'sk-ant-',
    instructions: [
      'Go to console.anthropic.com',
      'Sign in or create an account',
      'Navigate to Settings → API Keys',
      'Click "Create Key" and give it a name',
      'Copy the key (starts with sk-ant-api03-...)'
    ],
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    description: 'GPT-4, GPT-4 Turbo, GPT-3.5 models',
    logo: '🟢',
    color: 'bg-green-100 text-green-700',
    keyPrefix: 'sk-',
    instructions: [
      'Go to platform.openai.com',
      'Sign in with your OpenAI account',
      'Click on your profile → "View API Keys"',
      'Click "Create new secret key"',
      'Copy the key (starts with sk-...)'
    ],
    docsUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  {
    id: 'google',
    name: 'Google AI (Gemini)',
    description: 'Gemini Pro, Gemini Ultra models',
    logo: '🔵',
    color: 'bg-blue-100 text-blue-700',
    keyPrefix: 'AI',
    instructions: [
      'Go to aistudio.google.com',
      'Sign in with your Google account',
      'Click "Get API Key" in the left sidebar',
      'Click "Create API Key"',
      'Select a Google Cloud project or create new',
      'Copy the generated API key'
    ],
    docsUrl: 'https://aistudio.google.com/app/apikey',
    models: ['gemini-pro', 'gemini-ultra']
  },
  {
    id: 'cohere',
    name: 'Cohere',
    description: 'Command, Embed, Rerank models',
    logo: '🟣',
    color: 'bg-purple-100 text-purple-700',
    keyPrefix: '',
    instructions: [
      'Go to dashboard.cohere.com',
      'Sign in or create an account',
      'Navigate to API Keys section',
      'Click "Create Trial Key" or "Create Production Key"',
      'Copy the generated key'
    ],
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    models: ['command', 'command-light', 'embed']
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral Large, Medium, Small models',
    logo: '🟠',
    color: 'bg-amber-100 text-amber-700',
    keyPrefix: '',
    instructions: [
      'Go to console.mistral.ai',
      'Sign in or create an account',
      'Navigate to API Keys in the sidebar',
      'Click "Create new key"',
      'Copy the generated API key'
    ],
    docsUrl: 'https://console.mistral.ai/api-keys',
    models: ['mistral-large', 'mistral-medium', 'mistral-small']
  }
];

export default function Settings() {
  const [connectedProviders, setConnectedProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeys, setShowKeys] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConnectedProviders();
  }, []);

  const fetchConnectedProviders = async () => {
    try {
      const response = await fetch(`${API}/settings/providers`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setConnectedProviders(data);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProvider = async () => {
    if (!selectedProvider || !apiKeyInput.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API}/settings/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider_id: selectedProvider.id,
          api_key: apiKeyInput.trim()
        })
      });

      if (response.ok) {
        toast.success(`${selectedProvider.name} connected successfully!`);
        setAddDialogOpen(false);
        setApiKeyInput('');
        setSelectedProvider(null);
        fetchConnectedProviders();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to add provider');
      }
    } catch (error) {
      console.error('Error adding provider:', error);
      toast.error('Failed to connect provider');
    } finally {
      setSaving(false);
    }
  };

  const removeProvider = async (providerId) => {
    try {
      const response = await fetch(`${API}/settings/providers/${providerId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Provider disconnected');
        fetchConnectedProviders();
      } else {
        toast.error('Failed to remove provider');
      }
    } catch (error) {
      console.error('Error removing provider:', error);
      toast.error('Failed to remove provider');
    }
  };

  const toggleKeyVisibility = (providerId) => {
    setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const maskKey = (key) => {
    if (!key) return '';
    if (key.length <= 12) return '••••••••••••';
    return key.slice(0, 8) + '••••••••••••' + key.slice(-4);
  };

  const getProviderConfig = (providerId) => {
    return PROVIDERS.find(p => p.id === providerId);
  };

  const unconnectedProviders = PROVIDERS.filter(
    p => !connectedProviders.some(cp => cp.provider_id === p.id)
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64" data-testid="settings-loading">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-4xl" data-testid="settings-page">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Manrope'] tracking-tight" data-testid="settings-title">
            Settings
          </h1>
          <p className="text-slate-500 mt-1">Connect your AI providers to start tracking costs</p>
        </div>

        {/* Connected Providers */}
        <Card className="border-slate-200 shadow-sm" data-testid="connected-providers-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
                  Connected Providers
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Your API keys are encrypted and stored securely
                </CardDescription>
              </div>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-slate-900 hover:bg-slate-800"
                    data-testid="add-provider-button"
                    disabled={unconnectedProviders.length === 0}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Provider
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="font-['Manrope']">Connect AI Provider</DialogTitle>
                    <DialogDescription>
                      Select a provider and enter your API key to start tracking costs.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {!selectedProvider ? (
                    <div className="grid gap-3 py-4">
                      {unconnectedProviders.map(provider => (
                        <button
                          key={provider.id}
                          onClick={() => setSelectedProvider(provider)}
                          className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-left"
                          data-testid={`select-provider-${provider.id}`}
                        >
                          <span className="text-2xl">{provider.logo}</span>
                          <div>
                            <p className="font-medium text-slate-900">{provider.name}</p>
                            <p className="text-sm text-slate-500">{provider.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <span className="text-2xl">{selectedProvider.logo}</span>
                        <div>
                          <p className="font-medium text-slate-900">{selectedProvider.name}</p>
                          <button 
                            onClick={() => setSelectedProvider(null)}
                            className="text-sm text-sky-600 hover:underline"
                          >
                            Change provider
                          </button>
                        </div>
                      </div>

                      {/* Instructions */}
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="instructions" className="border-slate-200">
                          <AccordionTrigger className="text-sm text-slate-600 hover:no-underline">
                            How to get your {selectedProvider.name} API key
                          </AccordionTrigger>
                          <AccordionContent>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 mb-3">
                              {selectedProvider.instructions.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                            <a 
                              href={selectedProvider.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline"
                            >
                              Open {selectedProvider.name} Console
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>

                      {/* API Key Input */}
                      <div className="space-y-2">
                        <Label htmlFor="api-key" className="text-sm text-slate-600">
                          API Key
                        </Label>
                        <Input
                          id="api-key"
                          type="password"
                          placeholder={`Enter your ${selectedProvider.name} API key`}
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          className="border-slate-200 font-mono text-sm"
                          data-testid="api-key-input"
                        />
                        <p className="text-xs text-slate-500">
                          Your key is encrypted before storage and never shared.
                        </p>
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAddDialogOpen(false);
                        setSelectedProvider(null);
                        setApiKeyInput('');
                      }}
                    >
                      Cancel
                    </Button>
                    {selectedProvider && (
                      <Button 
                        onClick={addProvider}
                        disabled={!apiKeyInput.trim() || saving}
                        className="bg-slate-900 hover:bg-slate-800"
                        data-testid="save-provider-button"
                      >
                        {saving ? 'Connecting...' : 'Connect Provider'}
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {connectedProviders.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="font-medium text-slate-700 mb-1">No providers connected</p>
                <p className="text-sm">Add your first AI provider to start tracking API costs</p>
              </div>
            ) : (
              <div className="space-y-4">
                {connectedProviders.map(provider => {
                  const config = getProviderConfig(provider.provider_id);
                  if (!config) return null;
                  
                  return (
                    <div 
                      key={provider.provider_id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      data-testid={`connected-provider-${provider.provider_id}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{config.logo}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900">{config.name}</p>
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              <Check className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600 font-mono">
                              {showKeys[provider.provider_id] 
                                ? provider.masked_key 
                                : maskKey(provider.masked_key)}
                            </code>
                            <button
                              onClick={() => toggleKeyVisibility(provider.provider_id)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              {showKeys[provider.provider_id] 
                                ? <EyeOff className="w-3.5 h-3.5" />
                                : <Eye className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProvider(provider.provider_id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`remove-provider-${provider.provider_id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Providers Info */}
        <Card className="border-slate-200 shadow-sm" data-testid="available-providers-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
              Supported Providers
            </CardTitle>
            <CardDescription className="text-slate-500">
              TokenLens can track costs from these AI providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PROVIDERS.map(provider => {
                const isConnected = connectedProviders.some(cp => cp.provider_id === provider.id);
                return (
                  <div 
                    key={provider.id}
                    className={`p-4 rounded-lg border ${isConnected ? 'border-green-200 bg-green-50' : 'border-slate-200'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{provider.logo}</span>
                      <span className="font-medium text-slate-900">{provider.name}</span>
                      {isConnected && (
                        <Check className="w-4 h-4 text-green-600 ml-auto" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{provider.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {provider.models.slice(0, 3).map(model => (
                        <Badge key={model} variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                          {model}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
