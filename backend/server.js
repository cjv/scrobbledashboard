const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('../build'));

// Database connection
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Import the DataImporter
const DataImporter = require('./scripts/import-data');

// API Routes

// Get dashboard stats
app.get('/api/stats', (req, res) => {
  const query = `
    SELECT 
      COUNT(s.id) as total_scrobbles,
      COUNT(DISTINCT t.artist_id) as unique_artists,
      COUNT(DISTINCT t.album_id) as unique_albums,
      MIN(s.timestamp) as first_scrobble,
      MAX(s.timestamp) as last_scrobble
    FROM scrobbles s
    JOIN tracks t ON s.track_id = t.id
    WHERE s.timestamp > '1990-01-01'
  `;
  
  db.get(query, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

// Get top artists
app.get('/api/artists', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const query = `
    SELECT 
      a.name as artist,
      COUNT(s.id) as count,
      COUNT(DISTINCT t.id) as tracks,
      COUNT(DISTINCT t.album_id) as albums,
      MIN(s.timestamp) as first_play,
      MAX(s.timestamp) as last_play,
      a.image_url as image
    FROM artists a
    JOIN tracks t ON a.id = t.artist_id
    JOIN scrobbles s ON t.id = s.track_id
    GROUP BY a.id, a.name
    ORDER BY count DESC
    LIMIT ?
  `;
  
  db.all(query, [limit], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get top albums
app.get('/api/albums', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const query = `
    SELECT 
      al.title as album,
      a.name as artist,
      COUNT(s.id) as count,
      al.image_url as image
    FROM albums al
    JOIN artists a ON al.artist_id = a.id
    JOIN tracks t ON al.id = t.album_id
    JOIN scrobbles s ON t.id = s.track_id
    GROUP BY al.id, al.title, a.name
    ORDER BY count DESC
    LIMIT ?
  `;
  
  db.all(query, [limit], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get recent tracks
app.get('/api/tracks', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const search = req.query.search || '';
  
  let query = `
    SELECT 
      t.title as track,
      a.name as artist,
      al.title as album,
      s.timestamp,
      t.url,
      t.streamable
    FROM scrobbles s
    JOIN tracks t ON s.track_id = t.id
    JOIN artists a ON t.artist_id = a.id
    LEFT JOIN albums al ON t.album_id = al.id
  `;
  
  const params = [];
  if (search) {
    query += ` WHERE a.name LIKE ? OR t.title LIKE ? OR al.title LIKE ?`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }
  
  query += ` ORDER BY s.timestamp DESC LIMIT ?`;
  params.push(limit);
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get most listened tracks
app.get('/api/tracks/top', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  
  const query = `
    SELECT 
      t.title as track,
      a.name as artist,
      al.title as album,
      COUNT(s.id) as play_count,
      MAX(s.timestamp) as last_played,
      t.url,
      t.streamable
    FROM tracks t
    JOIN artists a ON t.artist_id = a.id
    LEFT JOIN albums al ON t.album_id = al.id
    JOIN scrobbles s ON t.id = s.track_id
    GROUP BY t.id, t.title, a.name, al.title
    ORDER BY play_count DESC, last_played DESC
    LIMIT ?
  `;
  
  db.all(query, [limit], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get all tracks sorted by play count
app.get('/api/tracks/all', (req, res) => {
  const limit = parseInt(req.query.limit) || 500;
  const search = req.query.search || '';
  
  // First get the total count
  let countQuery = `
    SELECT COUNT(DISTINCT t.id) as total_count
    FROM tracks t
    JOIN artists a ON t.artist_id = a.id
    LEFT JOIN albums al ON t.album_id = al.id
    JOIN scrobbles s ON t.id = s.track_id
    WHERE s.timestamp > '1990-01-01'
  `;
  
  const countParams = [];
  if (search) {
    countQuery += ` AND (a.name LIKE ? OR t.title LIKE ? OR al.title LIKE ?)`;
    const searchParam = `%${search}%`;
    countParams.push(searchParam, searchParam, searchParam);
  }
  
  db.get(countQuery, countParams, (err, countResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Then get the limited results
    let query = `
      SELECT 
        t.title as track,
        a.name as artist,
        al.title as album,
        COUNT(s.id) as play_count,
        MAX(s.timestamp) as last_played,
        t.url,
        t.streamable
      FROM tracks t
      JOIN artists a ON t.artist_id = a.id
      LEFT JOIN albums al ON t.album_id = al.id
      JOIN scrobbles s ON t.id = s.track_id
      WHERE s.timestamp > '1990-01-01'
    `;
    
    const params = [];
    if (search) {
      query += ` AND (a.name LIKE ? OR t.title LIKE ? OR al.title LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    
    query += ` GROUP BY t.id, t.title, a.name, al.title
      ORDER BY play_count DESC, last_played DESC
      LIMIT ?`;
    params.push(limit);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        tracks: rows,
        total_count: countResult.total_count,
        showing_count: rows.length,
        has_more: countResult.total_count > rows.length
      });
    });
  });
});

// Get most loved albums (albums with most unique tracks listened to)
app.get('/api/albums/loved', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  
  const query = `
    SELECT 
      al.title as album,
      a.name as artist,
      COUNT(DISTINCT t.id) as unique_tracks_played,
      COUNT(s.id) as total_plays,
      al.image_url as image,
      ROUND(CAST(COUNT(s.id) AS FLOAT) / COUNT(DISTINCT t.id), 1) as avg_plays_per_track
    FROM albums al
    JOIN artists a ON al.artist_id = a.id
    JOIN tracks t ON al.id = t.album_id
    JOIN scrobbles s ON t.id = s.track_id
    WHERE s.timestamp > '1990-01-01'
    GROUP BY al.id, al.title, a.name
    HAVING unique_tracks_played >= 9
    ORDER BY avg_plays_per_track DESC, unique_tracks_played DESC
    LIMIT ?
  `;
  
  db.all(query, [limit], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get monthly stats for charts
app.get('/api/monthly-stats', (req, res) => {
  const query = `
    SELECT 
      strftime('%Y-%m', timestamp) as month,
      COUNT(*) as count
    FROM scrobbles
    WHERE timestamp > '1990-01-01'
    GROUP BY strftime('%Y-%m', timestamp)
    ORDER BY month
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get hourly stats
app.get('/api/hourly-stats', (req, res) => {
  const query = `
    SELECT 
      CAST(strftime('%H', timestamp) AS INTEGER) as hour,
      COUNT(*) as count
    FROM scrobbles
    WHERE timestamp > '1990-01-01'
    GROUP BY strftime('%H', timestamp)
    ORDER BY hour
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Fill in missing hours with 0
    const hourlyStats = new Array(24).fill(0).map((_, index) => ({
      hour: `${index.toString().padStart(2, '0')}:00`,
      count: 0
    }));
    
    rows.forEach(row => {
      hourlyStats[row.hour].count = row.count;
    });
    
    res.json(hourlyStats);
  });
});

// Upload and import JSON file
app.post('/api/upload', upload.single('jsonFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Parse the uploaded file
    const jsonData = JSON.parse(req.file.buffer.toString());
    
    // Create a temporary importer instance
    const importer = new DataImporter();
    
    // Extract tracks array using the same logic as the file importer
    const tracksArray = importer.extractTracksArray(jsonData);
    
    console.log(`Processing ${tracksArray.length} tracks from upload...`);
    
    // Process the scrobbles
    await importer.processScrobbles(tracksArray);
    
    res.json({ 
      success: true, 
      message: `Successfully imported ${tracksArray.length} tracks`,
      tracksProcessed: tracksArray.length
    });
    
  } catch (error) {
    console.error('Upload processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process uploaded file',
      details: error.message 
    });
  }
});

// Clear all data (for development/testing)
app.delete('/api/data', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM scrobbles');
    db.run('DELETE FROM tracks');
    db.run('DELETE FROM albums');
    db.run('DELETE FROM artists');
    res.json({ success: true, message: 'All data cleared' });
  });
});

// Serve React app for any non-API routes (only in production)
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});