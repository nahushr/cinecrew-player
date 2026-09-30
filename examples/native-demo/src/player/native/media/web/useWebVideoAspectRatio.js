import { useState, useCallback, useEffect } from 'react';

/**
 * Hook to manage video aspect ratio scaling styles (FIT, FILL, STRETCH, CENTER, custom aspect ratios).
 */
export function useWebVideoAspectRatio(videoAspectRatio, audioOnly) {
  const [aspectFit, setAspectFit] = useState('contain');
  const [aspectRatioVal, setAspectRatioVal] = useState(undefined);

  const applyAspectRatio = useCallback((aspect) => {
    if (aspect === 'FILL_SCREEN' || aspect === 'FILL') {
      setAspectFit('cover');
      setAspectRatioVal(undefined);
    } else if (aspect === 'STRETCH') {
      setAspectFit('fill');
      setAspectRatioVal(undefined);
    } else if (aspect === 'CENTER') {
      setAspectFit('none');
      setAspectRatioVal(undefined);
    } else if (typeof aspect === 'string' && /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(aspect)) {
      const parts = aspect.split(':').map(Number);
      if (!parts[0] || !parts[1]) {
        setAspectFit('contain');
        setAspectRatioVal(undefined);
        return;
      }
      setAspectFit('contain');
      setAspectRatioVal(`${parts[0]}/${parts[1]}`);
    } else {
      setAspectFit('contain');
      setAspectRatioVal(undefined);
    }
  }, []);

  useEffect(() => {
    applyAspectRatio(videoAspectRatio);
  }, [videoAspectRatio, applyAspectRatio]);

  const useCustomRatio = Boolean(aspectRatioVal) && !audioOnly;
  const videoStyle = {
    width: useCustomRatio ? 'auto' : '100%',
    height: useCustomRatio ? 'auto' : '100%',
    ...(useCustomRatio
      ? {
        position: 'absolute',
        left: '50%',
        top: '50%',
        right: 'auto',
        bottom: 'auto',
        transform: 'translate(-50%, -50%)',
        maxWidth: '100%',
        maxHeight: '100%',
        aspectRatio: aspectRatioVal,
      }
      : {}),
    objectFit: useCustomRatio ? 'contain' : aspectFit,
    backgroundColor: '#000',
    ...(audioOnly ? { opacity: 0 } : {}),
  };

  return {
    aspectFit,
    aspectRatioVal,
    videoStyle,
    applyAspectRatio,
  };
}
