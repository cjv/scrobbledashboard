import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, Music, TrendingUp, Clock, Search, Upload, User, Disc, PlayCircle } from 'lucide-react';

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5001';

const ScrobbleDashboard = () => {
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState('overview');
  
  // Data states
  const [stats, setStats] = useState(null);
  const [topArtists, setTopArtists] = useState([]);
  const [topAlbums, setTopAlbums] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [hourlyStats, setHourlyStats] = useState([]);

  // Check if data exists and load initial data
  useEffect(() => {
    checkDataAndLoad();
  }, []);

  // Load tracks when search term changes
  useEffect(() => {
    if (hasData) {
      loadRecentTracks();
    }
  }, [searchTerm, hasData]);

  const checkDataAndLoad = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stats`);
      const statsData = await response.json();
      
      if (statsData.total_scrobbles > 0) {
        setHasData(true);
        await loadAllData();
      } else {
        setHasData(false);
      }
    } catch (error) {
      console.error('Error checking data:', error);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async () => {
    try {
      const [statsRes, artistsRes, albumsRes, tracksRes, monthlyRes, hourlyRes] = await Promise.all([
        fetch(`${API_BASE}/api/stats`),
        fetch(`${API_BASE}/api/artists?limit=50`),
        fetch(`${API_BASE}/api/albums?limit=30`),
        fetch(`${API_BASE}/api/tracks?limit=100`),
        fetch(`${API_BASE}/api/monthly-stats`),
        fetch(`${API_BASE}/api/hourly-stats`)
      ]);

      setStats(await statsRes.json());
      setTopArtists(await artistsRes.json());
      setTopAlbums(await albumsRes.json());
      setRecentTracks(await tracksRes.json());
      setMonthlyStats(await monthlyRes.json());
      setHourlyStats(await hourlyRes.json());
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadRecentTracks = async () => {
    try {
      const url = `${API_BASE}/api/tracks?limit=100${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;
      const response = await fetch(url);
      const tracks = await response.json();
      setRecentTracks(tracks);
    } catch (error) {
      console.error('Error loading tracks:', error);
    }
  };

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/json') {
      alert('Please select a JSON file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('jsonFile', file);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`Successfully imported ${result.tracksProcessed} tracks!`);
        setHasData(true);
        await loadAllData();
      } else {
        alert(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: Network error');
    } finally {
      setUploading(false);
    }
  }, []);

  // Calendar heatmap component
  const CalendarHeatmap = ({ monthlyStats }) => {
    if (!monthlyStats || monthlyStats.length === 0) return null;

    // Group by year and create a grid for each year
    const yearGroups = {};
    monthlyStats.forEach(stat => {
      const year = stat.month.slice(0, 4);
      if (!yearGroups[year]) {
        yearGroups[year] = {};
      }
      yearGroups[year][stat.month] = stat.count;
    });

    const maxPlays = Math.max(...monthlyStats.map(stat => stat.count));
    
    const getIntensity = (count) => {
      if (!count) return 0;
      return Math.ceil((count / maxPlays) * 4);
    };

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
      <div className="bg-purple-50 p-4 rounded-lg shadow border border-purple-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700">
          <Calendar className="w-5 h-5" />
          Yearly Listening Calendar
        </h3>
        <div className="space-y-6">
          {Object.entries(yearGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([year, yearData]) => (
            <div key={year} className="bg-white border border-purple-200 rounded-lg p-4">
              <h4 className="text-md font-semibold mb-3 text-slate-700">{year}</h4>
              <div className="grid grid-cols-12 gap-2">
                {months.map((monthName, monthIndex) => {
                  const monthKey = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
                  const count = yearData[monthKey] || 0;
                  const intensity = getIntensity(count);
                  
                  return (
                    <div key={monthKey} className="text-center">
                      <div className="text-xs font-medium text-slate-500 mb-1">
                        {monthName}
                      </div>
                      <div
                        className={`aspect-square rounded text-center flex items-center justify-center text-xs font-medium cursor-pointer ${
                          intensity === 0 ? 'bg-purple-100 text-slate-400' :
                          intensity === 1 ? 'bg-purple-300 text-purple-800' :
                          intensity === 2 ? 'bg-purple-500 text-white' :
                          intensity === 3 ? 'bg-purple-700 text-white' :
                          'bg-purple-900 text-white'
                        }`}
                        title={`${monthName} ${year}: ${count} plays`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Total: {Object.values(yearData).reduce((sum, count) => sum + count, 0)} plays
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-purple-100 rounded border border-purple-200"></div>
            <div className="w-3 h-3 bg-purple-300 rounded"></div>
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <div className="w-3 h-3 bg-purple-700 rounded"></div>
            <div className="w-3 h-3 bg-purple-900 rounded"></div>
          </div>
          <span>More</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <Upload className="w-16 h-16 text-purple-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-700 mb-2">Courtney Heard</h1>
            <p className="text-slate-500 mb-6">Upload your Last.fm JSON export to get started</p>
            {uploading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                <p className="text-slate-600">Processing your data...</p>
              </div>
            ) : (
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-purple-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Music className="w-8 h-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-slate-700">Courtney Heard</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400" />
                <input
                  type="text"
                  placeholder="Search tracks, artists, albums..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Import More Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-purple-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'artists', label: 'Artists', icon: User },
              { id: 'albums', label: 'Albums', icon: Disc },
              { id: 'tracks', label: 'Tracks', icon: PlayCircle },
              { id: 'calendar', label: 'Calendar', icon: Calendar }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm ${
                  activeView === id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-purple-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview */}
        {activeView === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Scrobbles</p>
                    <p className="text-2xl font-bold text-purple-600">{stats.total_scrobbles?.toLocaleString()}</p>
                  </div>
                  <Music className="w-8 h-8 text-purple-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Unique Artists</p>
                    <p className="text-2xl font-bold text-cyan-600">{stats.unique_artists?.toLocaleString()}</p>
                  </div>
                  <User className="w-8 h-8 text-cyan-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Unique Albums</p>
                    <p className="text-2xl font-bold text-violet-600">{stats.unique_albums?.toLocaleString()}</p>
                  </div>
                  <Disc className="w-8 h-8 text-violet-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Date Range</p>
                    <p className="text-sm font-bold text-slate-700">
                      {stats.first_scrobble && stats.last_scrobble && 
                        `${new Date(stats.first_scrobble).getFullYear()} - ${new Date(stats.last_scrobble).getFullYear()}`
                      }
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-slate-500" />
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                <h3 className="text-lg font-semibold mb-4 text-slate-700">Monthly Listening</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                <h3 className="text-lg font-semibold mb-4 text-slate-700">Listening by Hour</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#06b6d4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Artists Preview */}
            <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
              <h3 className="text-lg font-semibold mb-4 text-slate-700">Top Artists</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topArtists.slice(0, 6).map((artist, index) => (
                  <div key={artist.artist} className="flex items-center gap-4 p-3 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-violet-600 rounded-lg flex items-center justify-center text-white font-bold">
                        #{index + 1}
                      </div>
                    </div>
                    <div className="flex-grow">
                      <p className="font-medium text-slate-700">{artist.artist}</p>
                      <p className="text-sm text-slate-500">{artist.count} plays</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Artists View */}
        {activeView === 'artists' && (
          <div className="bg-purple-50 rounded-lg shadow border border-purple-200">
            <div className="p-6 border-b border-purple-200">
              <h2 className="text-xl font-semibold text-slate-700">All Artists</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {topArtists.map((artist, index) => (
                  <div key={artist.artist} className="flex items-center justify-between p-4 bg-white border border-purple-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">{artist.artist}</p>
                        <p className="text-sm text-slate-500">
                          {artist.tracks} tracks • {artist.albums} albums
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-purple-600">{artist.count} plays</p>
                      <p className="text-xs text-slate-400">
                        Since {new Date(artist.first_play).getFullYear()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Albums View */}
        {activeView === 'albums' && (
          <div className="bg-purple-50 rounded-lg shadow border border-purple-200">
            <div className="p-6 border-b border-purple-200">
              <h2 className="text-xl font-semibold text-slate-700">Top Albums</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topAlbums.map((album, index) => (
                  <div key={`${album.artist}-${album.album}`} className="bg-white border border-purple-200 rounded-lg p-4 hover:shadow-md hover:bg-slate-50 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                        #{index + 1}
                      </div>
                      <div className="flex-grow">
                        <p className="font-medium text-slate-700 line-clamp-2">
                          {album.album || 'Unknown Album'}
                        </p>
                        <p className="text-sm text-slate-500 mb-2">
                          {album.artist || 'Unknown Artist'}
                        </p>
                        <p className="text-sm font-semibold text-violet-600">{album.count} plays</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tracks View */}
        {activeView === 'tracks' && (
          <div className="bg-purple-50 rounded-lg shadow border border-purple-200">
            <div className="p-6 border-b border-purple-200">
              <h2 className="text-xl font-semibold text-slate-700">Recent Tracks</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {recentTracks.map((track, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-purple-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex-grow">
                      <p className="font-medium text-slate-700">
                        {track.track || 'Unknown Track'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {track.artist || 'Unknown Artist'} • {track.album || 'Unknown Album'}
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-400">
                      {new Date(track.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {activeView === 'calendar' && (
          <CalendarHeatmap monthlyStats={monthlyStats} />
        )}
      </div>
    </div>
  );
};

export default ScrobbleDashboard;