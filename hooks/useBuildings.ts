import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

export type Building = { id: string; name: string; address?: string; water_reading_enabled?: boolean; has_wings?: boolean; };

export function useBuildings(enabled: boolean) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    
    // Load cached buildings instantly
    AsyncStorage.getItem('cached_buildings_list').then(s => {
      if (s) setBuildings(JSON.parse(s));
    });

    setLoading(true);
    api.get('/buildings')
      .then((r) => {
        setBuildings(r.data);
        AsyncStorage.setItem('cached_buildings_list', JSON.stringify(r.data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  return { buildings, loading };
}
