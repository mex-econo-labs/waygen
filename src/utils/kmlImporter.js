import { kml } from '@tmcw/togeojson';
import JSZip from 'jszip';

export const parseImport = async (file) => {
  // 1. Handle raw KML files (text)
  if (file.name.toLowerCase().endsWith('.kml')) {
    const text = await file.text();
    const dom = new DOMParser().parseFromString(text, 'text/xml');
    return { geojson: kml(dom), sessionData: null };
  }

  // 2. Handle KMZ files (zip)
  if (file.name.toLowerCase().endsWith('.kmz')) {
    try {
      const zip = await JSZip.loadAsync(file);

      // CRITICAL FIX: Look for DJI "waylines.wpml" FIRST.
      // DJI puts metadata in 'template.kml' (empty) and points in 'waylines.wpml'.
      let targetFile = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('waylines.wpml'));

      // Fallback: If not a DJI drone file, look for standard doc.kml
      if (!targetFile) {
        targetFile = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('.kml'));
      }

      if (targetFile) {
        const xmlText = await zip.file(targetFile).async('text');
        const xmlDom = new DOMParser().parseFromString(xmlText, 'text/xml');

        // Convert XML to GeoJSON
        const geoJSON = kml(xmlDom);

        // ENRICHMENT: Manually extract WPML data that togeojson misses
        const placemarks = Array.from(xmlDom.getElementsByTagName("Placemark"));

        // Helper to get tag value, trying both with and without "wpml:" prefix, and checking localName
        const getTagValue = (element, tagName) => {
          // 1. Try standard getElementsByTagName (fastest)
          let tags = element.getElementsByTagName("wpml:" + tagName);
          if (tags.length > 0) return tags[0].textContent;

          tags = element.getElementsByTagName(tagName);
          if (tags.length > 0) return tags[0].textContent;

          // 2. Brute force: iterate all children to match localName (handles namespace weirdness)
          const allTags = element.getElementsByTagName("*");
          for (let i = 0; i < allTags.length; i++) {
            if (allTags[i].localName === tagName) {
              return allTags[i].textContent;
            }
          }
          return null;
        };

        // Strategy: Try to match by Index first (most robust for generated files), then by Coordinates
        const useIndexMatching = geoJSON.features.length === placemarks.length;

        geoJSON.features.forEach((feature, index) => {
          if (feature.geometry.type === 'Point') {
            let match = null;

            if (useIndexMatching) {
              match = placemarks[index];
            } else {
              // Fallback: Find matching Placemark by coordinates (fuzzy match)
              const [fLng, fLat] = feature.geometry.coordinates;
              match = placemarks.find(pm => {
                const point = pm.getElementsByTagName("Point")[0];
                if (!point) return false;
                const coordsText = point.getElementsByTagName("coordinates")[0]?.textContent || "";
                const coords = coordsText.trim().split(',');
                if (coords.length < 2) return false;

                const pLng = Number(coords[0]);
                const pLat = Number(coords[1]);

                // Use a slightly larger epsilon for float comparison
                return Math.abs(pLng - fLng) < 0.0001 && Math.abs(pLat - fLat) < 0.0001;
              });
            }

            if (match) {
              // Heading: Try standard 'waypointHeading' then nested 'waypointHeadingAngle'
              let heading = getTagValue(match, "waypointHeading");
              if (heading === null) heading = getTagValue(match, "waypointHeadingAngle");

              // Speed: 'waypointSpeed'
              const speed = getTagValue(match, "waypointSpeed");

              // Altitude: 'ellipsoidHeight' -> 'height' -> 'executeHeight'
              let altitude = getTagValue(match, "ellipsoidHeight");
              if (altitude === null) altitude = getTagValue(match, "height");
              if (altitude === null) altitude = getTagValue(match, "executeHeight");

              // Gimbal: 'gimbalPitchAngle'
              const gimbal = getTagValue(match, "gimbalPitchAngle");

              if (heading !== null) feature.properties.heading = Number(heading);
              if (speed !== null) feature.properties.speed = Number(speed);
              if (altitude !== null) feature.properties.altitude = Number(altitude);
              if (gimbal !== null) feature.properties.gimbalPitch = Number(gimbal);
            }
          }
        });

        // Valid KMLs might return empty features if parsing failed
        if (!geoJSON || !geoJSON.features || geoJSON.features.length === 0) {
          throw new Error("No features found in KML/WPML file.");
        }

        // 4. Extract Session Data if available
        let sessionData = null;
        const sessionFile = zip.file("waygen_session.json");
        if (sessionFile) {
          try {
            const sessionText = await sessionFile.async("text");
            sessionData = JSON.parse(sessionText);
          } catch (err) {
            console.warn("Failed to parse session data:", err);
          }
        }

        return { geojson: geoJSON, sessionData };
      } else {
        throw new Error("No valid KML or WPML file found inside KMZ.");
      }
    } catch (e) {
      console.error("KMZ Parse Error:", e);
      throw new Error("Failed to unzip or parse KMZ.");
    }
  }

  throw new Error("Unsupported file format. Please use .kml or .kmz");
};
