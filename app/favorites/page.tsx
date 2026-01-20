// app/favorites/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BuildingCard } from '@/components/BuildingCard';
import { Search, ChevronLeft, Loader2 } from 'lucide-react';
import { Building } from '@/types/database.types'; // ✅ IMPORT THIS

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('user_favorites')
        .select(`
          building_id,
          building:buildings(
            *,
            category:building_categories(*),
            details:building_details(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        const buildings = data
          .map((f: any) => {
            const building = Array.isArray(f.building) ? f.building[0] : f.building;
            return building;
          })
          .filter(Boolean) as Building[];
        
        setFavorites(buildings);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  }

  async function removeFavorite(buildingId: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('building_id', buildingId);

    setFavorites(prev => prev.filter(b => b.id !== buildingId));
  }

  const filteredFavorites = favorites.filter(building =>
    !searchQuery || building.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Favorites</h1>
              <p className="text-cyan-600 text-sm font-medium">
                {filteredFavorites.length} saved
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search favorites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Favorites List */}
      <div className="p-4 space-y-3">
        {filteredFavorites.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">No favorites yet</p>
            <p className="text-sm text-gray-400">
              Star buildings to add them to your favorites
            </p>
          </div>
        ) : (
          filteredFavorites.map((building) => (
            <BuildingCard
              key={building.id}
              building={building}
              isFavorite={true}
              onToggleFavorite={removeFavorite}
              onClick={() => router.push(`/?building=${building.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}