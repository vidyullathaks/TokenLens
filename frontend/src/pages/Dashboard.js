import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
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
  ResponsiveContainer 
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Zap, Activity, Layers, Settings, AlertCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [costByFeature, setCostByFeature] = useState([]);
  const [dailySpend, setDailySpend] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [recentCalls, setRecentCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectedProviders, setConnectedProviders] = useState([]);
  const [hasRealData, setHasRealData] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // First check connected providers
      const providersRes = await fetch(`${API}/settings/providers`, { credentials: 'include' });
      if (providersRes.ok) {
        const providers = await providersRes.json();
        setConnectedProviders(providers);
        
        // If providers connected, try to get real data first
        if (providers.length > 0) {
          const realStatsRes = await fetch(`${API}/dashboard/real-stats`, { credentials: 'include' });
          if (realStatsRes.ok) {
            const realStats = await realStatsRes.json();
            if (realStats.has_data && realStats.api_calls > 0) {
              setHasRealData(true);
              setStats(realStats);
              
              // Fetch real data
              const [featureRes, callsRes] = await Promise.all([
                fetch(`${API}/dashboard/real-cost-by-feature`, { credentials: 'include' }),
                fetch(`${API}/dashboard/real-recent-calls`, { credentials: 'include' })
              ]);
              
              if (featureRes.ok) setCostByFeature(await featureRes.json());
              if (callsRes.ok) setRecentCalls(await callsRes.json());
              
              // Generate daily data placeholder
              setDailySpend(generateEmptyDailyData());
              setTopUsers([]);
              return;
            }
          }
        }
      }
      
      // Fall back to demo data
      const [statsRes, featureRes, dailyRes, usersRes, callsRes] = await Promise.all([
        fetch(`${API}/dashboard/stats`, { credentials: 'include' }),
        fetch(`${API}/dashboard/cost-by-feature`, { credentials: 'include' }),
        fetch(`${API}/dashboard/daily-spend`, { credentials: 'include' }),
        fetch(`${API}/dashboard/top-users`, { credentials: 'include' }),
        fetch(`${API}/dashboard/recent-calls`, { credentials: 'include' })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (featureRes.ok) setCostByFeature(await featureRes.json());
      if (dailyRes.ok) setDailySpend(await dailyRes.json());
      if (usersRes.ok) setTopUsers(await usersRes.json());
      if (callsRes.ok) setRecentCalls(await callsRes.json());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEmptyDailyData = () => {
    const data = [];
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() - (29 - i));
      data.push({
        day: i + 1,
        date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        spend: 0
      });
    }
    return data;
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

  return (
    <Layout>
      <div className="space-y-8" data-testid="dashboard-page">
        {/* Setup Prompt - Show when no providers connected */}
        {connectedProviders.length === 0 && (
          <Card className="border-sky-200 bg-sky-50 shadow-sm" data-testid="setup-prompt">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-sky-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-1">Connect your AI providers to start tracking</h3>
                  <p className="text-slate-600 text-sm mb-4">
                    You're viewing demo data. Add your Claude, OpenAI, or other API keys in Settings to see your real usage and costs.
                  </p>
                  <Link to="/settings">
                    <Button className="bg-slate-900 hover:bg-slate-800" data-testid="setup-settings-button">
                      <Settings className="w-4 h-4 mr-2" />
                      Go to Settings
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Mode Badge */}
        {connectedProviders.length > 0 && !hasRealData && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
            <AlertCircle className="w-4 h-4" />
            <span>Providers connected but no API calls tracked yet. Use the proxy endpoints to start tracking.</span>
          </div>
        )}

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Manrope'] tracking-tight" data-testid="dashboard-title">
            Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Your API cost intelligence at a glance</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="stat-card border-slate-200 shadow-sm" data-testid="stat-total-spend">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Spend This Month</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2 font-['Manrope']">
                    {formatCurrency(stats?.total_spend || 284.17)}
                  </p>
                  <div className="flex items-center mt-2 text-sm">
                    {(stats?.spend_change || 12) > 0 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
                        <span className="text-emerald-600 font-medium">+{stats?.spend_change || 12}%</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                        <span className="text-red-600 font-medium">{stats?.spend_change}%</span>
                      </>
                    )}
                    <span className="text-slate-400 ml-1">vs last month</span>
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
                    {(stats?.api_calls || 14382).toLocaleString()}
                  </p>
                  <div className="flex items-center mt-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
                    <span className="text-emerald-600 font-medium">+{stats?.calls_change || 8}%</span>
                    <span className="text-slate-400 ml-1">vs last month</span>
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
                    ${(stats?.avg_cost_per_call || 0.0197).toFixed(4)}
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
                    {stats?.active_features || 7}
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
                Daily Spend (Last 30 Days)
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
                      <TableCell className="text-right text-slate-600">{call.tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-slate-900">${call.cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
