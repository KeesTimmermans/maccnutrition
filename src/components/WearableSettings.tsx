import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  X, 
  Watch, 
  CheckCircle2, 
  ExternalLink, 
  Loader2,
  AlertCircle,
  RefreshCw,
  Moon,
  Heart,
  Activity,
  Zap
} from "lucide-react";
import { 
  getWearableConnections, 
  getTodaysWearableData,
  createWearableConnection,
  disconnectWearable,
  WEARABLE_PROVIDERS,
  type WearableConnection,
  type WearableSummary,
  type WearableProvider
} from "@/lib/wearableService";
import { toast } from "sonner";

interface WearableSettingsProps {
  onClose: () => void;
}

export const WearableSettings = ({ onClose }: WearableSettingsProps) => {
  const [connections, setConnections] = useState<WearableConnection[]>([]);
  const [todaysData, setTodaysData] = useState<WearableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<WearableProvider | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [conns, data] = await Promise.all([
        getWearableConnections(),
        getTodaysWearableData()
      ]);
      setConnections(conns);
      setTodaysData(data);
    } catch (error) {
      console.error('Error loading wearable data:', error);
    }
    setLoading(false);
  };

  const handleConnect = async (provider: WearableProvider) => {
    const providerInfo = WEARABLE_PROVIDERS[provider];
    
    if (!providerInfo.oauthSupported) {
      toast.info('Apple Health requires a native iOS app. Coming soon with Capacitor integration!');
      return;
    }

    setConnecting(provider);
    try {
      // For now, create a placeholder connection
      // Real OAuth flow will be implemented when API credentials are added
      await createWearableConnection(provider);
      toast.info(
        `${providerInfo.name} connection ready! OAuth integration pending API credentials.`,
        { duration: 5000 }
      );
      await loadData();
    } catch (error) {
      toast.error(`Failed to set up ${providerInfo.name} connection`);
    }
    setConnecting(null);
  };

  const handleDisconnect = async (provider: WearableProvider) => {
    try {
      await disconnectWearable(provider);
      toast.success(`Disconnected from ${WEARABLE_PROVIDERS[provider].name}`);
      await loadData();
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  const isConnected = (provider: WearableProvider) => {
    return connections.some(c => c.provider === provider && c.is_connected);
  };

  const isPending = (provider: WearableProvider) => {
    return connections.some(c => c.provider === provider && !c.is_connected);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Watch className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Wearable Devices</h2>
            <p className="text-xs text-muted-foreground">Connect your fitness trackers</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Today's Synced Data */}
        {todaysData && (
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Today's Wearable Data</h3>
              <span className="text-xs text-muted-foreground capitalize">{todaysData.provider}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {todaysData.sleepHours && (
                <div className="flex items-center gap-3">
                  <Moon className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{todaysData.sleepHours}h</p>
                    <p className="text-xs text-muted-foreground">Sleep</p>
                  </div>
                </div>
              )}
              {todaysData.hrv && (
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{todaysData.hrv}ms</p>
                    <p className="text-xs text-muted-foreground">HRV</p>
                  </div>
                </div>
              )}
              {todaysData.recoveryScore && (
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{todaysData.recoveryScore}/5</p>
                    <p className="text-xs text-muted-foreground">Recovery</p>
                  </div>
                </div>
              )}
              {todaysData.steps && (
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{todaysData.steps.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Steps</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Available Providers */}
        <div>
          <h3 className="font-semibold text-foreground mb-4">Available Integrations</h3>
          <div className="space-y-3">
            {(Object.entries(WEARABLE_PROVIDERS) as [WearableProvider, typeof WEARABLE_PROVIDERS[WearableProvider]][]).map(([key, provider]) => {
              const connected = isConnected(key);
              const pending = isPending(key);
              
              return (
                <div 
                  key={key}
                  className="bg-card rounded-2xl p-4 shadow-soft"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${provider.color} flex items-center justify-center text-2xl`}>
                        {provider.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{provider.name}</h4>
                          {connected && (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                          {pending && (
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{provider.description}</p>
                      </div>
                    </div>
                    <div>
                      {connected ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDisconnect(key)}
                        >
                          Disconnect
                        </Button>
                      ) : pending ? (
                        <Button 
                          variant="soft" 
                          size="sm"
                          onClick={() => handleDisconnect(key)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleConnect(key)}
                          disabled={connecting === key}
                        >
                          {connecting === key ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Connect'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {pending && (
                    <div className="mt-3 p-3 bg-amber-500/10 rounded-xl">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        <strong>Setup Required:</strong> OAuth integration needs API credentials. 
                        <a 
                          href={`https://developer.${key === 'whoop' ? 'whoop.com' : key === 'garmin' ? 'garmin.com' : 'fitbit.com'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline ml-1 inline-flex items-center gap-1"
                        >
                          Get API access <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="bg-muted/50 rounded-2xl p-4">
          <h4 className="font-semibold text-foreground mb-2">How to Set Up Wearable Sync</h4>
          <ol className="text-sm text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span className="font-bold text-primary">1.</span>
              <span>Register for a developer account with your wearable provider</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary">2.</span>
              <span>Create an OAuth application and get your Client ID & Secret</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary">3.</span>
              <span>Add your API credentials to enable automatic syncing</span>
            </li>
          </ol>
          
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-foreground">Developer Portals:</p>
            <div className="flex flex-wrap gap-2">
              <a 
                href="https://developer.garmin.com/gc-developer-program/overview/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Garmin Connect <ExternalLink className="w-3 h-3" />
              </a>
              <a 
                href="https://developer.whoop.com/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                WHOOP <ExternalLink className="w-3 h-3" />
              </a>
              <a 
                href="https://dev.fitbit.com/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Fitbit <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="p-4 border-t border-border">
        <Button 
          variant="soft" 
          className="w-full"
          onClick={loadData}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>
    </div>
  );
};
