// Export base connector and utilities
export * from './base';

// Export platform-specific connectors
export { ShopeeConnector } from './shopee';
export { Cults3DConnector } from './cults3d';

// Connector factory function
import { BaseConnector, ConnectorConfig } from './base';
import { ShopeeConnector } from './shopee';
import { Cults3DConnector } from './cults3d';

export interface ConnectorRegistry {
  shopee: typeof ShopeeConnector;
  'tiktok-shop': typeof BaseConnector; // To be implemented
  tokopedia: typeof BaseConnector; // To be implemented
  cults3d: typeof Cults3DConnector;
  'custom-motekarfpv': typeof BaseConnector; // To be implemented
  'custom-r3dfpv': typeof BaseConnector; // To be implemented
}

export const availableConnectors: ConnectorRegistry = {
  shopee: ShopeeConnector,
  'tiktok-shop': BaseConnector, // Placeholder
  tokopedia: BaseConnector, // Placeholder
  cults3d: Cults3DConnector,
  'custom-motekarfpv': BaseConnector, // Placeholder
  'custom-r3dfpv': BaseConnector, // Placeholder
};

export function createConnector(
  platformId: string,
  config: ConnectorConfig,
  credentials: Record<string, any>
): BaseConnector {
  const ConnectorClass = availableConnectors[platformId as keyof ConnectorRegistry];

  if (!ConnectorClass) {
    throw new Error(`No connector available for platform: ${platformId}`);
  }

  return new ConnectorClass(config, credentials);
}

export function getSupportedPlatforms(): string[] {
  return Object.keys(availableConnectors);
}

export function isPlatformSupported(platformId: string): boolean {
  return platformId in availableConnectors;
}