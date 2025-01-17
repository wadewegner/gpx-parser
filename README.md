# Race Elevation Analyzer

An application to analyze elevation profiles and plan aid station strategies for races using GPX files.

## Features

- Upload and parse GPX files
- Interactive elevation profile visualization
- Aid station placement and analysis
- Segment-by-segment elevation statistics
- GPX elevation smoothing for more accurate calculations

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/race-elevation-analyzer.git
   cd race-elevation-analyzer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   node app.js
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

1. **Upload GPX File**
   - Click "Choose File" and select your GPX file
   - Click "Upload" to process the file
   - If your GPX file contains waypoints for aid stations, they will be automatically populated

2. **Add Aid Stations**
   - Enter aid station names and their mile markers
   - Click "Add Aid Station" for additional aid stations
   - Use "Remove" to delete unwanted aid stations

3. **Calculate Elevation Data**
   - Click "Calculate Elevation Data" to generate:
     - Interactive elevation profile chart
     - Aid station markers on the chart
     - Segment breakdown with statistics

4. **View Results**
   - The elevation profile shows:
     - Course elevation in blue
     - Aid stations as pink markers
     - Hover over points for elevation details
   - The segment results table shows:
     - Distance between stations
     - Elevation gain/loss per segment

## Project Structure 

## Elevation Data Accuracy

GPX files can sometimes contain noisy elevation data that leads to inflated elevation gain calculations. This tool uses smoothing to improve accuracy:

**GPX Smoothing**: Reduces noise in the elevation data using the Ramer-Douglas-Peucker algorithm for more accurate elevation calculations. 