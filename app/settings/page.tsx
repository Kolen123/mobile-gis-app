// app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ChevronLeft, 
  Volume2, 
  Vibrate, 
  Navigation, 
  Sun, 
  Bell, 
  MapPin, 
  Map, 
  Building2, 
  Satellite,
  Info,
  ChevronRight
} from 'lucide-react';

interface UserSettings {
  id: number;
  user_id: string;
  show_landmarks: boolean;
  buildings_3d: boolean;
  satellite_view: boolean;
  voice_navigation: boolean;
  vibration_alerts: boolean;
  auto_rerouting: boolean;
  dark_mode: boolean;
  notifications: boolean;
  location_tracking: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let { data: userSettings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!userSettings) {
        // Create default settings
        const { data: newSettings } = await supabase
          .from('user_settings')
          .insert({ user_id: user.id })
          .select()
          .single();
        userSettings = newSettings;
      }

      setSettings(userSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateSetting(key: keyof UserSettings, value: boolean) {
    if (!settings) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_settings')
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>
      </div>

      <div className="pb-6">
        {/* Map Display Section */}
        <div className="mt-6 bg-white">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Map Display
            </h2>
          </div>
          <SettingToggle
            icon={<Map className="w-5 h-5 text-cyan-600" />}
            title="Show Landmarks"
            description="Display important campus landmarks on the map"
            checked={settings?.show_landmarks ?? true}
            onChange={(checked) => updateSetting('show_landmarks', checked)}
          />
          <SettingToggle
            icon={<Building2 className="w-5 h-5 text-cyan-600" />}
            title="3D Buildings"
            description="Show buildings in 3D view"
            checked={settings?.buildings_3d ?? false}
            onChange={(checked) => updateSetting('buildings_3d', checked)}
          />
          <SettingToggle
            icon={<Satellite className="w-5 h-5 text-cyan-600" />}
            title="Satellite View"
            description="Use satellite imagery for map display"
            checked={settings?.satellite_view ?? false}
            onChange={(checked) => updateSetting('satellite_view', checked)}
          />
        </div>

        {/* Navigation Options Section */}
        <div className="mt-6 bg-white">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Navigation Options
            </h2>
          </div>
          <SettingToggle
            icon={<Volume2 className="w-5 h-5 text-cyan-600" />}
            title="Voice Navigation"
            description="Turn-by-turn voice guidance"
            checked={settings?.voice_navigation ?? true}
            onChange={(checked) => updateSetting('voice_navigation', checked)}
          />
          <SettingToggle
            icon={<Vibrate className="w-5 h-5 text-cyan-600" />}
            title="Vibration Alerts"
            description="Vibrate for navigation alerts"
            checked={settings?.vibration_alerts ?? true}
            onChange={(checked) => updateSetting('vibration_alerts', checked)}
          />
          <SettingToggle
            icon={<Navigation className="w-5 h-5 text-cyan-600" />}
            title="Auto Rerouting"
            description="Automatically find new routes when off course"
            checked={settings?.auto_rerouting ?? true}
            onChange={(checked) => updateSetting('auto_rerouting', checked)}
          />
        </div>

        {/* App Customization Section */}
        <div className="mt-6 bg-white">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              App Customization
            </h2>
          </div>
          <SettingToggle
            icon={<Sun className="w-5 h-5 text-cyan-600" />}
            title="Dark Mode"
            description="Switch between light and dark theme"
            checked={settings?.dark_mode ?? false}
            onChange={(checked) => updateSetting('dark_mode', checked)}
          />
          <SettingToggle
            icon={<Bell className="w-5 h-5 text-cyan-600" />}
            title="Notifications"
            description="Receive app notifications"
            checked={settings?.notifications ?? true}
            onChange={(checked) => updateSetting('notifications', checked)}
          />
          <SettingToggle
            icon={<MapPin className="w-5 h-5 text-cyan-600" />}
            title="Location Tracking"
            description="Allow app to track your location"
            checked={settings?.location_tracking ?? true}
            onChange={(checked) => updateSetting('location_tracking', checked)}
          />
        </div>

        {/* About Section */}
        <div className="mt-6 bg-white">
          <button
            onClick={() => router.push('/about')}
            className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-50 rounded-full">
                <Info className="w-5 h-5 text-cyan-600" />
              </div>
              <span className="font-medium text-gray-900">About DeKUT Navigator</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle Switch Component
function SettingToggle({
  icon,
  title,
  description,
  checked,
  onChange
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="px-4 py-4 flex items-center gap-3 border-b border-gray-100 last:border-b-0">
      <div className="p-2 bg-cyan-50 rounded-full">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-cyan-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}