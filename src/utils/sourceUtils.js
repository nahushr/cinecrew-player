import { useEffect, useRef, useState } from 'react';

export function normalizePlayerSource(source, url) {
  const value = source ?? url ?? '';
  if (typeof value === 'string') return { uri: value };
  return value && typeof value === 'object' ? value : { uri: '' };
}

export function getWebRuntimePlatform() {
  if (typeof window === 'undefined') return 'web';
  const electronProcess = Boolean(window.process?.versions?.electron);
  const electronUserAgent = typeof navigator !== 'undefined' && /\bElectron\//i.test(navigator.userAgent || '');
  return electronProcess || electronUserAgent ? 'electron' : 'web';
}

function sourceKey(source, url) {
  const value = source ?? url ?? '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value?.uri || value?.url || '');
  }
}

/** Apply an optional consumer-owned resolver without rewriting the input URL. */
export function useResolvedPlayerSource(source, url, resolveSource, platform) {
  const key = sourceKey(source, url);
  const resolverRef = useRef(resolveSource);
  const inputRef = useRef(normalizePlayerSource(source, url));
  const resolverEnabled = typeof resolveSource === 'function';
  resolverRef.current = resolveSource;
  inputRef.current = normalizePlayerSource(source, url);
  const [result, setResult] = useState({ key: null, source: null, loading: false, error: null });

  useEffect(() => {
    let cancelled = false;
    const input = inputRef.current;
    const resolver = resolverRef.current;
    if (typeof resolver !== 'function' || !(input.uri || input.url)) {
      setResult({ key, source: input, loading: false, error: null });
      return () => { cancelled = true; };
    }

    setResult({ key, source: null, loading: true, error: null });
    Promise.resolve()
      .then(() => resolver(input, { platform }))
      .then((resolved) => {
        if (resolved === null || resolved === undefined || resolved === '') {
          throw new Error('The source resolver did not return a playable media source.');
        }
        if (!cancelled) {
          setResult({
            key,
            source: { ...input, ...normalizePlayerSource(resolved) },
            loading: false,
            error: null,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) setResult({ key, source: null, loading: false, error });
      });
    return () => { cancelled = true; };
  }, [key, platform, resolverEnabled]);

  if (result.key === key) return result;
  return {
    key,
    source: resolverEnabled ? null : normalizePlayerSource(source, url),
    loading: resolverEnabled,
    error: null,
  };
}
