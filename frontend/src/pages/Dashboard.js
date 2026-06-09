import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { getAuthHeaders } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Zap, Activity, Layers, Settings, AlertCircle, Beaker, X, Download } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const PIE_COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [costByFeature, setCostByFeature] = useState([]);
  const [costByModel, setCostByModel] = useState([]);
  const [dailySpend, setDailySpend] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [recentCalls, setRecentCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectedProviders, setConnectedProviders] = useState([]);
  const [hasRealData, setHasRealData] = useState(false);
  const [hasDemoData, setHasDemoData] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);
  const [dateRange, setDateRange] = useState(30);

  useEffect(() => {
    fetchDashboardData(dateRange);
  }, [dateRange]);

  const loadDemoData = async () => {
    setSeedingDemo(true);
    try {
      const res = await fetch(`${API}/dashboard/seed-demo`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setHasDemoData(true);
        await fetchDashboardData(dateRange);
      }
    } catch (e) {
      console.error('Demo seed error:', e);
    }
    setSeedingDemo(false);
  };

  const clearDemoData = async () => {
    setClearingDemo(true);
    try {
      const res = await fetch(`${API}/dashboard/clear-demo`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setHasDemoData(false);
        await fetchDashboardData(dateRange);
      }
    } catch (e) {
      console.error('Demo clear error:', e);
    }
    setClearingDemo(false);
  };

  const fetchDashboardData = async (days) => {
    try {
      // Fetch providers and stats in parallel — stats no longer gated on providers
      const [providersRes, realStatsRes] = await Promise.all([
        fetch(`${API}/settings/providers`, { headers: getAuthHeaders() }),
        fetch(`${API}/dashboard/real-stats`, { headers: getAuthHeaders() }),
      ]);

      if (providersRes.ok) setConnectedProviders(await providersRes.json());

      if (realStatsRes.ok) {
        const realStats = await realStatsRes.json();
        const hasData = realStats.has_data && (realStats.api_calls > 0 || realStats.has_demo_data);

        if (hasData) {
          setHasRealData(true);
          setStats(realStats);
          setHasDemoData(realStats.has_demo_data || false);

          const [featureRes, callsRes, dailyRes, topUsersRes, modelRes] = await Promise.all([
            fetch(`${API}/dashboard/real-cost-by-feature?days=${days}`, { headers: getAuthHeaders() }),
            fetch(`${API}/dashboard/real-recent-calls`, { headers: getAuthHeaders() }),
            fetch(`${API}/dashboard/real-daily-spend?days=${days}`, { headers: getAuthHeaders() }),
            fetch(`${API}/dashboard/real-top-users?days=${days}`, { headers: getAuthHeaders() }),
            fetch(`${API}/dashboard/real-cost-by-model?days=${days}`, { headers: getAuthHeaders() }),
          ]);

          if (featureRes.ok) setCostByFeature(await featureRes.json());
          if (callsRes.ok) setRecentCalls(await callsRes.json());
          if (dailyRes.ok) setDailySpend(await dailyRes.json());
          else setDailySpend(generateEmptyDailyData(days));
          if (topUsersRes.ok) setTopUsers(await topUsersRes.json());
          else setTopUsers([]);
          if (modelRes.ok) setCostByModel(await modelRes.json());
          else setCostByModel([]);
        } else {
          // No data at all — reset everything, setup screen will show
          setHasRealData(false);
          setHasDemoData(false);
          setStats({ total_spend: 0, spend_change: 0, api_calls: 0, calls_change: 0, avg_cost_per_call: 0, active_features: 0 });
          setCostByFeature([]);
          setCostByModel([]);
          setDailySpend(generateEmptyDailyData(days));
          setTopUsers([]);
          setRecentCalls([]);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const generateEmptyDailyData = (days = 30) => {
    const data = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() - (days - 1 - i));
      data.push({
        day: i + 1,
        date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        spend: 0
      });
    }
    return data;
  };

  const exportCSV = () => {
    if (!recentCalls.length) return;
    const headers = ['Timestamp', 'Feature', 'Model', 'Provider', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost ($)'];
    const rows = recentCalls.map(c => [
      c.timestamp,
      c.feature || '',
      c.model || '',
      c.provider_id || '',
      c.input_tokens ?? 0,
      c.output_tokens ?? 0,
      c.total_tokens ?? c.tokens ?? 0,
      (c.cost ?? 0).toFixed(6)
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tokenlens-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-slate-900 text-sm mb-1">{label}</p>
          <p className="text-sky-600 text-sm">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64" data-testid="dashboard-loading">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  // Show setup prompt only when no providers connected AND no data (demo or real)
  if (connectedProviders.length === 0 && !hasRealData && !hasDemoData) {
    return (
      <Layout>
        <div className="space-y-8" data-testid="dashboard-page">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 font-['Manrope'] tracking-tight" data-testid="dashboard-title">
              Dashboard
            </h1>
            <p className="text-slate-500 mt-1">Your API cost intelligence at a glance</p>
          </div>

          {/* Setup Required Card */}
          <Card className="border-slate-200 shadow-sm" data-testid="setup-required">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Settings className="w-8 h-8 text-sky-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3 font-['Manrope']">
                Connect your AI provider to get started
              </h2>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Add your Claude, OpenAI, Gemini, or other AI provider API keys to start tracking your usage and costs in real-time.
              </p>
              <Link to="/settings">
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800" data-testid="setup-settings-button">
                  <Settings className="w-5 h-5 mr-2" />
                  Add Your API Keys
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* How It Works Section */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
                How TokenLens Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <span className="text-lg font-bold text-slate-600">1</span>
                  </div>
                  <h3 className="font-medium text-slate-900 mb-1">Add your API key</h3>
                  <p className="text-sm text-slate-500">Go to Settings and add your Claude, OpenAI, or other provider API keys</p>
                </div>
                <div className="text-center p-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <span className="text-lg font-bold text-slate-600">2</span>
                  </div>
                  <h3 className="font-medium text-slate-900 mb-1">Route calls through TokenLens</h3>
                  <p className="text-sm text-slate-500">Change your base URL to use our proxy and add tracking headers</p>
                </div>
                <div className="text-center p-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <span className="text-lg font-bold text-slate-600">3</span>
                  </div>
                  <h3 className="font-medium text-slate-900 mb-1">See your costs</h3>
                  <p className="text-sm text-slate-500">Watch your dashboard populate with real cost data by feature and user</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8" data-testid="dashboard-page">
        {/* Data Mode Badge - Show when providers connected but no real calls yet */}
        {connectedProviders.length > 0 && !hasRealData && !hasDemoData && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
            <AlertCircle className="w-4 h-4" />
            <span>Providers connected but no API calls tracked yet. Use the proxy endpoints to start tracking.</span>
          </div>
        )}

        {/* Page Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 font-['Manrope'] tracking-tight" data-testid="dashboard-title">
              Dashboard
            </h1>
            <p className="text-slate-500 mt-1">Your API cost intelligence at a glance</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {hasDemoData && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearDemoData}
                disabled={clearingDemo}
                className="text-red-500 border-red-200 hover:bg-red-50"
                title="Remove all demo data"
              >
                <X className="w-4 h-4 mr-2" />
                {clearingDemo ? 'Clearing...' : 'Clear Demo Data'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={loadDemoData}
              disabled={seedingDemo}
              className="text-slate-500 border-slate-300 hover:bg-slate-50"
              title="Populate dashboard with sample data for demo purposes"
            >
              <Beaker className="w-4 h-4 mr-2" />
              {seedingDemo ? 'Loading...' : 'Load Demo Data'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={!recentCalls.length}
              className="text-slate-500 border-slate-300 hover:bg-slate-50"
              title="Export recent calls as CSV"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                dateRange === d
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="stat-card border-slate-200 shadow-sm" data-testid="stat-total-spend">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Spend This Month</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2 font-['Manrope']">
                    {formatCurrency(stats?.total_spend ?? 0)}
                  </p>
                  <div className="flex items-center mt-2 text-sm">
                    {(stats?.spend_change ?? 0) > 0 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
                        <span className="text-emerald-600 font-medium">+{stats?.spend_change ?? 0}%</span>
                      </>
                    ) : (stats?.spend_change ?? 0) < 0 ? (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                        <span className="text-red-600 font-medium">{stats?.spend_change}%</span>
                      </>
                    ) : (
                      <span className="text-slate-400">No change</span>
                    )}
                    {(stats?.spend_change ?? 0) !== 0 && <span className="text-slate-400 ml-1">vs last month</span>}
                  </div>
                </div>
                <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-sky-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card border-slate-200 shadow-sm" data-testid="stat-api-calls">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">API Calls</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2 font-['Manrope']">
                    {(stats?.api_calls ?? 0).toLocaleString()}
                  </p>
                  <div className="flex items-center mt-2 text-sm">
                    {(stats?.calls_change ?? 0) > 0 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
                        <span className="text-emerald-600 font-medium">+{stats?.calls_change ?? 0}%</span>
                        <span className="text-slate-400 ml-1">vs last month</span>
                      </>
                    ) : (
                      <span className="text-slate-400">This month</span>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card border-slate-200 shadow-sm" data-testid="stat-avg-cost">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Avg Cost per Call</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2 font-['Manrope']">
                    ${(stats?.avg_cost_per_call ?? 0).toFixed(4)}
                  </p>
                  <div className="flex items-center mt-2 text-sm">
                    <span className="text-slate-400">Per API request</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card border-slate-200 shadow-sm" data-testid="stat-active-features">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active Features</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2 font-['Manrope']">
                    {stats?.active_features ?? 0}
                  </p>
                  <div className="flex items-center mt-2 text-sm">
                    <span className="text-slate-400">Tracked features</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Layers className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost by Feature */}
          <Card className="border-slate-200 shadow-sm" data-testid="chart-cost-by-feature">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
                Cost by Feature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costByFeature} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={(value) => `$${value}`} stroke="#64748b" fontSize={12} />
                    <YAxis dataKey="feature" type="category" stroke="#64748b" fontSize={12} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="cost" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Daily Spend */}
          <Card className="border-slate-200 shadow-sm" data-testid="chart-daily-spend">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
                Daily Spend (Last {dateRange} Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySpend} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(value) => `$${value}`}
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      stroke="#0f172a"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#0ea5e9' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost by Model Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost by Model Pie Chart */}
          <Card className="border-slate-200 shadow-sm" data-testid="chart-cost-by-model">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
                Cost by Model
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {costByModel.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={costByModel}
                        dataKey="cost"
                        nameKey="model"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                        labelLine={false}
                      >
                        {costByModel.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`$${value.toFixed(4)}`, 'Cost']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    No model data available for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Model breakdown table */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
                Model Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-500 font-medium">Model</TableHead>
                      <TableHead className="text-slate-500 font-medium text-right">Calls</TableHead>
                      <TableHead className="text-slate-500 font-medium text-right">Tokens</TableHead>
                      <TableHead className="text-slate-500 font-medium text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costByModel.map((item, index) => (
                      <TableRow key={item.model} className="border-slate-200 table-row-hover">
                        <TableCell className="font-mono text-sm text-slate-700 flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          {item.model}
                        </TableCell>
                        <TableCell className="text-right text-slate-600">{item.calls.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-slate-600">{(item.tokens ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium text-slate-900">${item.cost.toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Users */}
          <Card className="border-slate-200 shadow-sm" data-testid="table-top-users">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
                Top Users by Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-500 font-medium">User ID</TableHead>
                      <TableHead className="text-slate-500 font-medium text-right">Calls</TableHead>
                      <TableHead className="text-slate-500 font-medium text-right">Total Cost</TableHead>
                      <TableHead className="text-slate-500 font-medium text-right">Avg Cost/Call</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topUsers.map((user, index) => (
                      <TableRow key={user.user_id} className="border-slate-200 table-row-hover">
                        <TableCell className="font-mono text-sm text-slate-700">{user.user_id}</TableCell>
                        <TableCell className="text-right text-slate-600">{user.calls.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium text-slate-900">{formatCurrency(user.total_cost)}</TableCell>
                        <TableCell className="text-right text-slate-600">${user.avg_cost.toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Recent API Calls */}
          <Card className="border-slate-200 shadow-sm" data-testid="table-recent-calls">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">
                Recent API Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-500 font-medium">Time</TableHead>
                      <TableHead className="text-slate-500 font-medium">Feature</TableHead>
                      <TableHead className="text-slate-500 font-medium">Model</TableHead>
                      <TableHead className="text-slate-500 font-medium text-right">Tokens</TableHead>
                      <TableHead className="text-slate-500 font-medium text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCalls.map((call) => (
                      <TableRow key={call.call_id} className="border-slate-200 table-row-hover">
                        <TableCell className="text-slate-600 text-sm">{formatTimestamp(call.timestamp)}</TableCell>
                        <TableCell className="font-mono text-sm text-slate-700">{call.feature}</TableCell>
                        <TableCell className="text-slate-600 text-sm">{call.model}</TableCell>
                        <TableCell className="text-right text-slate-600">{(call.total_tokens ?? call.tokens ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium text-slate-900">${(call.cost ?? 0).toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
