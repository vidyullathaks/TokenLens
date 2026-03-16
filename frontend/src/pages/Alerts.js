import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { getAuthHeaders } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Save, AlertTriangle, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Alerts() {
  const [configs, setConfigs] = useState({
    daily_spend: { threshold: 50, notification_method: 'email', enabled: true },
    hourly_spike: { threshold: 200, notification_method: 'email', enabled: true },
    single_feature: { threshold: 30, notification_method: 'slack', enabled: true }
  });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAlertData();
  }, []);

  const fetchAlertData = async () => {
    try {
      const [configRes, historyRes] = await Promise.all([
        fetch(`${API}/alerts/config`, { headers: getAuthHeaders() }),
        fetch(`${API}/alerts/history`, { headers: getAuthHeaders() })
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        const configMap = {};
        configData.forEach(c => {
          configMap[c.alert_type] = {
            threshold: c.threshold,
            notification_method: c.notification_method,
            enabled: c.enabled
          };
        });
        setConfigs(prev => ({ ...prev, ...configMap }));
      }

      if (historyRes.ok) {
        setHistory(await historyRes.json());
      }
    } catch (error) {
      console.error('Error fetching alert data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (alertType) => {
    setSaving(true);
    try {
      const config = configs[alertType];
      const response = await fetch(`${API}/alerts/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          alert_type: alertType,
          threshold: config.threshold,
          notification_method: config.notification_method,
          enabled: config.enabled
        })
      });

      if (response.ok) {
        toast.success('Alert configuration saved');
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (alertType, field, value) => {
    setConfigs(prev => ({
      ...prev,
      [alertType]: {
        ...prev[alertType],
        [field]: value
      }
    }));
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const getAlertIcon = (alertType) => {
    switch (alertType) {
      case 'daily_spend':
        return <DollarSign className="w-4 h-4" />;
      case 'hourly_spike':
        return <TrendingUp className="w-4 h-4" />;
      case 'single_feature':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64" data-testid="alerts-loading">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-4xl" data-testid="alerts-page">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Manrope'] tracking-tight" data-testid="alerts-title">
            Anomaly Alerts
          </h1>
          <p className="text-slate-500 mt-1">Configure alerts to catch unexpected cost spikes before they become problems</p>
        </div>

        {/* Alert Configurations */}
        <div className="space-y-6">
          {/* Daily Spend Alert */}
          <Card className="border-slate-200 shadow-sm" data-testid="alert-daily-spend">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900 font-['Manrope']">
                      Daily Spend Limit
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Alert when daily spend exceeds threshold
                    </CardDescription>
                  </div>
                </div>
                <Switch 
                  checked={configs.daily_spend.enabled}
                  onCheckedChange={(checked) => updateConfig('daily_spend', 'enabled', checked)}
                  data-testid="switch-daily-spend"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="daily-threshold" className="text-sm text-slate-600">
                    Daily spend exceeds
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <Input
                      id="daily-threshold"
                      type="number"
                      value={configs.daily_spend.threshold}
                      onChange={(e) => updateConfig('daily_spend', 'threshold', parseFloat(e.target.value))}
                      className="pl-7 border-slate-200"
                      data-testid="input-daily-threshold"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-sm text-slate-600">Notify via</Label>
                  <Select 
                    value={configs.daily_spend.notification_method}
                    onValueChange={(value) => updateConfig('daily_spend', 'notification_method', value)}
                  >
                    <SelectTrigger className="border-slate-200" data-testid="select-daily-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => saveConfig('daily_spend')} 
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800"
                  data-testid="save-daily-spend"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Hourly Spike Alert */}
          <Card className="border-slate-200 shadow-sm" data-testid="alert-hourly-spike">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900 font-['Manrope']">
                      Hourly Spike Detection
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Alert when hourly spend spikes above rolling average
                    </CardDescription>
                  </div>
                </div>
                <Switch 
                  checked={configs.hourly_spike.enabled}
                  onCheckedChange={(checked) => updateConfig('hourly_spike', 'enabled', checked)}
                  data-testid="switch-hourly-spike"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="spike-threshold" className="text-sm text-slate-600">
                    More than X% above rolling average
                  </Label>
                  <div className="relative">
                    <Input
                      id="spike-threshold"
                      type="number"
                      value={configs.hourly_spike.threshold}
                      onChange={(e) => updateConfig('hourly_spike', 'threshold', parseFloat(e.target.value))}
                      className="pr-8 border-slate-200"
                      data-testid="input-spike-threshold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-sm text-slate-600">Notify via</Label>
                  <Select 
                    value={configs.hourly_spike.notification_method}
                    onValueChange={(value) => updateConfig('hourly_spike', 'notification_method', value)}
                  >
                    <SelectTrigger className="border-slate-200" data-testid="select-spike-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => saveConfig('hourly_spike')} 
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800"
                  data-testid="save-hourly-spike"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Single Feature Alert */}
          <Card className="border-slate-200 shadow-sm" data-testid="alert-single-feature">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900 font-['Manrope']">
                      Single Feature Cost
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Alert if any one feature exceeds daily threshold
                    </CardDescription>
                  </div>
                </div>
                <Switch 
                  checked={configs.single_feature.enabled}
                  onCheckedChange={(checked) => updateConfig('single_feature', 'enabled', checked)}
                  data-testid="switch-single-feature"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="feature-threshold" className="text-sm text-slate-600">
                    Feature daily cost exceeds
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <Input
                      id="feature-threshold"
                      type="number"
                      value={configs.single_feature.threshold}
                      onChange={(e) => updateConfig('single_feature', 'threshold', parseFloat(e.target.value))}
                      className="pl-7 border-slate-200"
                      data-testid="input-feature-threshold"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-sm text-slate-600">Notify via</Label>
                  <Select 
                    value={configs.single_feature.notification_method}
                    onValueChange={(value) => updateConfig('single_feature', 'notification_method', value)}
                  >
                    <SelectTrigger className="border-slate-200" data-testid="select-feature-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => saveConfig('single_feature')} 
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800"
                  data-testid="save-single-feature"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alert History */}
        <Card className="border-slate-200 shadow-sm" data-testid="alert-history">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
              Alert History
            </CardTitle>
            <CardDescription className="text-slate-500">
              Recent alerts triggered by your configured thresholds
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No alerts triggered yet. Your thresholds are working!
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200">
                    <TableHead className="text-slate-500 font-medium">When</TableHead>
                    <TableHead className="text-slate-500 font-medium">Alert</TableHead>
                    <TableHead className="text-slate-500 font-medium text-right">Value</TableHead>
                    <TableHead className="text-slate-500 font-medium text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((alert) => (
                    <TableRow key={alert.history_id} className="border-slate-200 table-row-hover">
                      <TableCell className="text-slate-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {formatDate(alert.triggered_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getAlertIcon(alert.alert_type)}
                          <span className="text-slate-700">{alert.message}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
                        {alert.value ? `$${alert.value.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">
                          {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
