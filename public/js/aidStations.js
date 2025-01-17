document.addEventListener('DOMContentLoaded', function() {
    const aidStationInputs = document.getElementById('aidStationInputs');
    const addButton = document.getElementById('addStation');

    function createAidStationInput(index) {
        const div = document.createElement('div');
        div.className = 'row mb-3 align-items-center';
        div.innerHTML = `
            <div class="col">
                <input type="text" class="form-control" name="stations[${index}][name]" 
                    placeholder="Aid Station Name" required>
            </div>
            <div class="col">
                <input type="number" class="form-control" name="stations[${index}][mile]" 
                    placeholder="Mile Marker" step="0.1" required>
            </div>
            <div class="col-auto">
                <button type="button" class="btn btn-danger remove-station">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        return div;
    }

    addButton.addEventListener('click', function() {
        const index = aidStationInputs.children.length;
        const newInput = createAidStationInput(index);
        aidStationInputs.appendChild(newInput);
    });

    aidStationInputs.addEventListener('click', function(e) {
        // Check if clicked element or its parent is the remove button
        const removeButton = e.target.closest('.remove-station');
        if (removeButton) {
            removeButton.closest('.row').remove();
        }
    });

    // Check for waypoints and pre-populate aid stations
    const waypointsInput = document.getElementById('waypoints');
    if (waypointsInput && waypointsInput.value) {
        try {
            const waypoints = JSON.parse(waypointsInput.value);
            if (waypoints.length > 0) {
                waypoints.forEach(waypoint => {
                    const index = aidStationInputs.children.length;
                    const newInput = createAidStationInput(index);
                    aidStationInputs.appendChild(newInput);
                    
                    // Fill in the values
                    const nameInput = newInput.querySelector(`input[name="stations[${index}][name]"]`);
                    const mileInput = newInput.querySelector(`input[name="stations[${index}][mile]"]`);
                    nameInput.value = waypoint.name;
                    mileInput.value = waypoint.distance.toFixed(1);
                });
            } else {
                // If no waypoints, add one empty aid station input
                addButton.click();
            }
        } catch (e) {
            console.error('Error parsing waypoints:', e);
            addButton.click();
        }
    } else {
        // If no waypoints, add one empty aid station input
        addButton.click();
    }

    const form = document.getElementById('aidStationsForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get all aid station inputs that exist in the form
        const stations = [];
        const rows = Array.from(aidStationInputs.children);
        
        for (const row of rows) {
            const nameInput = row.querySelector('input[type="text"]');
            const mileInput = row.querySelector('input[type="number"]');
            
            if (nameInput && mileInput && nameInput.value && mileInput.value) {
                stations.push({
                    name: nameInput.value,
                    mile: parseFloat(mileInput.value)
                });
            }
        }
        
        if (stations.length === 0) {
            alert('Please add at least one aid station');
            return;
        }
        
        try {
            const response = await fetch('/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gpxId: document.querySelector('input[name="gpxId"]').value,
                    stations
                })
            });
            
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            
            displayResults(data);
        } catch (error) {
            alert('Error calculating elevation data: ' + error.message);
        }
    });
    
    function displayResults(data) {
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'card mb-4 results';
        resultsDiv.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">Elevation Profile</h5>
                <div class="mb-4">
                    <canvas id="elevationChart"></canvas>
                </div>
                <h5 class="card-title">Segment Results</h5>
                <table class="table">
                    <thead>
                        <tr>
                            <th>From</th>
                            <th>To</th>
                            <th>Distance</th>
                            <th>Elevation Gain</th>
                            <th>Elevation Loss</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.segments.map(segment => `
                            <tr>
                                <td>${segment.start}</td>
                                <td>${segment.end}</td>
                                <td>${segment.distance.toFixed(1)} miles</td>
                                <td>${segment.elevationGain} ft</td>
                                <td>${segment.elevationLoss} ft</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        const existingResults = document.querySelector('.results');
        if (existingResults) {
            existingResults.remove();
        }

        document.querySelector('.container').appendChild(resultsDiv);
        
        // Create elevation chart
        const ctx = document.getElementById('elevationChart').getContext('2d');
        
        // Create datasets array with main elevation profile and aid station markers
        const datasets = [
            {
                label: 'Elevation (ft)',
                type: 'line',
                data: data.elevationProfile.map(p => ({
                    x: p.distance,
                    y: p.elevation
                })),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                tension: 0.1,
                fill: true,
                order: 2
            },
            {
                label: 'Aid Stations',
                data: data.aidStations.map(station => ({
                    x: station.mile,
                    y: station.elevation
                })),
                pointBackgroundColor: 'rgb(255, 99, 132)',
                pointBorderColor: 'white',
                pointBorderWidth: 3,
                pointRadius: 12,
                pointHoverRadius: 15,
                type: 'scatter',
                showLine: false,
                order: 1
            }
        ];
        
        new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                parsing: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 1) {  // Aid station dataset
                                    const station = data.aidStations[context.dataIndex];
                                    return `${station.name} (Mile ${station.mile})`;
                                }
                                return `Elevation: ${Math.round(context.parsed.y)} ft at mile ${context.parsed.x.toFixed(1)}`;
                            }
                        }
                    },
                    annotation: {
                        annotations: data.aidStations.map(station => ({
                            type: 'line',
                            xMin: station.mile,
                            xMax: station.mile,
                            borderColor: 'rgba(255, 99, 132, 0.3)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: station.name,
                                enabled: true,
                                position: 'top',
                                backgroundColor: 'rgba(255, 99, 132, 0.7)',
                                font: {
                                    size: 11
                                }
                            }
                        }))
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Distance (miles)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Elevation (feet)'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                }
            }
        });
    }
}); 