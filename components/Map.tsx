// components/Map.tsx
'use client';
import { Polyline, CircleMarker } from 'react-leaflet';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Clock, Phone, Mail, MapPin, Wrench, ExternalLink } from 'lucide-react';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Building {
  id: number;
  name: string | null;
  center_lat: number;
  center_lng: number;
  category?: {
    name: string;
    color: string;
  };
  details?: {
    description: string | null;
    opening_hours: string | null;
    facilities_count: number;
    contact_phone: string | null;
    contact_email: string | null;
  };
}

interface MapProps {
  buildings: Building[];
  center?: [number, number];
  zoom?: number;
  selectedBuildingId?: number | null;
  onBuildingClick?: (buildingId: number) => void;
  onGetDirections?: (buildingId: number) => void;
  routeCoordinates?: [number, number][];
  userLocation?: [number, number] | null;
  hasWalkingPath?: boolean;
}

// Custom marker icon creator for buildings
function createCustomIcon(color: string = '#0891B2', isSelected: boolean = false) {
  const size = isSelected ? 40 : 32;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: ${isSelected ? '4px' : '3px'} solid white;
        box-shadow: 0 ${isSelected ? '4px 12px' : '2px 8px'} rgba(0,0,0,${isSelected ? '0.4' : '0.3'});
        ${isSelected ? 'animation: pulse 2s infinite;' : ''}
      ">
        <div style="
          transform: rotate(45deg);
          color: white;
          font-size: ${isSelected ? '20px' : '16px'};
          margin-top: ${isSelected ? '6px' : '4px'};
          text-align: center;
        ">📍</div>
      </div>
      ${isSelected ? `
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1) rotate(-45deg); }
            50% { transform: scale(1.1) rotate(-45deg); }
          }
        </style>
      ` : ''}
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

// Origin marker icon (green circular marker for user location)
function createOriginIcon() {
  return L.divIcon({
    className: 'origin-marker',
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 32px;
          height: 32px;
          background-color: #10b981;
          border-radius: 50%;
          border: 4px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 12px;
          height: 12px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// Destination marker icon (red for destination during navigation)
function createDestinationIcon() {
  const size = 40;
  
  return L.divIcon({
    className: 'destination-marker',
    html: `
      <div style="
        background-color: #EF4444;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 4px solid white;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
        animation: pulse-destination 2s infinite;
      ">
        <div style="
          transform: rotate(45deg);
          color: white;
          font-size: 20px;
          margin-top: 6px;
          text-align: center;
        ">🎯</div>
      </div>
      <style>
        @keyframes pulse-destination {
          0%, 100% { transform: scale(1) rotate(-45deg); }
          50% { transform: scale(1.1) rotate(-45deg); }
        }
      </style>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

// Component to handle map centering - FIXED VERSION
function MapUpdater({ 
  center,
  zoom,
  selectedBuildingId, 
  buildings 
}: { 
  center: [number, number];
  zoom: number;
  selectedBuildingId?: number | null;
  buildings: Building[];
}) {
  const map = useMap();
  
  useEffect(() => {
    if (map && center && center[0] != null && center[1] != null) {
      try {
        // FIX: Use zoom prop instead of map.getZoom()
        map.setView(center, zoom);
        
        if (selectedBuildingId) {
          setTimeout(() => {
            map.eachLayer((layer: any) => {
              if (layer instanceof L.Marker) {
                const building = buildings.find(b => b.id === selectedBuildingId);
                if (building && 
                    layer.getLatLng().lat === building.center_lat && 
                    layer.getLatLng().lng === building.center_lng) {
                  layer.openPopup();
                }
              }
            });
          }, 300);
        }
      } catch (error) {
        console.error('Error updating map view:', error);
      }
    }
  }, [center, zoom, map, selectedBuildingId, buildings]);
  
  return null;
}

function ZoomUpdater({ zoom }: { zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (map && zoom) {
      map.setZoom(zoom);
    }
  }, [zoom, map]);
  
  return null;
}

export function Map({ 
  buildings, 
  center = [-0.3970, 36.9580], 
  zoom = 17,
  selectedBuildingId = null,
  onBuildingClick,
  onGetDirections,
  routeCoordinates = [],
  userLocation = null,
  hasWalkingPath = false
}: MapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  // Check if navigation is active (has route and user location)
  const isNavigating = routeCoordinates.length > 0 && userLocation;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="w-full h-full z-0"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* FIX: Pass zoom prop to MapUpdater */}
      <MapUpdater 
        center={center}
        zoom={zoom}
        selectedBuildingId={selectedBuildingId}
        buildings={buildings}
      />
      <ZoomUpdater zoom={zoom} />
      
      {/* User Location Marker - Always show when we have user location */}
      {userLocation && (
        <Marker
          position={userLocation}
          icon={createOriginIcon()}
          zIndexOffset={1000}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h3 className="font-bold text-green-600 mb-1 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                You Are Here
              </h3>
              <p className="text-sm text-gray-600">
                {isNavigating ? 'Starting point' : 'Your current location'}
              </p>
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  📍 {userLocation[0].toFixed(6)}, {userLocation[1].toFixed(6)}
                </p>
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* ROUTE LINE - Enhanced with walking paths */}
      {routeCoordinates && routeCoordinates.length > 0 && (
        <>
          {/* Main solid route */}
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#2563eb',
              weight: 5,
              opacity: 0.8,
              lineJoin: 'round',
              lineCap: 'round'
            }}
          />
          
         {/* Dotted walking paths at start and end */}
{hasWalkingPath && (
  <>
    {/* Origin to road - dotted green */}
    <Polyline
      positions={routeCoordinates.slice(0, 5)} // First 5 points
      pathOptions={{
        color: '#10b981',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10', // Creates dots
        lineCap: 'round'
      }}
    />
    
    {/* Road to destination - dotted green */}
    <Polyline
      positions={routeCoordinates.slice(-5)} // Last 5 points
      pathOptions={{
        color: '#10b981',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10', // Creates dots
        lineCap: 'round'
      }}
    />
  </>
)}
          
          {/* Start marker - green circle */}
          <CircleMarker
            center={routeCoordinates[0]}
            radius={8}
            pathOptions={{
              fillColor: '#10b981',
              fillOpacity: 1,
              color: 'white',
              weight: 3
            }}
          />
          
          {/* End marker - red circle */}
          <CircleMarker
            center={routeCoordinates[routeCoordinates.length - 1]}
            radius={8}
            pathOptions={{
              fillColor: '#ef4444',
              fillOpacity: 1,
              color: 'white',
              weight: 3
            }}
          />
        </>
      )}

      {/* Building Markers with Enhanced Popups */}
      {buildings
        .filter(building => 
          building.center_lat != null && 
          building.center_lng != null &&
          !isNaN(building.center_lat) &&
          !isNaN(building.center_lng)
        )
        .map((building) => {
          const color = building.category?.color || '#0891B2';
          const isSelected = building.id === selectedBuildingId;
          
          // Use destination icon if this building is selected during navigation
          const useDestinationIcon = isSelected && isNavigating;
          
          return (
            <Marker
              key={building.id}
              position={[building.center_lat, building.center_lng]}
              icon={useDestinationIcon ? createDestinationIcon() : createCustomIcon(color, isSelected)}
              eventHandlers={{
                click: () => {
                  if (onBuildingClick) {
                    onBuildingClick(building.id);
                  }
                },
              }}
            >
              <Popup className="custom-popup" maxWidth={300}>
                <div className="p-3 min-w-[280px]">
                  {/* Header */}
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {building.name || 'Unnamed Building'}
                      {useDestinationIcon && (
                        <span className="ml-2 text-red-500 text-sm">🎯 Destination</span>
                      )}
                    </h3>
                    {building.category && (
                      <span
                        className="inline-block px-2 py-1 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: `${color}15`,
                          color: color
                        }}
                      >
                        {building.category.name}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {building.details?.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {building.details.description}
                    </p>
                  )}

                  {/* Building Info */}
                  <div className="space-y-2 mb-3">
                    {building.details?.opening_hours && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span>{building.details.opening_hours}</span>
                      </div>
                    )}

                    {building.details?.facilities_count && building.details.facilities_count > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Wrench className="w-4 h-4 text-gray-500" />
                        <span>{building.details.facilities_count} facilities</span>
                      </div>
                    )}

                    {building.details?.contact_phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <a href={`tel:${building.details.contact_phone}`} className="hover:text-cyan-600">
                          {building.details.contact_phone}
                        </a>
                      </div>
                    )}

                    {building.details?.contact_email && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <a href={`mailto:${building.details.contact_email}`} className="hover:text-cyan-600 truncate">
                          {building.details.contact_email}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => onGetDirections && onGetDirections(building.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                      style={{ backgroundColor: color }}
                    >
                      <Navigation className="w-4 h-4" />
                      <span>Directions</span>
                    </button>
                    <button
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${building.center_lat},${building.center_lng}`, '_blank')}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Open in Google Maps"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </MapContainer>
  );
}