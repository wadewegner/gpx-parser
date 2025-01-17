# Race Elevation Analyzer

A web application that analyzes GPX files to calculate elevation profiles and segment statistics for race courses, particularly useful for trail running and ultramarathon events.

## Features

- Upload and parse GPX files
- Automatically detect aid stations from GPX waypoints
- Calculate elevation gain/loss between aid stations
- Visualize elevation profile with interactive chart
- Show aid station locations on the elevation profile
- Calculate segment statistics between aid stations
- Support for out-and-back courses with multiple aid station visits

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