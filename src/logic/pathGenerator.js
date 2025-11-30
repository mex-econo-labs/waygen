import * as turf from '@turf/turf';
import { generateUUID } from '../utils/uuid.js';

// ... (existing imports)

function generateOrbitPath(polygonFeature, settings) {
  const { altitude, speed, gimbalPitch, spacing, straightenLegs, waypointAction, startAngle, direction, numberOfOrbits } = settings;

  // 1. Calculate Center and Radius
  const center = turf.centroid(polygonFeature);
  const centerCoords = center.geometry.coordinates;

  // Calculate average radius from center to all vertices
  const vertices = polygonFeature.geometry.coordinates[0];
  let totalDist = 0;
  vertices.forEach(v => {
    totalDist += turf.distance(center, turf.point(v), { units: 'meters' });
  });
  const radius = totalDist / vertices.length;

  // Ensure minimum number of orbits
  const actualNumberOfOrbits = Math.max(0.1, numberOfOrbits);

  // 2. Calculate Circumference and Number of Points for ONE orbit
  const circumference = 2 * Math.PI * radius;
  const pointsPerOrbit = Math.max(3, Math.round(circumference / spacing));

  // Calculate total number of points for the specified number of orbits
  // Ensure we generate enough points to cover the entire sweep, including the end point
  const totalPointsToGenerate = Math.round(pointsPerOrbit * actualNumberOfOrbits);

  const waypoints = [];

  // Convert startAngle from spec (North=0, CW) to Turf.js bearing (North=0, CW)
  // User expects 0 at 12 o'clock (North).
  const turfStartAngle = startAngle % 360;

  // Calculate total sweep angle
  const totalSweepDegrees = 360 * actualNumberOfOrbits;

  // Check if we should skip the last point (closed loop)
  // If numberOfOrbits is an integer (e.g. 1.0, 2.0), the last point would overlap the first.
  const isClosedLoop = Number.isInteger(actualNumberOfOrbits);

  // 3. Generate Points
  for (let i = 0; i <= totalPointsToGenerate; i++) {
    // Skip the last point if it's a closed loop to avoid duplication
    if (isClosedLoop && i === totalPointsToGenerate) continue;

    // Calculate the angle relative to the startAngle
    let relativeAngle = (i / totalPointsToGenerate) * totalSweepDegrees;

    let currentTurfAngle;
    if (direction === 'clockwise') {
       // Clockwise: Bearing Increases (0 -> 90)
      currentTurfAngle = (turfStartAngle + relativeAngle + 360) % 360;
    } else { 
      // Counter-clockwise: Bearing Decreases (0 -> 270)
      currentTurfAngle = (turfStartAngle - relativeAngle + 360 * 100) % 360;
    }
    
    // Create point at distance 'radius' and bearing 'currentTurfAngle' from center
    // radius / 1000 because turf.destination expects distance in kilometers
    const pt = turf.destination(center, radius / 1000, currentTurfAngle, { units: 'kilometers' });

    // Calculate heading: Point -> Center
    // Bearing from Point to Center is (current point to center)
    const heading = Math.round(turf.bearing(pt, center));

    waypoints.push({
      id: generateUUID(),
      lng: pt.geometry.coordinates[0],
      lat: pt.geometry.coordinates[1],
      altitude: Number(altitude),
      speed: Math.round(Number(speed) * 10) / 10,
      gimbalPitch: Number(gimbalPitch),
      heading: heading,
      straightenLegs: straightenLegs,
      action: waypointAction
    });
  }

  // The loop automatically handles closing for integer numberOfOrbits.
  // If numberOfOrbits is fractional, the path will end at the calculated point.
  // No explicit loop closing needed as the points are generated covering the entire sweep.

  return waypoints;
}

export function generatePhotogrammetryPath(polygonFeature, settings) {
  if (settings.pathType === 'orbit') {
    return generateOrbitPath(polygonFeature, settings);
  }

  const { altitude, sideOverlap, frontOverlap, angle, gimbalPitch, autoDirection, generateEveryPoint, reversePath, speed, straightenLegs, waypointAction, eliminateExtraYaw } = settings;
  // ... (rest of existing grid logic)
  // 1. Calculate Line Spacing in METERS
  // Use customFOV from settings (defaulting to 82.1 if missing)
  const hfov = settings.customFOV || 82.1;
  const FOV_CONSTANT = Math.tan((hfov / 2) * (Math.PI / 180));

  const imageWidth = (altitude * FOV_CONSTANT) * 2;
  const lineSpacingMeters = imageWidth * (1 - (sideOverlap / 100));
  
  // Calculate Front Spacing (needed for filtering short segments)
  const groundHeight = imageWidth * (3 / 4);
  const frontSpacingMeters = groundHeight * (1 - (frontOverlap / 100));

  // 2. Convert Spacing to DEGREES (Lat/Lng approximation)
  const lineSpacingDegrees = lineSpacingMeters / 111111;

  // 3. Define a fixed pivot point for rotation
  const pivot = turf.centroid(polygonFeature);

  // 4. Determine Rotation Angle
  let rotationAngle = angle;
  if (autoDirection) {
    // Find longest edge
    let maxLen = 0;
    let maxBearing = 0;
    const coords = polygonFeature.geometry.coordinates[0];
    for (let i = 0; i < coords.length - 1; i++) {
      const start = turf.point(coords[i]);
      const end = turf.point(coords[i + 1]);
      const dist = turf.distance(start, end);
      if (dist > maxLen) {
        maxLen = dist;
        maxBearing = turf.bearing(start, end);
      }
    }
    rotationAngle = maxBearing;
  }

  // Rotate Polygon
  const rotation = -rotationAngle;
  const rotatedPoly = turf.transformRotate(polygonFeature, rotation, { pivot: pivot });
  const bbox = turf.bbox(rotatedPoly);

  // Generate Grid Lines
  const flightLines = [];
  let currentY = bbox[1] + (lineSpacingDegrees / 2);

  // Ensure we cover the entire bounding box, including the top edge
  while (currentY <= bbox[3] + (lineSpacingDegrees / 10)) {
    const line = turf.lineString([
      [bbox[0] - 0.1, currentY],
      [bbox[2] + 0.1, currentY]
    ]);

    // Clip line to polygon
    const intersected = turf.lineSplit(line, rotatedPoly);

    const getLineCenter = (lineFeat) => {
      const coords = lineFeat.geometry.coordinates;
      if (Array.isArray(coords[0][0])) {
        return turf.midpoint(coords[0][0], coords[0][coords[0].length - 1]);
      }
      return turf.midpoint(coords[0], coords[coords.length - 1]);
    };

    if (intersected.features.length === 0) {
      const center = getLineCenter(line);
      if (turf.booleanPointInPolygon(center, rotatedPoly)) {
        flightLines.push(line.geometry.coordinates);
      }
    } else {
      intersected.features.forEach(seg => {
        const center = getLineCenter(seg);
        // Check if center is inside OR if it's a valid segment on the boundary
        if (turf.booleanPointInPolygon(center, rotatedPoly)) {
          flightLines.push(seg.geometry.coordinates);
        }
      });
    }

    currentY += lineSpacingDegrees;
  }

  // Filter out short rows (Corner Clips)
  // If a row is shorter than the forward spacing, it's likely a tiny corner clip that contributes little to coverage
  // but distorts speed calculations.
  const filteredFlightLines = flightLines.filter(lineCoords => {
    const line = turf.lineString(lineCoords);
    const length = turf.length(line, { units: 'meters' });
    return length >= frontSpacingMeters;
  });

  // Connect Lines
  let waypoints = [];
  filteredFlightLines.forEach((lineCoords, index) => {
    let coords = (index % 2 === 1) ? lineCoords.reverse() : lineCoords;

    // Interpolate points if requested
    if (generateEveryPoint) {
      const start = turf.point(coords[0]);
      const end = turf.point(coords[1]);
      const dist = turf.distance(start, end, { units: 'meters' });

      // Ensure we don't have infinite points if spacing is 0 (shouldn't happen with valid inputs)
      const safeSpacing = Math.max(1, frontSpacingMeters);

      const numPoints = Math.floor(dist / safeSpacing);

      if (numPoints >= 1) {
        const line = turf.lineString(coords);
        const newCoords = [];
        for (let i = 0; i <= numPoints; i++) {
          const pt = turf.along(line, (i * safeSpacing) / 1000, { units: 'kilometers' }); // turf.along uses km by default or takes units
          // Actually turf.along takes (line, distance, options). Distance unit defaults to km.
          // Let's be explicit.
          const ptMeters = turf.along(line, i * safeSpacing, { units: 'meters' });
          newCoords.push(ptMeters.geometry.coordinates);
        }
        // Ensure the last point is included if it's significantly far from the last interpolated point
        // Or just rely on the loop. The loop goes up to numPoints * spacing. 
        // If dist is 100 and spacing is 30: 0, 30, 60, 90. 
        // The end point is at 100. We might want to add it if it's not covered.
        // Standard photogrammetry usually wants consistent spacing. 
        // Let's stick to the calculated intervals.

        coords = newCoords;
      }
    }

    coords.forEach((c, i) => {
      const isRowEnd = i === coords.length - 1;
      waypoints.push({
        id: generateUUID(),
        lng: c[0],
        lat: c[1],
        altitude: Number(altitude),
        speed: Math.round(Number(speed) * 10) / 10,
        gimbalPitch: Number(gimbalPitch),
        heading: 0,
        straightenLegs: straightenLegs,
        action: waypointAction,
        _isRowEnd: isRowEnd, // Temporary flag
        _isRowStart: i === 0 // Temporary flag for reverse path
      });
    });
  });

  // Prune Short Transitions
  // If the distance between the end of one row and the start of the next is less than the forward spacing,
  // drop the end point of the current row to "merge" the segment.
  // This effectively cuts the corner.
  const prunedWaypoints = [];
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    
    // Check if this is a row end and NOT the very last point of the mission
    if (wp._isRowEnd && i < waypoints.length - 1) {
      const nextWp = waypoints[i + 1];
      const distToNext = turf.distance(
        turf.point([wp.lng, wp.lat]), 
        turf.point([nextWp.lng, nextWp.lat]), 
        { units: 'meters' }
      );

      if (distToNext < frontSpacingMeters) {
        // Skip adding this waypoint (drop it)
        continue; 
      }
    }
    prunedWaypoints.push(wp);
  }
  waypoints = prunedWaypoints;

  // Rotate back
  if (waypoints.length === 0) return [];

  const flatPoints = turf.points(waypoints.map(p => [p.lng, p.lat]));
  const restoredPoints = turf.transformRotate(flatPoints, rotationAngle, { pivot: pivot });

  restoredPoints.features.forEach((pt, i) => {
    waypoints[i].lng = pt.geometry.coordinates[0];
    waypoints[i].lat = pt.geometry.coordinates[1];
  });

  // Reverse if requested
  if (reversePath) {
    waypoints.reverse();
  }

  // Calculate Headings (Point to next waypoint)
  let lockedHeading = null;

  for (let i = 0; i < waypoints.length; i++) {
    const isEffectiveRowEnd = reversePath ? waypoints[i]._isRowStart : waypoints[i]._isRowEnd;
    let segmentHeading = 0;

    if (isEffectiveRowEnd && i > 0) {
      // If it's the end of a row, retain the heading of the previous point (the row's heading)
      // This prevents the camera from turning towards the next row's start point
      segmentHeading = waypoints[i - 1].heading;
    } else if (i < waypoints.length - 1) {
      const start = turf.point([waypoints[i].lng, waypoints[i].lat]);
      const end = turf.point([waypoints[i + 1].lng, waypoints[i + 1].lat]);
      segmentHeading = Math.round(turf.bearing(start, end));
    } else {
      // Last point of the entire path inherits the heading of the segment leading up to it
      if (i > 0) segmentHeading = waypoints[i - 1].heading;
    }

    if (eliminateExtraYaw) {
      // If this is the first point (or first calculation), set the locked heading
      if (lockedHeading === null) {
        lockedHeading = segmentHeading;
      }
      waypoints[i].heading = lockedHeading;
    } else {
      waypoints[i].heading = segmentHeading;
    }

    // Remove temporary flags
    delete waypoints[i]._isRowEnd;
    delete waypoints[i]._isRowStart;
  }

  return waypoints;
}
