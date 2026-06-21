import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getForecast } from '../services/predictionApi';
import { getRoutingPlan } from '../services/routingApi';
import { snapRouteToRoads } from '../services/osrmApi';
import { fetchBengaluruWeather } from '../services/weatherApi';

const EventContext = createContext(null);

const STORAGE_KEY = 'gridlock:lastForecast';

function loadPersisted() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function EventProvider({ children }) {
  const persisted = loadPersisted();

  const [currentEvent, setCurrentEvent] = useState(persisted?.currentEvent ?? null);
  const [prediction, setPrediction] = useState(persisted?.prediction ?? null);
  const [resources, setResources] = useState(persisted?.resources ?? null);
  const [routing, setRouting] = useState(persisted?.routing ?? null);
  const [historicalComparison, setHistoricalComparison] = useState(persisted?.historicalComparison ?? null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const [isSnapping, setIsSnapping] = useState(false);
  const [weatherData, setWeatherData] = useState(null);

  const persist = useCallback((next) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // sessionStorage can fail in private/incognito edge cases — non-fatal.
    }
  }, []);

  const runForecast = useCallback(
    async (eventPayload) => {
      setStatus('loading');
      setError(null);
      try {
        let weather = weatherData;
        if (!weather) {
          weather = await fetchBengaluruWeather();
          setWeatherData(weather);
        }

        const payloadWithWeather = { ...eventPayload, weatherCondition: weather?.condition };
        const { eventId, prediction: pred, resources: res, historicalComparison: hist } = await getForecast(payloadWithWeather);
        const routingPlan = await getRoutingPlan(eventPayload, pred);

        const savedEvent = { ...eventPayload, id: eventId };

        setCurrentEvent(savedEvent);
        setPrediction(pred);
        setResources(res);
        setRouting(routingPlan);
        setHistoricalComparison(hist || []);
        setStatus('ready');

        persist({
          currentEvent: savedEvent,
          prediction: pred,
          resources: res,
          routing: routingPlan,
          historicalComparison: hist || [],
        });

        // Trigger snapped routing in background
        (async () => {
          setIsSnapping(true);
          try {
            const snappedRouting = { ...routingPlan };
            if (routingPlan.affectedRoutes) {
              snappedRouting.affectedRoutes = await Promise.all(
                routingPlan.affectedRoutes.map(async (route) => {
                  const snapped = await snapRouteToRoads(route.coordinates);
                  return { ...route, coordinates: snapped.coordinates };
                })
              );
            }
            if (routingPlan.diversionRoutes) {
              snappedRouting.diversionRoutes = await Promise.all(
                routingPlan.diversionRoutes.map(async (route) => {
                  const snapped = await snapRouteToRoads(route.coordinates);
                  return {
                    ...route,
                    coordinates: snapped.coordinates,
                    distance_km: snapped.distance_km,
                    estimated_time_min: snapped.estimated_time_min,
                  };
                })
              );
            }
            setRouting(snappedRouting);
            persist({
              currentEvent: savedEvent,
              prediction: pred,
              resources: res,
              routing: snappedRouting,
              historicalComparison: hist || [],
            });
          } catch (snapErr) {
            console.warn('[EventContext] route snapping failed:', snapErr);
          } finally {
            setIsSnapping(false);
          }
        })();

        return { prediction: pred, resources: res, routing: routingPlan };
      } catch (err) {
        setStatus('error');
        setError(err.message || 'Forecast failed');
        throw err;
      }
    },
    [persist]
  );

  const reset = useCallback(() => {
    setCurrentEvent(null);
    setPrediction(null);
    setResources(null);
    setRouting(null);
    setHistoricalComparison(null);
    setStatus('idle');
    setError(null);
    setIsSnapping(false);
    setWeatherData(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const markEventResolved = useCallback(() => {
    setCurrentEvent((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, status: 'completed' };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          currentEvent: updated,
          prediction,
          resources,
          routing,
          historicalComparison,
        }));
      } catch {}
      return updated;
    });
  }, [prediction, resources, routing, historicalComparison]);

  const value = useMemo(
    () => ({
      currentEvent,
      prediction,
      resources,
      routing,
      historicalComparison,
      status,
      error,
      isSnapping,
      weatherData,
      setWeatherData,
      runForecast,
      reset,
      markEventResolved,
      hasForecast: Boolean(currentEvent && prediction),
    }),
    [
      currentEvent,
      prediction,
      resources,
      routing,
      historicalComparison,
      status,
      error,
      isSnapping,
      weatherData,
      runForecast,
      reset,
      markEventResolved,
    ]
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEventContext() {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error('useEventContext must be used within an EventProvider');
  }
  return ctx;
}
