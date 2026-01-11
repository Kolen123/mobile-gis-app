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
  ChevronDown,
  ChevronUp,
  ArrowLeft,
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
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [mobileSheetPosition, setMobileSheetPosition] = useState<'minimized' | 'half' | 'full'>('half');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fix mobile viewport height
  useEffect(() => {
    const setRealViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setRealViewportHeight();
    window.addEventListener('resize', setRealViewportHeight);
    window.addEventListener('orientationchange', setRealViewportHeight);
    
    return () => {
      window.removeEventListener('resize', setRealViewportHeight);
      window.removeEventListener('orientationchange', setRealViewportHeight);
    };
  }, []);

  useEffect(() => {
    loadBuildings();
    loadRecommendations();
  }, []);

  useEffect(() => {
    const hasSeenRecommendations = sessionStorage.getItem('hasSeenRecommendations');
    
    if (!hasSeenRecommendations && !loading) {
      const timer = setTimeout(() => {
        if (visibleBuildings.length === 0 && !isNavigating && !searchQuery) {
          setShowRecommendations(true);
          sessionStorage.setItem('hasSeenRecommendations', 'true');
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    if (visibleBuildings.length > 0) {
      setShowRecommendations(false);
    }
  }, [visibleBuildings]);

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
    setUserLocation(null);
    setMobileSheetPosition('half');
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
// Desktop Navigation Sidebar - ENHANCED VERSION
function DesktopNavigationPanel() {
  if (!isNavigating || !activeRoute || isMobile) return null;

  const distanceKm = (activeRoute.distance / 1000).toFixed(2);
  const durationMin = Math.ceil(activeRoute.duration / 60);
  const destination = allBuildings.find(b => b.id === selectedBuildingId);

  return (
    <div className="absolute left-0 top-0 bottom-0 w-96 bg-gradient-to-b from-blue-50 to-white shadow-2xl z-30 flex flex-col">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
        <button
          onClick={exitNavigationMode}
          className="flex items-center gap-2 mb-4 hover:bg-white/20 rounded-lg px-3 py-2 -ml-3 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Exit Navigation</span>
        </button>
        
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
            <Navigation className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{destination?.name}</h2>
            <p className="text-blue-100 text-sm flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              Walking directions
            </p>
          </div>
        </div>

        {/* Time & Distance Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-blue-100">Duration</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{durationMin}</span>
              <span className="text-sm text-blue-100">min</span>
            </div>
          </div>
          
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-blue-100">Distance</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{distanceKm}</span>
              <span className="text-sm text-blue-100">km</span>
            </div>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-2">
            Turn-by-turn directions
          </h3>
          
          <div className="space-y-2">
            {activeRoute.steps.map((step, index) => (
              <div 
                key={index} 
                className="group hover:shadow-md transition-all duration-200 rounded-xl bg-white border border-gray-100 overflow-hidden"
              >
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-shrink-0 relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-110 transition-transform">
                      {index + 1}
                    </div>
                    {index < activeRoute.steps.length - 1 && (
                      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gradient-to-b from-blue-200 to-transparent"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="font-semibold text-gray-900 mb-2 leading-relaxed group-hover:text-blue-600 transition-colors">
                      {step.instruction}
                    </p>
                    
                    {step.distance > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">
                          <span className="font-medium">{step.distance}m</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">
                          <span className="font-medium">{Math.ceil(step.duration / 60)} min</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tip */}
        <div className="p-4 mt-4">
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-gray-700">
              💡 <span className="font-semibold">Tip:</span> Follow the blue route on the map for guidance
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

 // Mobile Navigation Bottom Sheet - ENHANCED VERSION
function MobileNavigationSheet() {
  if (!isNavigating || !activeRoute || !isMobile) return null;

  const distanceKm = (activeRoute.distance / 1000).toFixed(2);
  const durationMin = Math.ceil(activeRoute.duration / 60);
  const destination = allBuildings.find(b => b.id === selectedBuildingId);
  const nextStep = activeRoute.steps[0];

  const heights = {
    minimized: '140px',
    half: '50vh',
    full: '85vh'
  };

  return (
    <>
      {/* Top Banner - When Minimized */}
      {mobileSheetPosition === 'minimized' && nextStep && (
        <div className="absolute top-4 left-4 right-4 z-40">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl shadow-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0 text-white">
                <p className="text-xs font-medium mb-0.5 opacity-90">In {nextStep.distance}m</p>
                <p className="font-bold text-lg line-clamp-1">{nextStep.instruction}</p>
              </div>
              <button 
                onClick={() => setMobileSheetPosition('half')}
                className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <ChevronUp className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet */}
      <div 
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-all duration-300 flex flex-col"
        style={{ height: heights[mobileSheetPosition] }}
      >
        {/* Drag Handle */}
        <div 
          className="w-full py-3 flex justify-center cursor-grab active:cursor-grabbing"
          onClick={() => {
            if (mobileSheetPosition === 'minimized') setMobileSheetPosition('half');
            else if (mobileSheetPosition === 'half') setMobileSheetPosition('full');
            else setMobileSheetPosition('minimized');
          }}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-md">
                <Navigation className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate text-lg">{destination?.name}</h3>
                <p className="text-sm text-gray-500">Walking directions</p>
              </div>
            </div>
            <button
              onClick={exitNavigationMode}
              className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-600 font-medium">Duration</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900">{durationMin}</span>
                <span className="text-sm text-gray-500">min</span>
              </div>
            </div>

            <div className="flex-1 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-600 font-medium">Distance</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900">{distanceKm}</span>
                <span className="text-sm text-gray-500">km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Steps List - Scrollable */}
        {mobileSheetPosition !== 'minimized' && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Turn-by-turn directions
            </h4>
            
            <div className="space-y-2">
              {activeRoute.steps.map((step, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex-shrink-0 relative">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                      {index + 1}
                    </div>
                    {index < activeRoute.steps.length - 1 && (
                      <div className="absolute top-9 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-gradient-to-b from-blue-200 to-transparent"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="font-semibold text-gray-900 mb-1.5 leading-snug">{step.instruction}</p>
                    {step.distance > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                          {step.distance}m
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                          {Math.ceil(step.duration / 60)} min
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

  function RecommendationsPanel() {
    if (!showRecommendations || recommendations.length === 0) return null;

    const [snapPosition, setSnapPosition] = useState<'collapsed' | 'half' | 'expanded'>('half');
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const sheetRef = useRef<HTMLDivElement>(null);

    const snapPositions = {
      collapsed: 20,
      half: 40,
      expanded: 75
    };

    const currentHeight = isDragging 
      ? Math.max(20, Math.min(80, snapPositions[snapPosition] + ((startY - currentY) / window.innerHeight) * 100))
      : snapPositions[snapPosition];

    const handleTouchStart = (e: React.TouchEvent) => {
      setIsDragging(true);
      setStartY(e.touches[0].clientY);
      setCurrentY(e.touches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      setCurrentY(e.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);

      const diff = startY - currentY;
      const threshold = 50;

      if (Math.abs(diff) < threshold) return;

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

    const grouped: { [key: string]: typeof recommendations } = {};
    recommendations.forEach(rec => {
      if (!grouped[rec.type]) grouped[rec.type] = [];
      grouped[rec.type].push(rec);
    });

    return (
      <div 
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-40 bg-white rounded-t-3xl shadow-2xl"
        style={{ 
          height: `${currentHeight}vh`,
          maxHeight: '85vh',
          transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          touchAction: 'none',
          overflow: 'hidden'
        }}
      >
        <div 
          className="w-full py-3 cursor-grab active:cursor-grabbing flex justify-center items-center select-none flex-shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>
        
        <div className="px-4 pb-3 flex items-center justify-between border-b flex-shrink-0">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{message.title}</h3>
            <p className="text-sm text-gray-500">📍 {recommendations.length} locations</p>
          </div>
          <button
            onClick={() => setShowRecommendations(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div 
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ 
            height: `calc(${currentHeight}vh - 100px)`,
            maxHeight: 'calc(85vh - 100px)',
            WebkitOverflowScrolling: 'touch'
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
                    <h4 className="font-semibold text-gray-900 truncate">{rec.name}</h4>
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

  return (
    <div 
      className="relative w-full overflow-hidden" 
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative h-full flex flex-col">
        {/* Search Bar - Hidden during navigation on mobile */}
        {(!isNavigating || !isMobile) && (
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
                          <div className="font-medium text-gray-900">{building.name}</div>
                          {building.category && (
                            <div className="text-sm text-gray-500 mt-0.5">{building.category.name}</div>
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
        )}

        {/* Desktop Navigation Panel */}
        <DesktopNavigationPanel />

        {/* Mobile Navigation Sheet */}
        <MobileNavigationSheet />

        {/* Recommendations Panel - Hidden during navigation */}
        {!isNavigating && <RecommendationsPanel />}

        {/* Map - Adjust margin for desktop navigation panel */}
        <div 
          className="flex-1 transition-all duration-300"
          style={{
            marginLeft: isNavigating && !isMobile ? '384px' : '0'
          }}
        >
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

        {/* Map Controls - Hidden during mobile navigation */}
        {(!isNavigating || !isMobile) && (
          <div className="absolute right-4 top-24 z-20 flex flex-col gap-2">
            <button 
              onClick={() => router.push('/directions')}
              className="bg-cyan-600 p-3 rounded-lg shadow-lg hover:bg-cyan-700 transition-colors"
              title="Get Directions"
            >
              <Navigation className="w-6 h-6 text-white" />
            </button>

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
        )}

        {/* Bottom Navigation - Hidden during navigation */}
        {!isNavigating && !showRecommendations && (
          <div 
            className="fixed left-0 right-0 z-20 bg-white border-t shadow-lg"
            style={{ 
              bottom: 0,
              paddingBottom: 'max(env(safe-area-inset-bottom), 12px)'
            }}
          >
            <div className="flex items-center justify-around py-3 px-4 h-16">
              <button
                onClick={() => setShowRecommendations(true)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg font-medium text-cyan-600 hover:bg-cyan-50 active:bg-cyan-100 transition-colors"
              >
                <Star className="w-5 h-5" />
                <span className="text-xs">Explore</span>
              </button>
              
              <div className="w-px h-8 bg-gray-200" />
              
              <button
                onClick={() => router.push('/buildings')}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <Building2 className="w-5 h-5" />
                <span className="text-xs">Buildings</span>
              </button>
              
              <div className="w-px h-8 bg-gray-200" />
              
              <button
                onClick={() => router.push('/favorites')}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <Heart className="w-5 h-5" />
                <span className="text-xs">Favorites</span>
              </button>
            </div>
          </div>
        )}

        {/* Empty State - Hidden during navigation */}
        {visibleBuildings.length === 0 && !loading && !isNavigating && !showRecommendations && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center pointer-events-none px-4">
            <div className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg max-w-sm">
              <p className="text-gray-600 text-sm font-medium">
                🗺️ Search for a building or tap Explore to discover popular locations
              </p>
            </div>
          </div>
        )}
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