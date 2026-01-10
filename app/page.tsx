'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import dynamic from 'next/dynamic';
import { getWalkingRoute, Route } from '@/lib/routing';
import { 
  Menu, 
  Search, 
  Locate, 
  Plus, 
  Minus,
  Loader2,
  X,
  Navigation,
  Star,
  ChevronRight,
  MapPin,
  Heart,
  Building2,
} from 'lucide-react';

const Map = dynamic(() => import('@/components/Map').then(mod => ({ default: mod.Map })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <Loader2 className="w-12 h-12 animate-spin text-cyan-600" />
    </div>
  )
});

interface Recommendation {
  source_type: string;
  source_id: number;
  name: string;
  category: string;
  color: string;
  icon: string;
  type: string;
  amenity: string;
  lat: number;
  lng: number;
  description: string;
  facilities_count: number;
  priority: number;
}

interface Building {
  id: number;
  name: string | null;
  center_lat: number;
  center_lng: number;
  category?: {
    name: string;
    color: string;
  };
  details?: any;
}

function MapPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams.get('from');
  const toId = searchParams.get('to');
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Building[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [allBuildings, setAllBuildings] = useState<Building[]>([]);
  const [visibleBuildings, setVisibleBuildings] = useState<Building[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-0.3970, 36.9580]);
  const [mapZoom, setMapZoom] = useState(16);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Load buildings and recommendations on mount
  useEffect(() => {
    loadBuildings();
    loadRecommendations();
  }, []);

  // Auto-show recommendations after initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (visibleBuildings.length === 0 && !isNavigating && !searchQuery && !loading) {
        setShowRecommendations(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [loading]);

  // Auto-show recommendations when map is cleared
  useEffect(() => {
    if (visibleBuildings.length === 0 && !isNavigating && !loading && !searchQuery) {
      const timer = setTimeout(() => {
        setShowRecommendations(true);
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      if (visibleBuildings.length > 0) {
        setShowRecommendations(false);
      }
    }
  }, [visibleBuildings, isNavigating, loading, searchQuery]);

  useEffect(() => {
    if (fromId && toId && allBuildings.length > 0) {
      handleNavigationMode();
    }
  }, [fromId, toId, allBuildings]);

  useEffect(() => {
    const selectedId = searchParams.get('selected');
    if (selectedId && allBuildings.length > 0) {
      const building = allBuildings.find(b => b.id === parseInt(selectedId));
      if (building) {
        setMapCenter([building.center_lat, building.center_lng]);
        setMapZoom(19);
        setSelectedBuildingId(building.id);
        setVisibleBuildings([building]);
        setSearchQuery(building.name || '');
      }
    }
  }, [searchParams, allBuildings]);

  async function fetchAndDisplayRoute(
    origin: [number, number],
    destinationId: number
  ) {
    const destination = allBuildings.find(b => b.id === destinationId);
    
    if (!destination) return;
    
    const route = await getWalkingRoute(
      origin,
      [destination.center_lat, destination.center_lng]
    );
    
    if (route) {
      setActiveRoute(route);
      setRouteCoordinates(route.coordinates);
      
      setMapCenter([
        (origin[0] + destination.center_lat) / 2,
        (origin[1] + destination.center_lng) / 2
      ]);
      setMapZoom(16);
      
      setSelectedBuildingId(destination.id);
      setVisibleBuildings([destination]);
    }
  }

  async function handleNavigationMode() {
    if (!fromId || !toId) return;
    
    setIsNavigating(true);
    
    let originCoords: [number, number] | null = null;
    
    if (parseInt(fromId) === 0) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            originCoords = [position.coords.latitude, position.coords.longitude];
            setUserLocation(originCoords);
            await fetchAndDisplayRoute(originCoords, parseInt(toId));
          },
          (error) => {
            console.error('Could not get location');
          }
        );
      }
    } else {
      const origin = allBuildings.find(b => b.id === parseInt(fromId));
      if (origin) {
        originCoords = [origin.center_lat, origin.center_lng];
        setUserLocation(originCoords);
        await fetchAndDisplayRoute(originCoords, parseInt(toId));
      }
    }
  }

  function exitNavigationMode() {
    setIsNavigating(false);
    setVisibleBuildings([]);
    setSelectedBuildingId(null);
    setActiveRoute(null);
    setRouteCoordinates([]);
    setShowStepsModal(false);
    setUserLocation(null);
    router.push('/');
  }

  async function loadBuildings() {
    try {
      const { data } = await supabase
        .from('buildings')
        .select(`
          id,
          name,
          center_lat,
          center_lng,
          category:building_categories(name, color),
          details:building_details(
            description,
            opening_hours,
            facilities_count,
            contact_phone,
            contact_email
          )
        `);

      if (data) {
        const buildings: Building[] = data.map((item: any) => ({
          ...item,
          category: Array.isArray(item.category) ? item.category[0] : item.category,
          details: Array.isArray(item.details) ? item.details[0] : item.details
        }));
        setAllBuildings(buildings);
        setVisibleBuildings([]);
      }
    } catch (error) {
      console.error('Error loading buildings:', error);
    } finally {
      setLoading(false);
    }
  }

  function getUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
          ];
          
          setUserLocation(userCoords);
          setMapCenter(userCoords);
          setMapZoom(18);
        },
        (error) => {
          const campusCoords: [number, number] = [-0.3959, 36.9636];
          setUserLocation(campusCoords);
          setMapCenter(campusCoords);
          setMapZoom(17);
        },
        {
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 60000
        }
      );
    } else {
      const campusCoords: [number, number] = [-0.3959, 36.9636];
      setUserLocation(campusCoords);
      setMapCenter(campusCoords);
      setMapZoom(17);
    }
  }

  async function loadRecommendations() {
    try {
      const { data } = await supabase
        .from('v_map_recommendations')
        .select('*')
        .order('priority')
        .order('name')
        .limit(10);

      if (data) {
        setRecommendations(data);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      setVisibleBuildings([]);
      return;
    }

    const { data } = await supabase
      .from('buildings')
      .select(`
        id,
        name,
        center_lat,
        center_lng,
        category:building_categories(name, color)
      `)
      .ilike('name', `%${query}%`)
      .limit(10);

    if (data) {
      const buildings: Building[] = data.map((item: any) => ({
        ...item,
        category: Array.isArray(item.category) ? item.category[0] : item.category
      }));
      setSearchResults(buildings);
      setShowSearchResults(true);
      setVisibleBuildings(buildings);
      
      if (buildings.length === 0) {
        setTimeout(() => setShowRecommendations(true), 500);
      }
    }
  }

  function selectBuilding(building: Building) {
    setShowSearchResults(false);
    setSearchQuery(building.name || '');
    setMapCenter([building.center_lat, building.center_lng]);
    setMapZoom(19);
    setSelectedBuildingId(building.id);
    setVisibleBuildings([building]);
  }

  function handleBuildingClick(buildingId: number) {
    setSelectedBuildingId(buildingId);
    const building = allBuildings.find(b => b.id === buildingId);
    if (building) {
      setMapCenter([building.center_lat, building.center_lng]);
      setMapZoom(19);
      setVisibleBuildings([building]);
    }
  }

  function handleLocateMe() {
    setSelectedBuildingId(null);
    setVisibleBuildings([]);
    setSearchQuery('');
    getUserLocation();
  }

  function clearMap() {
    setVisibleBuildings([]);
    setSearchQuery('');
    setSelectedBuildingId(null);
  }

  function handleGetDirections(buildingId: number) {
    router.push(`/directions?to=${buildingId}`);
  }

 // FIXED RecommendationsPanel Component
// Replace the entire RecommendationsPanel function in your page.tsx

function RecommendationsPanel() {
  if (!showRecommendations || recommendations.length === 0) return null;

  const [snapPosition, setSnapPosition] = useState<'collapsed' | 'half' | 'expanded'>('half');
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const snapPositions = {
    collapsed: 15,
    half: 35,
    expanded: 70
  };

  // Calculate current height during drag
  const currentHeight = isDragging 
    ? Math.max(15, Math.min(85, snapPositions[snapPosition] + ((startY - currentY) / window.innerHeight) * 100))
    : snapPositions[snapPosition];

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const diff = startY - currentY;
    const threshold = 50;

    // If movement is too small, don't change position
    if (Math.abs(diff) < threshold) {
      return;
    }

    // Snap to nearest position based on drag direction
    if (diff > 0) {
      // Swiping up
      if (snapPosition === 'collapsed') setSnapPosition('half');
      else if (snapPosition === 'half') setSnapPosition('expanded');
    } else {
      // Swiping down
      if (snapPosition === 'expanded') setSnapPosition('half');
      else if (snapPosition === 'half') setSnapPosition('collapsed');
    }
  };

  // Mouse handlers for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setCurrentY(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setCurrentY(e.clientY);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const diff = startY - currentY;
    const threshold = 50;

    if (Math.abs(diff) < threshold) {
      return;
    }

    if (diff > 0) {
      if (snapPosition === 'collapsed') setSnapPosition('half');
      else if (snapPosition === 'half') setSnapPosition('expanded');
    } else {
      if (snapPosition === 'expanded') setSnapPosition('half');
      else if (snapPosition === 'half') setSnapPosition('collapsed');
    }
  };

  const getMessage = () => {
    if (searchQuery && visibleBuildings.length === 0) {
      return {
        title: "🔍 Nothing found?",
        subtitle: "Try these popular locations"
      };
    }
    return {
      title: "👋 Welcome to DeKUT!",
      subtitle: "Popular campus locations"
    };
  };

  const message = getMessage();

  // Group recommendations by type
  const grouped: { [key: string]: typeof recommendations } = {};
  recommendations.forEach(rec => {
    if (!grouped[rec.type]) grouped[rec.type] = [];
    grouped[rec.type].push(rec);
  });

  return (
    <div 
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-3xl shadow-2xl"
      style={{ 
        height: `${currentHeight}vh`,
        transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        touchAction: 'none' // Prevents scrolling while dragging
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Drag Handle */}
      <div 
        className="w-full py-4 cursor-grab active:cursor-grabbing flex justify-center items-center select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{ touchAction: 'none' }}
      >
        <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
      </div>
      
      {/* Header */}
      <div className="px-4 pb-3 flex items-center justify-between border-b">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">
            {message.title}
          </h3>
          <p className="text-sm text-gray-500">
            📍 {recommendations.length} locations
          </p>
        </div>
        <button
          onClick={() => setShowRecommendations(false)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div 
        className="overflow-y-auto" 
        style={{ 
          height: `calc(${currentHeight}vh - 100px)`,
          overscrollBehavior: 'contain' // Prevents parent scrolling
        }}
      >
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <div className="px-4 py-2 bg-gray-50 sticky top-0 z-10">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {type} ({items.length})
              </h4>
            </div>
            
            {items.map((rec) => (
              <button
                key={`${rec.source_type}-${rec.source_id}`}
                onClick={() => {
                  if (rec.source_type === 'building') {
                    const building = allBuildings.find(b => b.id === rec.source_id);
                    if (building) {
                      setMapCenter([rec.lat, rec.lng]);
                      setMapZoom(19);
                      setSelectedBuildingId(rec.source_id);
                      setVisibleBuildings([building]);
                      setShowRecommendations(false);
                      setSearchQuery(rec.name);
                    }
                  }
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 border-b flex items-center gap-3 transition-colors"
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${rec.color}20` }}
                >
                  <span className="text-xl">{rec.icon}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {rec.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="inline-block px-2 py-0.5 text-xs font-medium rounded"
                      style={{
                        backgroundColor: `${rec.color}20`,
                        color: rec.color
                      }}
                    >
                      {rec.category}
                    </span>
                    {rec.facilities_count > 0 && (
                      <span className="text-xs text-gray-500">
                        • {rec.facilities_count} facilities
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

  // ROUTE INFO PANEL
  function RouteInfoPanel() {
    if (!activeRoute) return null;
    
    const distanceKm = (activeRoute.distance / 1000).toFixed(2);
    const durationMin = Math.ceil(activeRoute.duration / 60);
    
    return (
      <div className="absolute bottom-24 left-4 right-4 z-30 max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-full">
                <Navigation className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Walking Route</p>
                <p className="font-bold text-gray-900">
                  {distanceKm} km · {durationMin} min
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowStepsModal(true)}
              className="text-cyan-600 text-sm font-medium hover:text-cyan-700"
            >
              View Steps
            </button>
          </div>
          
          <div className="space-y-2 text-sm">
            {activeRoute.steps.slice(0, 3).map((step, index) => (
              <div key={index} className="flex items-start gap-2 text-gray-600">
                <span className="font-medium text-cyan-600">{index + 1}.</span>
                <span className="line-clamp-1">{step.instruction}</span>
              </div>
            ))}
            {activeRoute.steps.length > 3 && (
              <p className="text-gray-400 text-xs">
                +{activeRoute.steps.length - 3} more steps
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // STEPS MODAL
  function StepsModal({ 
    isOpen, 
    onClose, 
    route 
  }: { 
    isOpen: boolean; 
    onClose: () => void; 
    route: Route | null;
  }) {
    if (!isOpen || !route) return null;

    const distanceKm = (route.distance / 1000).toFixed(2);
    const durationMin = Math.ceil(route.duration / 60);

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg sm:w-full max-h-[85vh] flex flex-col">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-gray-900">Turn-by-Turn Directions</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Navigation className="w-4 h-4" />
              <span>{distanceKm} km · {durationMin} min walk</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {route.steps.map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-cyan-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-medium text-gray-900 mb-1">
                      {step.instruction}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{step.distance}m</span>
                      <span>·</span>
                      <span>{Math.ceil(step.duration / 60)} min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t">
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative h-full flex flex-col">
        {/* Navigation Active Banner */}
        {isNavigating && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-cyan-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="font-medium text-sm">Navigation Active</span>
            </div>
            <button
              onClick={exitNavigationMode}
              className="p-1 hover:bg-cyan-700 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="absolute top-0 left-0 right-0 z-30">
          <div className="bg-white shadow-lg m-4 rounded-xl">
            <div className="flex items-center gap-2 p-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-gray-700" />
              </button>

              <div className="flex-1 relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search buildings..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => searchQuery && setShowSearchResults(true)}
                    disabled={isNavigating}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 text-sm"
                  />
                </div>

                {showSearchResults && searchResults.length > 0 && !isNavigating && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl max-h-80 overflow-y-auto">
                    {searchResults.map((building) => (
                      <button
                        key={building.id}
                        onClick={() => selectBuilding(building)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          {building.name}
                        </div>
                        {building.category && (
                          <div className="text-sm text-gray-500 mt-0.5">
                            {building.category.name}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowRecommendations(!showRecommendations)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Recommendations"
              >
                <Star className={`w-6 h-6 ${showRecommendations ? 'text-yellow-500 fill-yellow-500' : 'text-gray-700'}`} />
              </button>

              {visibleBuildings.length > 0 && !isNavigating && (
                <button
                  onClick={clearMap}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Recommendations Panel */}
        <RecommendationsPanel />

        {/* Map */}
        <div className="flex-1">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <Loader2 className="w-12 h-12 animate-spin text-cyan-600" />
            </div>
          ) : (
            <Map
              buildings={visibleBuildings}
              center={mapCenter}
              zoom={mapZoom}
              selectedBuildingId={selectedBuildingId}
              onBuildingClick={handleBuildingClick}
              onGetDirections={handleGetDirections}
              routeCoordinates={routeCoordinates}
              userLocation={userLocation}
            />
          )}
        </div>

        {/* Map Controls */}
        <div className="absolute right-4 top-24 z-20 flex flex-col gap-2">
          <button 
            onClick={handleLocateMe}
            className="bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
            title="My Location"
          >
            <Locate className="w-6 h-6 text-gray-700" />
          </button>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <button 
              onClick={() => setMapZoom(prev => Math.min(prev + 1, 19))}
              className="p-3 hover:bg-gray-50 transition-colors border-b w-full"
            >
              <Plus className="w-6 h-6 text-gray-700" />
            </button>
            <button 
              onClick={() => setMapZoom(prev => Math.max(prev - 1, 10))}
              className="p-3 hover:bg-gray-50 transition-colors w-full"
            >
              <Minus className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Route Info Panel */}
        {isNavigating && <RouteInfoPanel />}

        {/* Bottom Navigation - Clean & Fixed */}
        {!isNavigating && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-white border-t safe-area-bottom">
            <div className="flex items-center justify-around py-3 px-4">
              <button
                onClick={() => setShowRecommendations(!showRecommendations)}
                className="flex-1 px-4 py-3 rounded-full font-medium text-cyan-600 hover:bg-cyan-50 active:bg-cyan-100 transition-colors text-sm"
              >
                ðŸ" Explore
              </button>
              
              <div className="w-px h-8 bg-gray-200" />
              
              <button
                onClick={() => router.push('/buildings')}
                className="flex-1 px-4 py-3 rounded-full font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm"
              >
                🏛️ All Buildings
              </button>
              
              <div className="w-px h-8 bg-gray-200" />
              
              <button
                onClick={() => router.push('/favorites')}
                className="flex-1 px-4 py-3 rounded-full font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm"
              >
                â­ Favorites
              </button>
            </div>
          </div>
        )}

        {/* Empty State Message */}
        {visibleBuildings.length === 0 && !loading && !isNavigating && !showRecommendations && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center pointer-events-none px-4">
            <div className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg max-w-sm">
              <p className="text-gray-600 text-sm font-medium">
                ðŸ" Search for a building or tap Explore to discover popular locations
              </p>
            </div>
          </div>
        )}

        {/* Steps Modal */}
        <StepsModal 
          isOpen={showStepsModal}
          onClose={() => setShowStepsModal(false)}
          route={activeRoute}
        />
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-600" />
      </div>
    }>
      <MapPageContent />
    </Suspense>
  );
}