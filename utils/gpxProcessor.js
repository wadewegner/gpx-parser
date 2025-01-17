const fs = require('fs');
const tj = require('@tmcw/togeojson');
const { DOMParser } = require('xmldom');

class GpxProcessor {
    constructor(gpxFilePath) {
        this.gpxFilePath = gpxFilePath;
        this.trackPoints = null;
        this.waypoints = [];
    }

    async process() {
        const gpxContent = await fs.promises.readFile(this.gpxFilePath, 'utf8');
        
        const gpxDoc = new DOMParser().parseFromString(gpxContent, 'text/xml');
        
        const geoJson = tj.gpx(gpxDoc);
        
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
            distance: 0
        }));

        if (!this.trackPoints.length) {
            throw new Error('No track points found in GPX file');
        }
        
        this.calculateDistances();

        // Extract waypoints if they exist
        let waypoints = geoJson.features
            .filter(feature => feature.geometry.type === 'Point')
            .map(feature => ({
                name: feature.properties.name || 'Unnamed Waypoint',
                coordinates: feature.geometry.coordinates,
                distance: 0,
                visits: []  // Store all potential visits
            }));

        // Calculate distances for waypoints
        if (waypoints.length > 0) {
            waypoints.forEach((waypoint) => {
                const waypointCoord = waypoint.coordinates;
                // Find all potential visits to this waypoint
                this.trackPoints.forEach((point, index) => {
                    const dist = this.calculateHaversineDistance(
                        point.latitude, point.longitude,
                        waypointCoord[1], waypointCoord[0]
                    );
                
                    // If within 0.1 miles of the waypoint, consider it a visit
                    if (dist < 0.1) {
                        waypoint.visits.push({
                            distance: point.distance,
                            index: index
                        });
                    }
                });
                
                delete waypoint.coordinates;
            });

            // Process visits to create multiple aid station entries if needed
            this.waypoints = [];
            waypoints.forEach(waypoint => {
                // Sort visits by distance
                waypoint.visits.sort((a, b) => a.distance - b.distance);
                
                // For each visit that's significantly different in distance
                let lastDistance = -1;
                waypoint.visits.forEach(visit => {
                    // Only add if it's more than 5 miles from the last visit
                    // (adjust this threshold based on your needs)
                    if (lastDistance === -1 || (visit.distance - lastDistance) > 5) {
                        this.waypoints.push({
                            name: waypoint.name,
                            distance: visit.distance
                        });
                        lastDistance = visit.distance;
                    }
                });
            });
            
            // Sort all waypoints by distance
            this.waypoints.sort((a, b) => a.distance - b.distance);
        }

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
            
            const distance = this.calculateHaversineDistance(
                prev.latitude, prev.longitude,
                curr.latitude, curr.longitude
            );
            
            totalDistance += distance;
            curr.distance = totalDistance;
        }
        this.totalDistance = totalDistance;
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

        return {
            elevationGain: Math.round(elevationGain * 3.28084),
            elevationLoss: Math.round(elevationLoss * 3.28084),
            distance: endMile - startMile
        };
    }

    getElevationProfile() {
        return this.trackPoints.map(point => ({
            distance: point.distance,
            elevation: point.elevation * 3.28084  // Convert to feet
        }));
    }

    getWaypoints() {
        return this.waypoints;
    }
}

module.exports = GpxProcessor; 