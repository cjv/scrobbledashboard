# Scrobble Dashboard - My Music Listening Dashboard

A full-stack web application for visualizing and analyzing personal Last.fm listening data. Upload your Last.fm JSON exports to get detailed insights into your music consumption patterns.

## Features

- **Data Import**: Upload Last.fm JSON exports through web interface
- **Artist Analytics**: Top artists with play counts, track counts, and listening history
- **Album Analytics**: Most played albums with detailed statistics
- **Track History**: Searchable recent tracks with timestamps
- **Listening Patterns**: Monthly and hourly listening trends with interactive charts
- **Calendar Heatmap**: Year-over-year listening activity visualization
- **Real-time Search**: Filter tracks, artists, and albums instantly

## Tech Stack

- **Frontend**: React, Tailwind CSS, Recharts for data visualization
- **Backend**: Node.js, Express.js
- **Database**: SQLite with normalized schema
- **File Processing**: Multer for uploads, custom JSON parser for Last.fm data

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

1. Clone the repository
```bash
git clone https://github.com/cjv/scrobbledashboard.git
cd scrobble-dashboard
```

2. Install dependencies and set up the database
```bash
npm install
npm run setup
```

3. Start the development servers
```bash
npm run dev
```

This will start:
- Frontend dev server on http://localhost:3000
- Backend API server on http://localhost:5001

### Available Scripts

- `npm start` - Start React frontend only
- `npm run server` - Start backend API only  
- `npm run dev` - Start both frontend and backend concurrently
- `npm run setup` - Install backend dependencies and initialize database
- `npm run build` - Build frontend for production

## Usage

1. **Get Your Last.fm Data**: Export your listening history from Last.fm.  Public accounts can pull down a JSON file from https://lastfm.ghan.nl/export/
2. **Upload Data**: Use the web interface to upload your JSON file(s)
3. **Explore**: Navigate through different views to analyze your listening patterns

## API Endpoints

- `GET /api/stats` - Overall listening statistics
- `GET /api/artists` - Top artists with play counts
- `GET /api/albums` - Top albums with play counts  
- `GET /api/tracks` - Recent tracks (supports search)
- `GET /api/monthly-stats` - Monthly listening trends
- `GET /api/hourly-stats` - Hourly listening patterns
- `POST /api/upload` - Upload and process JSON files

## Database Schema

The app uses a normalized SQLite schema:
- **artists** - Artist information and metadata
- **albums** - Album information linked to artists
- **tracks** - Track information linked to artists and albums
- **scrobbles** - Individual play records with timestamps

## Deployment

Build the production version:
```bash
npm run build
```

The built files will be in the `build/` directory. Deploy both the built frontend and the `backend/` directory to your hosting platform.

## License

MIT License - feel free to use this project as a portfolio piece or learning resource.