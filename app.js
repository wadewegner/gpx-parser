const express = require('express');
const path = require('path');
const multer = require('multer');
const GpxProcessor = require('./utils/gpxProcessor');
const fs = require('fs');
const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const upload = multer({ 
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/gpx+xml' || file.originalname.endsWith('.gpx')) {
            cb(null, true);
        } else {
            cb(new Error('Only GPX files are allowed'));
        }
    }
});

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/upload', upload.single('gpxFile'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }
        
        // Process GPX file to extract waypoints
        const processor = new GpxProcessor(path.join(__dirname, 'uploads', req.file.filename));
        await processor.process();
        const waypoints = processor.getWaypoints();
        
        res.render('results', { 
            filename: req.file.originalname,
            tempFilename: req.file.filename,
            message: 'File uploaded successfully',
            waypoints: JSON.stringify(waypoints)  // Pass waypoints to the view
        });
    } catch (error) {
        res.render('index', { error: error.message });
    }
});

app.post('/calculate', express.json(), async (req, res) => {
    try {
        const { gpxFile, stations } = req.body;
        
        // Sort stations by mile marker
        const sortedStations = stations.sort((a, b) => a.mile - b.mile);
        
        const gpxFilePath = path.join(__dirname, 'uploads', gpxFile);
        
        // Check if file exists
        if (!fs.existsSync(gpxFilePath)) {
            throw new Error(`GPX file not found at ${gpxFilePath}`);
        }
        
        // Process GPX file
        const processor = new GpxProcessor(gpxFilePath);
        await processor.process();
        
        // Get elevation profile data
        const elevationProfile = processor.getElevationProfile();
        
        // Calculate segments between stations
        const segments = [];
        
        // Get total distance from processor
        const totalDistance = processor.getTotalDistance();
        
        // Add segment from start to first aid station if exists
        if (sortedStations.length > 0) {
            const firstStation = sortedStations[0];
            const firstStats = processor.calculateSegmentStats(0, firstStation.mile);
            segments.push({
                start: 'Start',
                end: firstStation.name,
                ...firstStats
            });
        }
        
        // Calculate segments between aid stations
        for (let i = 0; i < sortedStations.length - 1; i++) {
            const start = sortedStations[i];
            const end = sortedStations[i + 1];
            
            const stats = processor.calculateSegmentStats(start.mile, end.mile);
            segments.push({
                start: start.name,
                end: end.name,
                ...stats
            });
        }
        
        // Add segment from last aid station to finish if exists
        if (sortedStations.length > 0) {
            const lastStation = sortedStations[sortedStations.length - 1];
            const finalStats = processor.calculateSegmentStats(lastStation.mile, totalDistance);
            segments.push({
                start: lastStation.name,
                end: 'Finish',
                ...finalStats
            });
        }
        
        res.json({ 
            segments,
            elevationProfile,
            aidStations: sortedStations.map(station => ({
                name: station.name,
                mile: station.mile,
                elevation: elevationProfile.find(p => Math.abs(p.distance - station.mile) < 0.1)?.elevation || 0
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handler
app.use((error, req, res, next) => {
    res.render('index', { error: error.message });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 