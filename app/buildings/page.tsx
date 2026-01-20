'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BuildingCard } from '@/components/BuildingCard';
import { Search, ChevronLeft, Loader2 } from 'lucide-react';
import { Building, BuildingCategory } from '@/types/database.types';

export default function BuildingsPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [categories, setCategories] = useState<BuildingCategory[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load categories from database
      const { data: categoriesData } = await supabase
        .from('building_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (categoriesData) {
        setCategories(categoriesData);
      }

      // Load buildings with their categories and details
      const { data: buildingsData } = await supabase
        .from('buildings')
        .select(`
          *,
          category:building_categories(*),
          details:building_details(*)
        `)
        .order('name', { ascending: true });

      if (buildingsData) {
        setBuildings(buildingsData);
      }

      // Load user favorites (if user is logged in)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: favoritesData } = await supabase
          .from('user_favorites')
          .select('building_id')
          .eq('user_id', user.id);

        if (favoritesData) {
          setFavorites(new Set(favoritesData.map(f => f.building_id)));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(buildingId: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in to save favorites');
      return;
    }

    const isFavorite = favorites.has(buildingId);

    if (isFavorite) {
      // Remove from favorites
      await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('building_id', buildingId);
      
      setFavorites(prev => {
        const next = new Set(prev);
        next.delete(buildingId);
        return next;
      });
    } else {
      // Add to favorites
      await supabase
        .from('user_favorites')
        .insert({ user_id: user.id, building_id: buildingId });
      
      setFavorites(prev => new Set(prev).add(buildingId));
    }
  }

  function handleBuildingClick(buildingId: number) {
    // Redirect to map page with the building selected
    // This will trigger the map to center on this building and show it
    router.push(`/?selected=${buildingId}`);
  }

  // Filter buildings based on search and category
  const filteredBuildings = buildings.filter(building => {
    const matchesSearch = !searchQuery || 
      building.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
      building.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header - Beautiful cyan gradient like your old work */}
      <div className="bg-cyan-600 text-white">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-cyan-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Campus Buildings</h1>
              <p className="text-cyan-100 text-sm">
                {filteredBuildings.length} locations
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search buildings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Category Tabs - Like your old work */}
        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-white text-cyan-600'
                  : 'bg-cyan-700 text-white hover:bg-cyan-800'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-white text-cyan-600'
                    : 'bg-cyan-700 text-white hover:bg-cyan-800'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Buildings List - Using your beautiful cards! */}
      <div className="p-4 space-y-3">
        {filteredBuildings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No buildings found</p>
          </div>
        ) : (
          filteredBuildings.map((building) => (
            <BuildingCard
              key={building.id}
              building={building}
              isFavorite={favorites.has(building.id)}
              onToggleFavorite={toggleFavorite}
              onClick={() => handleBuildingClick(building.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}