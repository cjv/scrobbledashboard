import React, { useState, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, Music, TrendingUp, Clock, Search, Upload, User, Disc, PlayCircle } from 'lucide-react';

const ScrobbleDashboard = () => {
  const [rawData, setRawData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState('overview');

  // Process the JSON data
  const processedData = useMemo(() => {
    console.log('Processing data, rawData:', rawData);
    
    if (!rawData) {
      return null;
    }
    
    // Handle different JSON structures
    let tracksArray = [];
    
    if (Array.isArray(rawData)) {
      // Check if it's an array of pages (each with track array)
      if (rawData[0] && rawData[0].track && Array.isArray(rawData[0].track)) {
        console.log('Using multi-page structure - combining all pages');
        // Flatten all tracks from all pages
        rawData.forEach((page, pageIndex) => {
          if (page.track && Array.isArray(page.track)) {
            tracksArray = tracksArray.concat(page.track);
            console.log(`Added ${page.track.length} tracks from page ${pageIndex + 1}`);
          }
        });
      } else {
        // Direct array of tracks
        tracksArray = rawData;
        console.log('Using direct array structure');
      }
    } else if (rawData.recenttracks && rawData.recenttracks.track && Array.isArray(rawData.recenttracks.track)) {
      tracksArray = rawData.recenttracks.track;
      console.log('Using recenttracks.track structure');
    } else if (rawData.track && Array.isArray(rawData.track)) {
      tracksArray = rawData.track;
      console.log('Using nested track structure');
    } else {
      console.log('Data validation failed - available keys:', Object.keys(rawData));
      return null;
    }

    console.log('Processing', tracksArray.length, 'total tracks');
    console.log('First track:', tracksArray[0]);
    
    const scrobbles = tracksArray.map((scrobble, index) => {
      const processed = {
        artist: (scrobble.artist && scrobble.artist['#text']) || scrobble.artist || 'Unknown Artist',
        artistMbid: (scrobble.artist && scrobble.artist.mbid) || '',
        track: scrobble.name || scrobble.track || 'Unknown Track',
        trackMbid: scrobble.mbid || '',
        album: (scrobble.album && scrobble.album['#text']) || scrobble.album || 'Unknown Album',
        albumMbid: (scrobble.album && scrobble.album.mbid) || '',
        timestamp: scrobble.date && scrobble.date.uts ? new Date(parseInt(scrobble.date.uts) * 1000) : new Date(),
        dateText: (scrobble.date && scrobble.date['#text']) || '',
        image: (scrobble.image && scrobble.image.find && scrobble.image.find(img => img.size === 'extralarge')?.['#text']) || '',
        url: scrobble.url || '',
        streamable: scrobble.streamable === '1'
      };
      
      if (index === 0) {
        console.log('First processed track:', processed);
        console.log('Original scrobble structure:', scrobble);
      }
      
      return processed;
    });
    
    console.log('Successfully processed', scrobbles.length, 'scrobbles');
    return scrobbles.sort((a, b) => b.timestamp - a.timestamp);
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
    console.log('File selected:', file);
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          console.log('Parsed JSON data:', data);
          console.log('Data keys:', Object.keys(data));
          if (data.track) {
            console.log('Track array length:', data.track.length);
            console.log('First track:', data.track[0]);
          }
          setRawData(data);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          alert('Error parsing JSON file');
        }
      };
      reader.readAsText(file);
    } else {
      console.log('File type not JSON or no file selected');
    }
  }, []);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!processedData || !searchTerm) return processedData;
    return processedData.filter(scrobble => {
      const artist = typeof scrobble.artist === 'string' ? scrobble.artist : '';
      const track = typeof scrobble.track === 'string' ? scrobble.track : '';
      const album = typeof scrobble.album === 'string' ? scrobble.album : '';
      
      return artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
             track.toLowerCase().includes(searchTerm.toLowerCase()) ||
             album.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [processedData, searchTerm]);

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

  if (!rawData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <Upload className="w-16 h-16 text-purple-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-700 mb-2">Scrobble Dashboard</h1>
            <p className="text-slate-500 mb-6">Upload your Last.fm JSON export to get started</p>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
            />
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
              <h1 className="text-2xl font-bold text-slate-700">Scrobble Dashboard</h1>
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
        {activeView === 'overview' && aggregations && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Scrobbles</p>
                    <p className="text-2xl font-bold text-purple-600">{aggregations.totalScrobbles.toLocaleString()}</p>
                  </div>
                  <Music className="w-8 h-8 text-purple-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Unique Artists</p>
                    <p className="text-2xl font-bold text-cyan-600">{aggregations.uniqueArtists.toLocaleString()}</p>
                  </div>
                  <User className="w-8 h-8 text-cyan-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Unique Albums</p>
                    <p className="text-2xl font-bold text-violet-600">{aggregations.uniqueAlbums.toLocaleString()}</p>
                  </div>
                  <Disc className="w-8 h-8 text-violet-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Date Range</p>
                    <p className="text-sm font-bold text-slate-700">
                      {aggregations.dateRange.start?.getFullYear()} - {aggregations.dateRange.end?.getFullYear()}
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
                  <LineChart data={aggregations.monthlyStats}>
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
                  <BarChart data={aggregations.hourlyStats}>
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
                {aggregations.topArtists.slice(0, 6).map((artist, index) => (
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
        {activeView === 'artists' && aggregations && (
          <div className="bg-purple-50 rounded-lg shadow border border-purple-200">
            <div className="p-6 border-b border-purple-200">
              <h2 className="text-xl font-semibold text-slate-700">All Artists</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {aggregations.topArtists.slice(0, 50).map((artist, index) => (
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
          <div className="bg-purple-50 rounded-lg shadow border border-purple-200">
            <div className="p-6 border-b border-purple-200">
              <h2 className="text-xl font-semibold text-slate-700">Top Albums</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {aggregations.topAlbums.slice(0, 30).map((album, index) => (
                  <div key={`${album.artist}-${album.album}`} className="bg-white border border-purple-200 rounded-lg p-4 hover:shadow-md hover:bg-slate-50 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                        #{index + 1}
                      </div>
                      <div className="flex-grow">
                        <p className="font-medium text-slate-700 line-clamp-2">
                          {typeof album.album === 'string' ? album.album : 'Unknown Album'}
                        </p>
                        <p className="text-sm text-slate-500 mb-2">
                          {typeof album.artist === 'string' ? album.artist : 'Unknown Artist'}
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
                {(filteredData || []).slice(0, 100).map((scrobble, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-purple-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex-grow">
                      <p className="font-medium text-slate-700">
                        {typeof scrobble.track === 'string' ? scrobble.track : 'Unknown Track'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {typeof scrobble.artist === 'string' ? scrobble.artist : 'Unknown Artist'} • {typeof scrobble.album === 'string' ? scrobble.album : 'Unknown Album'}
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-400">
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
          <CalendarHeatmap monthlyStats={aggregations.monthlyStats} />
        )}
      </div>
    </div>
  );
};

export default ScrobbleDashboard;