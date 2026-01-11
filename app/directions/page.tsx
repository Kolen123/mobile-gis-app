'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Navigation, MapPin, Loader2 } from 'lucide-react';

interface Building {
  id: number;
  name: string | null;
  center_lat: number;
  center_lng: number;
}

// Separate component that uses useSearchParams
function DirectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toId = searchParams.get('to');

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [fromBuilding, setFromBuilding] = useState<number | null>(null);
  const [toBuilding, setToBuilding] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBuildings();
  }, []);

  useEffect(() => {
    if (toId && buildings.length > 0) {
      setToBuilding(parseInt(toId));
    }
  }, [toId, buildings]);

  async function loadBuildings() {
    try {
      const { data } = await supabase
        .from('buildings')
        .select('id, name, center_lat, center_lng')
        .order('name');

      if (data) {
        setBuildings(data);
      }
    } catch (error) {
      console.error('Error loading buildings:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleGetDirections() {
    if (fromBuilding !== null && toBuilding !== null) {
      router.push(`/?from=${fromBuilding}&to=${toBuilding}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Map</span>
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-2xl shadow-lg">
              <Navigation className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Get Directions</h1>
              <p className="text-gray-500">Plan your route on campus</p>
            </div>
          </div>
        </div>

        {/* Direction Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          {/* From Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-600" />
              Starting Point
            </label>
            <select
              value={fromBuilding || ''}
              onChange={(e) => setFromBuilding(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
            >
              <option value="">Select starting location</option>
              <option value="0">📍 My Current Location</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>

          {/* To Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-cyan-600" />
              Destination
            </label>
            <select
              value={toBuilding || ''}
              onChange={(e) => setToBuilding(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
            >
              <option value="">Select destination</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>

          {/* Get Directions Button */}
          <button
            onClick={handleGetDirections}
            disabled={fromBuilding === null || toBuilding === null}
            className="w-full px-6 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold hover:from-cyan-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <Navigation className="w-5 h-5" />
            Get Directions
          </button>
        </div>

        {/* Info Card */}
        <div className="mt-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
          <p className="text-sm text-gray-700">
            💡 <span className="font-semibold">Tip:</span> Select "My Current Location" to navigate from where you are right now.
          </p>
        </div>
      </div>
    </div>
  );
}

// Main component with Suspense wrapper
export default function DirectionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-600" />
      </div>
    }>
      <DirectionsContent />
    </Suspense>
  );
}