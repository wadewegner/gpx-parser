const express = require('express');
const path = require('path');
const multer = require('multer');
const GpxProcessor = require('./utils/gpxProcessor');
const fs = require('fs');
const crypto = require('crypto');
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

// Ensure public/images directory exists
const imagesDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imagesDir)){
    fs.mkdirSync(imagesDir, { recursive: true });
}

// File upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/gpx+xml' || file.originalname.endsWith('.gpx')) {
            cb(null, true);
        } else {
            cb(new Error('Only GPX files are allowed'));
        }
    }
});

// In-memory storage for GPX content
const gpxStorage = new Map();

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/upload', upload.single('gpxFile'), async (req, res) => {
    try {
        console.log('Smoothing parameter from form:', req.body.enableSmoothing);
        if (!req.file) {
            throw new Error('No file uploaded');
        }
        
        // Generate unique ID for this GPX content
        const gpxId = crypto.randomBytes(16).toString('hex');
        const smoothingEnabled = req.body.enableSmoothing === 'on';
        console.log('Storing smoothing setting:', smoothingEnabled);
        gpxStorage.set(gpxId, {
            content: req.file.buffer.toString('utf8'),
            enableSmoothing: smoothingEnabled
        });
        
        // Process GPX file to extract waypoints
        const processor = new GpxProcessor(
            req.file.buffer.toString('utf8'),
            smoothingEnabled
        );
        await processor.process();
        const waypoints = processor.getWaypoints();
        
        res.render('results', { 
            filename: req.file.originalname,
            gpxId: gpxId,
            message: 'File uploaded successfully',
            waypoints: JSON.stringify(waypoints)
        });
    } catch (error) {
        res.render('index', { error: error.message });
    }
});

app.post('/calculate', express.json(), async (req, res) => {
    try {
        const { gpxId, stations } = req.body;
        
        const gpxData = gpxStorage.get(gpxId);
        console.log('Retrieved smoothing setting:', gpxData.enableSmoothing);
        if (!gpxData) {
            throw new Error('GPX content not found. Please try uploading the file again.');
        }
        
        // Sort stations by mile marker
        const sortedStations = stations.sort((a, b) => a.mile - b.mile);
        
        // Process GPX file
        const processor = new GpxProcessor(
            gpxData.content, 
            gpxData.enableSmoothing
        );
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
const HOST = '0.0.0.0';  // Allow connections from all network interfaces
app.listen(PORT, HOST, () => {
    console.log(`Server is running on port ${PORT}`);
}); 