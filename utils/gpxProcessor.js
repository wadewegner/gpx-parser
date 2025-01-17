const fs = require('fs');
const tj = require('@tmcw/togeojson');
const { DOMParser } = require('xmldom');
const simplify = require('@turf/simplify');

class GpxProcessor {
    constructor(gpxContent, enableSmoothing = false) {
        console.log('GpxProcessor initialized with smoothing:', enableSmoothing);
        this.trackPoints = null;
        this.waypoints = [];
        this.gpxContent = gpxContent;
        this.enableSmoothing = enableSmoothing;
    }

    async process() {
        const gpxDoc = new DOMParser().parseFromString(this.gpxContent, 'text/xml');
        
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
        
        // Calculate initial distances
        this.calculateDistances();
        
        // Extract and process waypoints first
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

        // Now apply smoothing between waypoints if enabled
        if (this.enableSmoothing) {
            console.log('Smoothing enabled, points before:', this.trackPoints.length);
            this.smoothTrackPointsBetweenWaypoints();
            console.log('Points after smoothing:', this.trackPoints.length);
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
            return {
                elevationGain: 0,
                elevationLoss: 0,
                distance: endMile - startMile,
                error: 'No track points available for this segment'
            };
        }
        
        const startPoints = this.trackPoints.filter(p => p.distance >= startMile);
        const endPoints = startPoints.filter(p => p.distance <= endMile);
        
        if (!endPoints.length) {
            return {
                elevationGain: 0,
                elevationLoss: 0,
                distance: endMile - startMile,
                error: `Missing track data between miles ${startMile.toFixed(1)} and ${endMile.toFixed(1)}`
            };
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
            elevation: point.elevation * 3.28084
        }));
    }

    getWaypoints() {
        return this.waypoints;
    }

    smoothTrackPointsBetweenWaypoints() {
        console.log('Starting smoothing between waypoints');
        // If no waypoints, smooth the entire track with conservative tolerance
        if (!this.waypoints.length) {
            console.log('No waypoints found, smoothing entire track');
            this.smoothSegment(0, this.totalDistance);
            return;
        }
        
        console.log(`Found ${this.waypoints.length} waypoints for segmented smoothing`);
        // Smooth each segment between waypoints
        let lastDistance = 0;
        this.waypoints.forEach(waypoint => {
            this.smoothSegment(lastDistance, waypoint.distance);
            lastDistance = waypoint.distance;
        });
        
        // Smooth final segment
        if (lastDistance < this.totalDistance) {
            console.log(`Smoothing final segment from ${lastDistance} to ${this.totalDistance}`);
            this.smoothSegment(lastDistance, this.totalDistance);
        }
    }

    smoothSegment(startMile, endMile) {
        try {
            const segmentPoints = this.trackPoints.filter(
                p => p.distance >= startMile && p.distance <= endMile
            );
            
            // Check if we have enough points to smooth
            if (segmentPoints.length < 2) {
                console.log(`Skipping segment ${startMile}-${endMile}: not enough points`);
                return;
            }
            
            console.log(`Smoothing segment ${startMile}-${endMile} with ${segmentPoints.length} points`);
            
            const line = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: segmentPoints.map(p => [p.longitude, p.latitude, p.elevation])
                }
            };
            
            // Validate coordinates
            const validCoordinates = line.geometry.coordinates.every(coord => 
                coord.length === 3 && 
                !isNaN(coord[0]) && 
                !isNaN(coord[1]) && 
                !isNaN(coord[2])
            );
            
            if (!validCoordinates) {
                console.log('Invalid coordinates found in segment:', line.geometry.coordinates);
                return;
            }
            
            const smoothed = simplify(line, {
                tolerance: 0.00015,
                highQuality: true
            });
            
            // Update just the points in this segment
            const smoothedPoints = smoothed.geometry.coordinates.map((coord, idx) => ({
                longitude: coord[0],
                latitude: coord[1],
                elevation: coord[2],
                distance: segmentPoints[0].distance + 
                    (idx / (smoothed.geometry.coordinates.length - 1)) * 
                    (segmentPoints[segmentPoints.length - 1].distance - segmentPoints[0].distance)
            }));
            
            // Replace segment points in trackPoints array
            const startIndex = this.trackPoints.findIndex(p => p.distance >= startMile);
            let endIndex = this.trackPoints.findIndex(p => p.distance > endMile);
            if (endIndex === -1) {
                // If we can't find a point beyond endMile, use the end of the array
                endIndex = this.trackPoints.length;
            }
            
            console.log(`Replacing points from index ${startIndex} to ${endIndex} with ${smoothedPoints.length} points`);
            this.trackPoints.splice(
                startIndex,
                endIndex - startIndex,
                ...smoothedPoints
            );
            
            // Recalculate distances for the entire track to ensure consistency
            this.calculateDistances();
        } catch (error) {
            console.error('Error smoothing segment:', error);
            console.log('Start mile:', startMile);
            console.log('End mile:', endMile);
            // Continue processing without smoothing this segment
            return;
        }
    }
}

module.exports = GpxProcessor; 