import { useEffect, useRef, useState } from 'react';

export function normalizePlayerSource(source, url) {
  const value = source ?? url ?? '';
  if (typeof value === 'string') return { uri: value };
  return value && typeof value === 'object' ? value : { uri: '' };
}

export function getYouTubeVideoId(source) {
  const media = typeof source === 'string' ? { uri: source } : source || {};
  const explicitId = media.youtubeVideoId || (String(media.type || '').toLowerCase() === 'youtube' ? media.id : null);
  const isValidId = (value) => /^[\w-]{11}$/.test(String(value || ''));
  if (isValidId(explicitId)) return String(explicitId);

  const raw = String(media.uri || media.url || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').find(Boolean);
      return isValidId(id) ? id : null;
    }
    if (host !== 'youtube.com' && host !== 'youtube-nocookie.com' && host !== 'm.youtube.com') return null;
    const queryId = parsed.searchParams.get('v');
    if (isValidId(queryId)) return queryId;
    const match = /^\/(?:embed|shorts|live)\/([\w-]{11})/.exec(parsed.pathname);
    return isValidId(match?.[1]) ? match[1] : null;
  } catch {
    return null;
  }
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
