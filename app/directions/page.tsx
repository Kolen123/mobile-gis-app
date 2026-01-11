'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, MapPin, Navigation, Search, X } from 'lucide-react';

interface Building {
  id: number;
  name: string | null;
  center_lat: number;
  center_lng: number;
}

export default function DirectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toId = searchParams.get('to');

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [fromId, setFromId] = useState<number | null>(null);
  const [destinationId, setDestinationId] = useState<number | null>(
    toId ? parseInt(toId) : null
  );
  
  const [showFromSearch, setShowFromSearch] = useState(false);
  const [showToSearch, setShowToSearch] = useState(false);
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [fromResults, setFromResults] = useState<Building[]>([]);
  const [toResults, setToResults] = useState<Building[]>([]);

  useEffect(() => {
    loadBuildings();
  }, []);

  async function loadBuildings() {
    const { data } = await supabase
      .from('buildings')
      .select('id, name, center_lat, center_lng')
      .order('name');

    if (data) {
      setBuildings(data);
      
      // Set destination name if toId provided
      if (toId) {
        const destination = data.find(b => b.id === parseInt(toId));
        if (destination) {
          setToQuery(destination.name || '');
        }
      }
    }
  }

  function handleFromSearch(query: string) {
    setFromQuery(query);
    if (!query.trim()) {
      setFromResults(buildings.slice(0, 10)); // Show first 10 buildings
      return;
    }
    const results = buildings.filter(b =>
      b.name?.toLowerCase().includes(query.toLowerCase())
    );
    setFromResults(results.slice(0, 10));
  }

  function handleToSearch(query: string) {
    setToQuery(query);
    if (!query.trim()) {
      setToResults(buildings.slice(0, 10)); // Show first 10 buildings
      return;
    }
    const results = buildings.filter(b =>
      b.name?.toLowerCase().includes(query.toLowerCase())
    );
    setToResults(results.slice(0, 10));
  }

  function selectFrom(building: Building | null) {
    if (building) {
      setFromId(building.id);
      setFromQuery(building.name || '');
    } else {
      // Current location
      setFromId(0);
      setFromQuery('Your location');
    }
    setFromResults([]);
    setShowFromSearch(false);
  }

  function selectTo(building: Building) {
    setDestinationId(building.id);
    setToQuery(building.name || '');
    setToResults([]);
    setShowToSearch(false);
  }

  function handleGetDirections() {
    if ((fromId !== null || fromId === 0) && destinationId) {
      router.push(`/?from=${fromId}&to=${destinationId}`);
    }
  }

  function swapLocations() {
    if (fromId === 0) return; // Can't swap current location
    
    const tempId = fromId;
    const tempQuery = fromQuery;
    
    setFromId(destinationId);
    setFromQuery(toQuery);
    setDestinationId(tempId);
    setToQuery(tempQuery);
  }

  const canGetDirections = (fromId !== null || fromId === 0) && destinationId;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Get Directions</h1>
        </div>
      </div>

      {/* Input Fields - Google Maps Style */}
      <div className="bg-white shadow-sm">
        <div className="p-4 space-y-3">
          {/* From Input */}
          <div className="relative">
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border-2 border-transparent focus-within:border-blue-500 transition-colors">
              <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></div>
              <input
                type="text"
                placeholder="Choose starting point"
                value={fromQuery}
                onChange={(e) => handleFromSearch(e.target.value)}
                onFocus={() => {
                  setShowFromSearch(true);
                  if (!fromQuery) {
                    setFromResults(buildings.slice(0, 10));
                  }
                }}
                className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500"
              />
              {fromQuery && (
                <button
                  onClick={() => {
                    setFromQuery('');
                    setFromId(null);
                    setFromResults([]);
                  }}
                  className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>

            {/* From Search Results */}
            {showFromSearch && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border z-50 max-h-80 overflow-y-auto">
                {/* Current Location Option */}
                <button
                  onClick={() => selectFrom(null)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Your location</div>
                    <div className="text-sm text-gray-500">Use current GPS position</div>
                  </div>
                </button>

                {fromResults.length > 0 ? (
                  fromResults.map((building) => (
                    <button
                      key={building.id}
                      onClick={() => selectFrom(building)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b last:border-b-0 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="font-medium text-gray-900">{building.name}</div>
                    </button>
                  ))
                ) : fromQuery && (
                  <div className="px-4 py-3 text-gray-500 text-sm">
                    No buildings found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Swap Button */}
          {fromId !== 0 && (
            <div className="flex justify-center -my-1">
              <button
                onClick={swapLocations}
                disabled={fromId === null || destinationId === null}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>
          )}

          {/* To Input */}
          <div className="relative">
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border-2 border-transparent focus-within:border-red-500 transition-colors">
              <MapPin className="w-5 h-5 text-red-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Choose destination"
                value={toQuery}
                onChange={(e) => handleToSearch(e.target.value)}
                onFocus={() => {
                  setShowToSearch(true);
                  if (!toQuery) {
                    setToResults(buildings.slice(0, 10));
                  }
                }}
                className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500"
              />
              {toQuery && (
                <button
                  onClick={() => {
                    setToQuery('');
                    setDestinationId(null);
                    setToResults([]);
                  }}
                  className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>

            {/* To Search Results */}
            {showToSearch && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border z-50 max-h-80 overflow-y-auto">
                {toResults.length > 0 ? (
                  toResults.map((building) => (
                    <button
                      key={building.id}
                      onClick={() => selectTo(building)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b last:border-b-0 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="font-medium text-gray-900">{building.name}</div>
                    </button>
                  ))
                ) : toQuery && (
                  <div className="px-4 py-3 text-gray-500 text-sm">
                    No buildings found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Get Directions Button */}
        <div className="p-4 pt-0">
          <button
            onClick={handleGetDirections}
            disabled={!canGetDirections}
            className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Navigation className="w-5 h-5" />
            Get Directions
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Walking Directions</h3>
          <p className="text-sm text-blue-800">
            Get turn-by-turn walking directions between buildings on campus. 
            Choose your starting point and destination above.
          </p>
        </div>
      </div>

      {/* Close overlay on click outside */}
      {(showFromSearch || showToSearch) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowFromSearch(false);
            setShowToSearch(false);
          }}
        />
      )}
    </div>
  );
}