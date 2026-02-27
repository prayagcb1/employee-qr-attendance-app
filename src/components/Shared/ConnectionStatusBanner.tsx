import { useEffect, useState } from 'react';
import { connectionMonitor, ConnectionState } from '../../utils/connectionMonitor';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

export function ConnectionStatusBanner() {
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const unsubscribe = connectionMonitor.subscribe((state) => {
      setConnectionState(state);

      if (state.status === 'offline' || state.status === 'blocked' || state.status === 'slow') {
        setShowBanner(true);
      } else {
        setTimeout(() => setShowBanner(false), 3000);
      }
    });

    return unsubscribe;
  }, []);

  if (!showBanner || !connectionState) {
    return null;
  }

  const getBannerConfig = () => {
    switch (connectionState.status) {
      case 'offline':
        return {
          icon: <WifiOff className="h-5 w-5" />,
          text: 'No internet connection - Some features may not work',
          bgColor: 'bg-red-500',
        };
      case 'blocked':
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          text: 'Connection blocked - Try switching to WiFi or using VPN',
          bgColor: 'bg-orange-500',
        };
      case 'slow':
        return {
          icon: <Wifi className="h-5 w-5" />,
          text: 'Slow connection detected - Some operations may take longer',
          bgColor: 'bg-yellow-500',
        };
      case 'online':
        return {
          icon: <Wifi className="h-5 w-5" />,
          text: 'Back online',
          bgColor: 'bg-green-500',
        };
    }
  };

  const config = getBannerConfig();

  return (
    <div className={`${config.bgColor} text-white px-4 py-2 flex items-center justify-center gap-2 text-sm`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}
