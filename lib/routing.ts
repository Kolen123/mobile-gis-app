// lib/routing.ts - Enhanced version with Mapbox real paths

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuver?: string;
}

export interface Route {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  steps: RouteStep[];
  hasWalkingPath?: boolean;
}

// Add your Mapbox token here
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'your_mapbox_token_here';

/**
 * Calculate straight-line distance between two points (Haversine formula)
 */
function calculateDistance(
  point1: [number, number],
  point2: [number, number]
): number {
  const [lat1, lon1] = point1;
  const [lat2, lon2] = point2;
  
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Generate a walking path from road to building entrance
 */
function generateWalkingPath(
  from: [number, number],
  to: [number, number],
  segments: number = 3
): [number, number][] {
  const path: [number, number][] = [from];
  
  for (let i = 1; i <= segments; i++) {
    const ratio = i / (segments + 1);
    const lat = from[0] + (to[0] - from[0]) * ratio;
    const lng = from[1] + (to[1] - from[1]) * ratio;
    path.push([lat, lng]);
  }
  
  path.push(to);
  return path;
}

/**
 * Get walking route using Mapbox Directions API
 * Uses real pedestrian paths, sidewalks, and footways
 */
export async function getWalkingRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<Route | null> {
  try {
    // Mapbox uses lng,lat format
    const originStr = `${origin[1]},${origin[0]}`;
    const destStr = `${destination[1]},${destination[0]}`;
    
    // Mapbox Directions API with walking profile
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${originStr};${destStr}?` +
      `geometries=geojson&` +
      `steps=true&` +
      `banner_instructions=true&` +
      `voice_instructions=true&` +
      `access_token=${MAPBOX_TOKEN}`
    );

    if (!response.ok) {
      console.error('Mapbox API error:', response.status);
      // Fallback to OSRM if Mapbox fails
      return getOSRMRoute(origin, destination);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      return getOSRMRoute(origin, destination);
    }

    const route = data.routes[0];
    
    // Convert coordinates from [lng, lat] to [lat, lng]
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );

    // Check if we need walking paths at start/end
    const firstPoint = coordinates[0];
    const lastPoint = coordinates[coordinates.length - 1];
    const distanceFromOrigin = calculateDistance(origin, firstPoint);
    const distanceToDestination = calculateDistance(lastPoint, destination);
    
    let finalCoordinates = [...coordinates];
    let hasWalkingPath = false;

    // Add walking path from origin to first road point
    if (distanceFromOrigin > 10) {
      const walkingPath = generateWalkingPath(origin, firstPoint, 4);
      finalCoordinates = [...walkingPath.slice(0, -1), ...finalCoordinates];
      hasWalkingPath = true;
    }

    // Add walking path from last road point to destination
    if (distanceToDestination > 10) {
      const walkingPath = generateWalkingPath(lastPoint, destination, 4);
      finalCoordinates = [...finalCoordinates, ...walkingPath.slice(1)];
      hasWalkingPath = true;
    }

    // Process steps
    const steps: RouteStep[] = [];
    
    // Add initial walking step if needed
    if (distanceFromOrigin > 10) {
      steps.push({
        instruction: "Walk to the nearest path",
        distance: Math.round(distanceFromOrigin),
        duration: Math.round(distanceFromOrigin / 1.4),
        maneuver: "depart"
      });
    }

    // Add Mapbox route steps
    route.legs[0].steps.forEach((step: any) => {
      steps.push({
        instruction: step.maneuver.instruction || 'Continue',
        distance: Math.round(step.distance),
        duration: Math.round(step.duration),
        maneuver: step.maneuver.type
      });
    });

    // Add final walking step if needed
    if (distanceToDestination > 10) {
      steps.push({
        instruction: "Walk to building entrance",
        distance: Math.round(distanceToDestination),
        duration: Math.round(distanceToDestination / 1.4),
        maneuver: "arrive"
      });
    }

    return {
      coordinates: finalCoordinates,
      distance: route.distance,
      duration: route.duration,
      steps,
      hasWalkingPath
    };
  } catch (error) {
    console.error('Mapbox routing error:', error);
    // Fallback to OSRM
    return getOSRMRoute(origin, destination);
  }
}

/**
 * Fallback to free OSRM routing if Mapbox fails
 */
async function getOSRMRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<Route | null> {
  try {
    const originStr = `${origin[1]},${origin[0]}`;
    const destStr = `${destination[1]},${destination[0]}`;
    
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/foot/${originStr};${destStr}?overview=full&geometries=geojson&steps=true`
    );

    if (!response.ok) {
      throw new Error('OSRM routing failed');
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    const roadCoordinates: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );

    const lastRoadPoint = roadCoordinates[roadCoordinates.length - 1];
    const distanceToDestination = calculateDistance(lastRoadPoint, destination);
    
    let finalCoordinates = [...roadCoordinates];
    let hasWalkingPath = false;

    if (distanceToDestination > 10) {
      const walkingPath = generateWalkingPath(lastRoadPoint, destination, 4);
      finalCoordinates = [...roadCoordinates, ...walkingPath.slice(1)];
      hasWalkingPath = true;
    }

    const firstRoadPoint = roadCoordinates[0];
    const distanceFromOrigin = calculateDistance(origin, firstRoadPoint);
    
    if (distanceFromOrigin > 10) {
      const walkingPath = generateWalkingPath(origin, firstRoadPoint, 4);
      finalCoordinates = [...walkingPath.slice(0, -1), ...finalCoordinates];
      hasWalkingPath = true;
    }

    const steps: RouteStep[] = [];
    
    if (distanceFromOrigin > 10) {
      steps.push({
        instruction: "Walk to the nearest path",
        distance: Math.round(distanceFromOrigin),
        duration: Math.round(distanceFromOrigin / 1.4),
        maneuver: "depart"
      });
    }

    route.legs[0].steps.forEach((step: any) => {
      if (step.maneuver.type !== 'arrive') {
        steps.push({
          instruction: step.maneuver.instruction || getInstructionFromManeuver(step),
          distance: Math.round(step.distance),
          duration: Math.round(step.duration),
          maneuver: step.maneuver.type
        });
      }
    });

    if (distanceToDestination > 10) {
      steps.push({
        instruction: "Walk to building entrance",
        distance: Math.round(distanceToDestination),
        duration: Math.round(distanceToDestination / 1.4),
        maneuver: "arrive"
      });
    }

    steps.push({
      instruction: "Arrive at destination",
      distance: 0,
      duration: 0,
      maneuver: "arrive"
    });

    const totalDistance = steps.reduce((sum, step) => sum + step.distance, 0);
    const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

    return {
      coordinates: finalCoordinates,
      distance: totalDistance,
      duration: totalDuration,
      steps,
      hasWalkingPath
    };
  } catch (error) {
    console.error('OSRM fallback error:', error);
    return null;
  }
}

/**
 * Generate instruction from OSRM maneuver data
 */
function getInstructionFromManeuver(step: any): string {
  const type = step.maneuver.type;
  const modifier = step.maneuver.modifier;
  const name = step.name || 'the road';

  const instructions: { [key: string]: string } = {
    'turn-sharp-right': `Turn sharp right onto ${name}`,
    'turn-right': `Turn right onto ${name}`,
    'turn-slight-right': `Turn slight right onto ${name}`,
    'turn-sharp-left': `Turn sharp left onto ${name}`,
    'turn-left': `Turn left onto ${name}`,
    'turn-slight-left': `Turn slight left onto ${name}`,
    'straight': `Continue straight on ${name}`,
    'continue': `Continue on ${name}`,
    'depart': `Head ${modifier || 'forward'} on ${name}`,
  };

  return instructions[`${type}${modifier ? '-' + modifier : ''}`] || 
         instructions[type] || 
         `Continue on ${name}`;
}

/**
 * Simplified route for direct building-to-building
 */
export async function getDirectRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<Route> {
  const distance = calculateDistance(origin, destination);
  const duration = distance / 1.4;

  return {
    coordinates: [origin, destination],
    distance,
    duration,
    steps: [
      {
        instruction: "Walk directly to destination",
        distance,
        duration,
        maneuver: "depart"
      },
      {
        instruction: "Arrive at destination",
        distance: 0,
        duration: 0,
        maneuver: "arrive"
      }
    ],
    hasWalkingPath: true
  };
}