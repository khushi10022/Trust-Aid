import { useState, useEffect, useRef } from 'react';

export function useLocation() {
  const [location, setLocation] = useState(null);   // { lat, lng, accuracy, timestamp }
  const [status, setStatus] = useState('idle');      // idle | requesting | granted | denied | unavailable
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      setError('Geolocation is not supported by this browser.');
      return;
    }
    setStatus('requesting');
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus('granted');
        setError(null);
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: new Date(pos.timestamp),
          mapsUrl: `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`,
        });
      },
      (err) => {
        stopTracking();
        if (err.code === 1) {
          setStatus('denied');
          setError('Location access denied. Please allow location in browser settings.');
        } else if (err.code === 2) {
          setStatus('unavailable');
          setError('Location unavailable. Check GPS or network.');
        } else {
          setStatus('denied');
          setError('Location request timed out.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const requestOnce = () => {
    if (!navigator.geolocation) { setStatus('unavailable'); return; }
    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus('granted');
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: new Date(pos.timestamp),
          mapsUrl: `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`,
        });
      },
      (err) => {
        setStatus(err.code === 1 ? 'denied' : 'unavailable');
        setError(err.code === 1 ? 'Location denied.' : 'Location unavailable.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => () => stopTracking(), []);

  return { location, status, error, startTracking, stopTracking, requestOnce };
}
