import { useCallback, useState } from 'react';
import { DHAKA_CENTER } from '@amar/shared';

export interface Fix {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface State {
  fix: Fix | null;
  status: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';
  error?: string;
}

/**
 * Geolocation, asked for explicitly rather than on page load. A permission
 * prompt that appears before the user has done anything gets denied, and a
 * denied permission is hard to recover — so the map falls back to Dhaka centre
 * and the report flow asks at the moment it needs a pin.
 */
export function useGeolocation() {
  const [state, setState] = useState<State>({ fix: null, status: 'idle' });

  const locate = useCallback((options?: { highAccuracy?: boolean }) => {
    if (!('geolocation' in navigator)) {
      setState({ fix: null, status: 'unavailable', error: 'This browser cannot report a location.' });
      return;
    }
    setState((prev) => ({ ...prev, status: 'locating' }));

    navigator.geolocation.getCurrentPosition(
      (position) =>
        setState({
          fix: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          status: 'ready',
        }),
      (err) =>
        setState({
          fix: null,
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
          error:
            err.code === err.PERMISSION_DENIED
              ? 'Location is blocked for this site. Turn it on in your browser settings, or drag the pin instead.'
              : 'Could not get a location fix. Drag the pin to the right spot instead.',
        }),
      {
        enableHighAccuracy: options?.highAccuracy ?? true,
        timeout: 12_000,
        maximumAge: 30_000,
      },
    );
  }, []);

  return { ...state, locate, fallback: DHAKA_CENTER };
}
