import React, { useState, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, Music, TrendingUp, Clock, Search, Upload, User, Disc, PlayCircle } from 'lucide-react';

const ScrobbleDashboard = () => {
  const [rawData, setRawData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState('overview');
  const [selectedArtist, setSelectedArtist] = useState(null);

  // Process the JSON data
  const processedData = useMemo(() => {
    if (!rawData) return null;

    const scrobbles = rawData.track.map(scrobble => ({
      artist: scrobble.artist['#text'],
      artistMbid: scrobble.artist.mbid,
      track: scrobble.name,
      trackMbid: scrobble.mbid,
      album: scrobble.album['#text'],
      albumMbid: scrobble.album.mbid,
      timestamp: new Date(parseInt(scrobble.date.uts) * 1000),
      dateText: scrobble.date['#text'],
      image: scrobble.image.find(img => img.size === 'extralarge')?.['#text'] ||
             scrobble.image.find(img => img.size === 'large')?.['#text'] ||
             scrobble.image[0]?.['#text'],
      url: scrobble.url,
      streamable: scrobble.streamable === '1'
    })).sort((a, b) => b.timestamp - a.timestamp);

    return scrobbles;
  }, [rawData]);

  // Build aggregations
  const aggregations = useMemo(() => {
    if (!processedData) return null;

    const artistCounts = {};
    const albumCounts = {};
    const monthlyStats = {};
    const dailyStats = {};
    const hourlyStats = new Array(24).fill(0);

    processedData.forEach(scrobble => {
      // Artist stats
      if (!artistCounts[scrobble.artist]) {
        artistCounts[scrobble.artist] = {
          count: 0,
          tracks: new Set(),
          albums: new Set(),
          firstPlay: scrobble.timestamp,
          lastPlay: scrobble.timestamp,
          image: scrobble.image
        };
      }
      artistCounts[scrobble.artist].count++;
      artistCounts[scrobble.artist].tracks.add(scrobble.track);
      artistCounts[scrobble.artist].albums.add(scrobble.album);
      if (scrobble.timestamp < artistCounts[scrobble.artist].firstPlay) {
        artistCounts[scrobble.artist].firstPlay = scrobble.timestamp;
      }

      // Album stats
      const albumKey = `${scrobble.artist} - ${scrobble.album}`;
      if (!albumCounts[albumKey]) {
        albumCounts[albumKey] = {
          artist: scrobble.artist,
          album: scrobble.album,
          count: 0,
          image: scrobble.image
        };
      }
      albumCounts[albumKey].count++;

      // Monthly stats
      const monthKey = scrobble.timestamp.toISOString().slice(0, 7);
      monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + 1;

      // Daily stats for calendar
      const dateKey = scrobble.timestamp.toISOString().slice(0, 10);
      dailyStats[dateKey] = (dailyStats[dateKey] || 0) + 1;

      // Hourly stats
      const hour = scrobble.timestamp.getHours();
      hourlyStats[hour]++;
    });

    return {
      topArtists: Object.entries(artistCounts)
        .map(([artist, data]) => ({
          artist,
          count: data.count,
          tracks: data.tracks.size,
          albums: data.albums.size,
          firstPlay: data.firstPlay,
          lastPlay: data.lastPlay,
          image: data.image
        }))
        .sort((a, b) => b.count - a.count),
      
      topAlbums: Object.values(albumCounts)
        .sort((a, b) => b.count - a.count),
      
      monthlyStats: Object.entries(monthlyStats)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      
      dailyStats,
      hourlyStats: hourlyStats.map((count, hour) => ({ 
        hour: `${hour.toString().padStart(2, '0')}:00`, 
        count 
      })),
      
      totalScrobbles: processedData.length,
      dateRange: {
        start: processedData[processedData.length - 1]?.timestamp,
        end: processedData[0]?.timestamp
      },
      uniqueArtists: Object.keys(artistCounts).length,
      uniqueAlbums: Object.keys(albumCounts).length
    };
  }, [processedData]);

  // File upload handler
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          setRawData(data);
        } catch (error) {
          alert('Error parsing JSON file');
        }
      };
      reader.readAsText(file);
    }
  }, []);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!processedData || !searchTerm) return processedData;
    return processedData.filter(scrobble => 
      scrobble.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scrobble.track.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scrobble.album.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [processedData, searchTerm]);

  // Calendar heatmap component
  const CalendarHeatmap = ({ dailyStats }) => {
    if (!dailyStats) return null;

    const maxPlays = Math.max(...Object.values(dailyStats));
    const minDate = new Date(Math.min(...Object.keys(dailyStats).map(d => new Date(d))));
    const maxDate = new Date(Math.max(...Object.keys(dailyStats).map(d => new Date(d))));
    
    const getIntensity = (count) => {
      if (!count) return 0;
      return Math.ceil((count / maxPlays) * 4);
    };

    const days = [];
    const currentDate = new Date(minDate);
    while (currentDate <= maxDate) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      const count = dailyStats[dateStr] || 0;
      days.push({
        date: dateStr,
        count,
        intensity: getIntensity(count)
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Listening Calendar
        </h3>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-medium text-gray-600 p-1">
              {day}
            </div>
          ))}
          {days.map(day => (
            <div
              key={day.date}
              className={`aspect-square rounded text-center flex items-center justify-center text-xs font-medium ${
                day.intensity === 0 ? 'bg-gray-100' :
                day.intensity === 1 ? 'bg-blue-200' :
                day.intensity === 2 ? 'bg-blue-400' :
                day.intensity === 3 ? 'bg-blue-600' :
                'bg-blue-800 text-white'
              }`}
              title={`${day.date}: ${day.count} plays`}
            >
              {day.count > 0 ? day.count : ''}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!rawData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Scrobble Dashboard</h1>
            <p className="text-gray-600 mb-6">Upload your Last.fm JSON export to get started</p>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Music className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Scrobble Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tracks, artists, albums..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
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
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
        {activeView === 'overview' && aggregations && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Scrobbles</p>
                    <p className="text-2xl font-bold text-blue-600">{aggregations.totalScrobbles.toLocaleString()}</p>
                  </div>
                  <Music className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Unique Artists</p>
                    <p className="text-2xl font-bold text-green-600">{aggregations.uniqueArtists.toLocaleString()}</p>
                  </div>
                  <User className="w-8 h-8 text-green-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Unique Albums</p>
                    <p className="text-2xl font-bold text-purple-600">{aggregations.uniqueAlbums.toLocaleString()}</p>
                  </div>
                  <Disc className="w-8 h-8 text-purple-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Date Range</p>
                    <p className="text-sm font-bold text-orange-600">
                      {aggregations.dateRange.start?.getFullYear()} - {aggregations.dateRange.end?.getFullYear()}
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-500" />
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Monthly Listening</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={aggregations.monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Listening by Hour</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={aggregations.hourlyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Artists Preview */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Top Artists</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aggregations.topArtists.slice(0, 6).map((artist, index) => (
                  <div key={artist.artist} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                        #{index + 1}
                      </div>
                    </div>
                    <div className="flex-grow">
                      <p className="font-medium text-gray-900">{artist.artist}</p>
                      <p className="text-sm text-gray-600">{artist.count} plays</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Artists View */}
        {activeView === 'artists' && aggregations && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">All Artists</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {aggregations.topArtists.slice(0, 50).map((artist, index) => (
                  <div key={artist.artist} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{artist.artist}</p>
                        <p className="text-sm text-gray-600">
                          {artist.tracks} tracks • {artist.albums} albums
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">{artist.count} plays</p>
                      <p className="text-xs text-gray-500">
                        Since {artist.firstPlay.getFullYear()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Albums View */}
        {activeView === 'albums' && aggregations && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Top Albums</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {aggregations.topAlbums.slice(0, 30).map((album, index) => (
                  <div key={`${album.artist}-${album.album}`} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                        #{index + 1}
                      </div>
                      <div className="flex-grow">
                        <p className="font-medium text-gray-900 line-clamp-2">{album.album}</p>
                        <p className="text-sm text-gray-600 mb-2">{album.artist}</p>
                        <p className="text-sm font-semibold text-purple-600">{album.count} plays</p>
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
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Recent Tracks</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {(filteredData || []).slice(0, 100).map((scrobble, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex-grow">
                      <p className="font-medium text-gray-900">{scrobble.track}</p>
                      <p className="text-sm text-gray-600">{scrobble.artist} • {scrobble.album}</p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {scrobble.timestamp.toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {activeView === 'calendar' && aggregations && (
          <CalendarHeatmap dailyStats={aggregations.dailyStats} />
        )}
      </div>
    </div>
  );
};

export default ScrobbleDashboard;