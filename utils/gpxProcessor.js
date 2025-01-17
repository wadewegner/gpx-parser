const fs = require('fs');
const tj = require('@tmcw/togeojson');
const { DOMParser } = require('xmldom');

class GpxProcessor {
    constructor(gpxFilePath) {
        this.gpxFilePath = gpxFilePath;
        this.trackPoints = null;
    }

    async process() {
        const gpxContent = await fs.promises.readFile(this.gpxFilePath, 'utf8');
        console.log('First 500 characters of GPX content:', gpxContent.substring(0, 500));
        
        const gpxDoc = new DOMParser().parseFromString(gpxContent, 'text/xml');
        console.log('XML parsed successfully');
        
        const geoJson = tj.gpx(gpxDoc);
        
        console.log('GeoJSON:', JSON.stringify(geoJson, null, 2));
        
        if (!geoJson.features || !geoJson.features.length) {
            throw new Error('No track data found in GPX file');
        }
        
        if (!geoJson.features[0].geometry || !geoJson.features[0].geometry.coordinates) {
            throw new Error('No coordinate data found in GPX file');
        }
        
        // Extract track points with elevation data
        this.trackPoints = geoJson.features[0].geometry.coordinates.map(coord => ({
            longitude: coord[0],
            latitude: coord[1],
            elevation: coord[2],
            // We'll calculate distance later
            distance: 0
        }));

        if (!this.trackPoints.length) {
            throw new Error('No track points found in GPX file');
        }
        
        console.log(`Processed ${this.trackPoints.length} track points`);

        this.calculateDistances();
        return this;
    }

    calculateDistances() {
        if (!this.trackPoints || this.trackPoints.length < 2) {
            throw new Error('Not enough track points to calculate distances');
        }
        
        let totalDistance = 0;
        for (let i = 1; i < this.trackPoints.length; i++) {
            const prev = this.trackPoints[i - 1];
            const curr = this.trackPoints[i];
            
            // Calculate distance between points using Haversine formula
            const distance = this.calculateHaversineDistance(
                prev.latitude, prev.longitude,
                curr.latitude, curr.longitude
            );
            
            totalDistance += distance;
            curr.distance = totalDistance;
        }
        console.log(`Total distance calculated: ${totalDistance} miles`);
        this.totalDistance = totalDistance;  // Store total distance
    }

    getTotalDistance() {
        return this.totalDistance;
    }

    calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                 Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                 Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c * 0.621371; // Convert to miles
    }

    toRad(degrees) {
        return degrees * (Math.PI/180);
    }

    calculateSegmentStats(startMile, endMile) {
        if (!this.trackPoints || !this.trackPoints.length) {
            throw new Error('No track points available for segment calculation');
        }
        
        const startPoints = this.trackPoints.filter(p => p.distance >= startMile);
        const endPoints = startPoints.filter(p => p.distance <= endMile);
        
        if (!endPoints.length) {
            throw new Error(`No track points found between miles ${startMile} and ${endMile}`);
        }
        
        let elevationGain = 0;
        let elevationLoss = 0;
        
        for (let i = 1; i < endPoints.length; i++) {
            const elevationDiff = endPoints[i].elevation - endPoints[i-1].elevation;
            if (elevationDiff > 0) {
                elevationGain += elevationDiff;
            } else {
                elevationLoss += Math.abs(elevationDiff);
            }
        }

        console.log(`Segment stats for ${startMile} to ${endMile}:`, {
            elevationGain: Math.round(elevationGain * 3.28084),
            elevationLoss: Math.round(elevationLoss * 3.28084),
            distance: endMile - startMile
        });

        return {
            elevationGain: Math.round(elevationGain * 3.28084), // Convert to feet
            elevationLoss: Math.round(elevationLoss * 3.28084), // Convert to feet
            distance: endMile - startMile
        };
    }
}

module.exports = GpxProcessor; 