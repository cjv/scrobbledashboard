const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DataImporter {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'database.sqlite');
    this.db = new sqlite3.Database(dbPath);
  }

  async importJsonFile(filePath) {
    console.log(`Importing data from ${filePath}...`);
    
    try {
      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const tracksArray = this.extractTracksArray(rawData);
      
      console.log(`Found ${tracksArray.length} tracks to import`);
      
      await this.processScrobbles(tracksArray);
      console.log('Import completed successfully!');
      
    } catch (error) {
      console.error('Import failed:', error.message);
      throw error;
    }
  }

  extractTracksArray(rawData) {
    let tracksArray = [];
    
    if (Array.isArray(rawData)) {
      // Check if it's an array of pages (each with track array)
      if (rawData[0] && rawData[0].track && Array.isArray(rawData[0].track)) {
        rawData.forEach(page => {
          if (page.track && Array.isArray(page.track)) {
            tracksArray = tracksArray.concat(page.track);
          }
        });
      } else {
        // Direct array of tracks
        tracksArray = rawData;
      }
    } else if (rawData.recenttracks && rawData.recenttracks.track && Array.isArray(rawData.recenttracks.track)) {
      tracksArray = rawData.recenttracks.track;
    } else if (rawData.track && Array.isArray(rawData.track)) {
      tracksArray = rawData.track;
    } else {
      throw new Error('Unsupported JSON structure');
    }
    
    return tracksArray;
  }

  async processScrobbles(tracksArray) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // Prepare statements
        const insertArtist = this.db.prepare(`
          INSERT OR IGNORE INTO artists (name, mbid, image_url) 
          VALUES (?, ?, ?)
        `);
        
        const insertAlbum = this.db.prepare(`
          INSERT OR IGNORE INTO albums (title, artist_id, mbid, image_url) 
          VALUES (?, ?, ?, ?)
        `);
        
        const insertTrack = this.db.prepare(`
          INSERT OR IGNORE INTO tracks (title, artist_id, album_id, mbid, streamable, url) 
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const insertScrobble = this.db.prepare(`
          INSERT INTO scrobbles (track_id, timestamp, date_text) 
          VALUES (?, ?, ?)
        `);
        
        const getArtistId = this.db.prepare('SELECT id FROM artists WHERE name = ?');
        const getAlbumId = this.db.prepare('SELECT id FROM albums WHERE title = ? AND artist_id = ?');
        const getTrackId = this.db.prepare('SELECT id FROM tracks WHERE title = ? AND artist_id = ? AND album_id = ?');
        
        let processed = 0;
        
        const processTrack = (index) => {
          if (index >= tracksArray.length) {
            // Finalize
            insertArtist.finalize();
            insertAlbum.finalize();
            insertTrack.finalize();
            insertScrobble.finalize();
            getArtistId.finalize();
            getAlbumId.finalize();
            getTrackId.finalize();
            
            this.db.run('COMMIT', (err) => {
              if (err) reject(err);
              else {
                console.log(`Successfully imported ${processed} scrobbles`);
                resolve();
              }
            });
            return;
          }
          
          const scrobble = tracksArray[index];
          
          // Extract data
          const artistName = (scrobble.artist && scrobble.artist['#text']) || scrobble.artist || 'Unknown Artist';
          const artistMbid = (scrobble.artist && scrobble.artist.mbid) || '';
          const trackName = scrobble.name || scrobble.track || 'Unknown Track';
          const trackMbid = scrobble.mbid || '';
          const albumName = (scrobble.album && scrobble.album['#text']) || scrobble.album || 'Unknown Album';
          const albumMbid = (scrobble.album && scrobble.album.mbid) || '';
          const timestamp = scrobble.date && scrobble.date.uts ? new Date(parseInt(scrobble.date.uts) * 1000).toISOString() : new Date().toISOString();
          const dateText = (scrobble.date && scrobble.date['#text']) || '';
          const imageUrl = (scrobble.image && scrobble.image.find && scrobble.image.find(img => img.size === 'extralarge')?.['#text']) || '';
          const url = scrobble.url || '';
          const streamable = scrobble.streamable === '1' ? 1 : 0;
          
          // Insert artist
          insertArtist.run([artistName, artistMbid, imageUrl], function(err) {
            if (err && !err.message.includes('UNIQUE constraint failed')) {
              console.error('Artist insert error:', err);
              return processTrack(index + 1);
            }
            
            // Get artist ID
            getArtistId.get([artistName], (err, artistRow) => {
              if (err || !artistRow) {
                console.error('Artist lookup error:', err);
                return processTrack(index + 1);
              }
              
              const artistId = artistRow.id;
              
              // Insert album
              insertAlbum.run([albumName, artistId, albumMbid, imageUrl], function(err) {
                if (err && !err.message.includes('UNIQUE constraint failed')) {
                  console.error('Album insert error:', err);
                  return processTrack(index + 1);
                }
                
                // Get album ID
                getAlbumId.get([albumName, artistId], (err, albumRow) => {
                  if (err || !albumRow) {
                    console.error('Album lookup error:', err);
                    return processTrack(index + 1);
                  }
                  
                  const albumId = albumRow.id;
                  
                  // Insert track
                  insertTrack.run([trackName, artistId, albumId, trackMbid, streamable, url], function(err) {
                    if (err && !err.message.includes('UNIQUE constraint failed')) {
                      console.error('Track insert error:', err);
                      return processTrack(index + 1);
                    }
                    
                    // Get track ID
                    getTrackId.get([trackName, artistId, albumId], (err, trackRow) => {
                      if (err || !trackRow) {
                        console.error('Track lookup error:', err);
                        return processTrack(index + 1);
                      }
                      
                      const trackId = trackRow.id;
                      
                      // Insert scrobble
                      insertScrobble.run([trackId, timestamp, dateText], function(err) {
                        if (err) {
                          console.error('Scrobble insert error:', err);
                        } else {
                          processed++;
                          if (processed % 1000 === 0) {
                            console.log(`Processed ${processed} scrobbles...`);
                          }
                        }
                        processTrack(index + 1);
                      });
                    });
                  });
                });
              });
            });
          });
        };
        
        processTrack(0);
      });
    });
  }

  close() {
    this.db.close();
  }
}

// CLI usage
if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node import-data.js <path-to-json-file>');
    process.exit(1);
  }
  
  const importer = new DataImporter();
  importer.importJsonFile(filePath)
    .then(() => {
      importer.close();
      process.exit(0);
    })
    .catch(error => {
      console.error('Import failed:', error);
      importer.close();
      process.exit(1);
    });
}

module.exports = DataImporter;