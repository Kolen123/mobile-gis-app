// lib/routing.ts
export interface RouteStep {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
  coordinates: [number, number];
}

export interface Route {
  coordinates: [number, number][]; // Path coordinates
  distance: number; // Total distance in meters
  duration: number; // Total duration in seconds
  steps: RouteStep[];
}

export async function getWalkingRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<Route | null> {
  try {
    // OSRM API - Free routing service
    const url = `https://router.project-osrm.org/route/v1/foot/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&steps=true`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error('No route found');
      return null;
    }
    
    const route = data.routes[0];
    
    // Extract coordinates from the route
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (coord: number[]) => [coord[1], coord[0]] // Convert [lng, lat] to [lat, lng]
    );
    
    // Extract turn-by-turn steps
    const steps: RouteStep[] = route.legs[0].steps.map((step: any) => ({
      instruction: step.maneuver.type === 'arrive' 
        ? `Arrive at destination` 
        : step.name 
          ? `Continue on ${step.name}` 
          : `Head ${step.maneuver.modifier || 'straight'}`,
      distance: Math.round(step.distance),
      duration: Math.round(step.duration),
      coordinates: [step.maneuver.location[1], step.maneuver.location[0]]
    }));
    
    return {
      coordinates,
      distance: Math.round(route.distance),
      duration: Math.round(route.duration),
      steps
    };
  } catch (error) {
    console.error('Error fetching route:', error);
    return null;
  }
}
// Calculate walking path from road to building entrance
export function getLastMilePath(
  roadEndPoint: [number, number],
  buildingPoint: [number, number]
): [number, number][] {
  // Create a straight dotted path from road to building
  const steps = 5; // Number of dots
  const path: [number, number][] = [];
  
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const lat = roadEndPoint[0] + (buildingPoint[0] - roadEndPoint[0]) * ratio;
    const lng = roadEndPoint[1] + (buildingPoint[1] - roadEndPoint[1]) * ratio;
    path.push([lat, lng]);
  }
  
  return path;
}