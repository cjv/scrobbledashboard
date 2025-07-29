const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Initializing database...');

db.serialize(() => {
  // Artists table
  db.run(`
    CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mbid TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name)
    )
  `);

  // Albums table
  db.run(`
    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist_id INTEGER NOT NULL,
      mbid TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES artists (id),
      UNIQUE(title, artist_id)
    )
  `);

  // Tracks table
  db.run(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist_id INTEGER NOT NULL,
      album_id INTEGER,
      mbid TEXT,
      streamable BOOLEAN DEFAULT 0,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES artists (id),
      FOREIGN KEY (album_id) REFERENCES albums (id),
      UNIQUE(title, artist_id, album_id)
    )
  `);

  // Scrobbles table
  db.run(`
    CREATE TABLE IF NOT EXISTS scrobbles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL,
      timestamp DATETIME NOT NULL,
      date_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (track_id) REFERENCES tracks (id)
    )
  `);

  // Create indexes for better performance
  db.run('CREATE INDEX IF NOT EXISTS idx_scrobbles_timestamp ON scrobbles(timestamp)');
  db.run('CREATE INDEX IF NOT EXISTS idx_scrobbles_track_id ON scrobbles(track_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id)');

  console.log('Database initialized successfully!');
});

db.close();