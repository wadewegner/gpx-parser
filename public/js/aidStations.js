document.addEventListener('DOMContentLoaded', function() {
    const aidStationInputs = document.getElementById('aidStationInputs');
    const addButton = document.getElementById('addStation');

    function createAidStationInput(index) {
        const div = document.createElement('div');
        div.className = 'row mb-3';
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
                <button type="button" class="btn btn-danger remove-station">Remove</button>
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
        if (e.target.classList.contains('remove-station')) {
            e.target.closest('.row').remove();
        }
    });

    // Add first aid station input by default
    addButton.click();

    const form = document.getElementById('aidStationsForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const stations = Array.from(aidStationInputs.children).map((row, index) => ({
            name: row.querySelector(`input[name="stations[${index}][name]"]`).value,
            mile: parseFloat(row.querySelector(`input[name="stations[${index}][mile]"]`).value)
        }));
        
        try {
            const response = await fetch('/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gpxFile: document.querySelector('input[name="tempGpxFile"]').value,
                    stations
                })
            });
            
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            
            displayResults(data.segments);
        } catch (error) {
            alert('Error calculating elevation data: ' + error.message);
        }
    });
    
    function displayResults(segments) {
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'card mb-4 results';
        resultsDiv.innerHTML = `
            <div class="card-body">
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
                        ${segments.map(segment => `
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
    }
}); 