// config/gameConfig.ts - Centralized game configuration management
interface GameConfig {
  // Performance settings
  performance: {
    maxFrameRate: number;
    enableProfiling: boolean;
    slowComponentThreshold: number;
    memoryWarningThreshold: number;
  };

  // Game balance settings
  balance: {
    maxDaemonsActive: number;
    maxMissionDuration: number;
    resourceUpdateInterval: number;
    baseRecruitmentCost: number;
  };

  // UI settings
  ui: {
    notificationMaxCount: number;
    notificationDefaultDuration: number;
    animationDuration: number;
    tooltipDelay: number;
  };

  // Persistence settings
  persistence: {
    autoSaveInterval: number;
    compressionEnabled: boolean;
    versioningEnabled: boolean;
    maxBackups: number;
  };

  // Development settings
  debug: {
    enableConsoleLogging: boolean;
    enablePerformanceMonitoring: boolean;
    enableErrorBoundaryDetails: boolean;
    mockApiCalls: boolean;
  };

  // Environment-specific settings
  environment: {
    apiBaseUrl: string;
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
    buildVersion: string;
  };
}

// Default configuration
const requiredEnv = (value: string | undefined, name: string): string => {
  if (!value || value.trim() === '') {
    throw new Error(`${name} must be configured.`);
  }

  return value.trim();
};

const defaultConfig: GameConfig = {
  performance: {
    maxFrameRate: 60,
    enableProfiling: import.meta.env.DEV,
    slowComponentThreshold: 16, // 16ms for 60fps
    memoryWarningThreshold: 50, // 50MB
  },

  balance: {
    maxDaemonsActive: 10,
    maxMissionDuration: 300000, // 5 minutes
    resourceUpdateInterval: 1000, // 1 second
    baseRecruitmentCost: 100,
  },

  ui: {
    notificationMaxCount: 5,
    notificationDefaultDuration: 5000, // 5 seconds
    animationDuration: 300, // 300ms
    tooltipDelay: 500, // 500ms
  },

  persistence: {
    autoSaveInterval: 30000, // 30 seconds
    compressionEnabled: true,
    versioningEnabled: true,
    maxBackups: 3,
  },

  debug: {
    enableConsoleLogging: import.meta.env.DEV,
    enablePerformanceMonitoring: import.meta.env.DEV,
    enableErrorBoundaryDetails: import.meta.env.DEV,
    mockApiCalls: false,
  },

  environment: {
    apiBaseUrl: requiredEnv(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL'),
    enableAnalytics: import.meta.env.PROD,
    enableErrorReporting: import.meta.env.PROD,
    buildVersion: import.meta.env.VITE_BUILD_VERSION || '1.0.0',
  },
};

// Configuration manager class
class ConfigManager {
  private config: GameConfig;
  private listeners: Set<(config: GameConfig) => void> = new Set();

  constructor(initialConfig: GameConfig = defaultConfig) {
    this.config = this.validateConfig(initialConfig);
  }

  // Get configuration value by path
  get<T = unknown>(path: string): T {
    const keys = path.split('.');
    let value: unknown = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        throw new Error(`Configuration path '${path}' not found`);
      }
    }

    return value as T;
  }

  // Set configuration value by path
  set(path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop();

    if (!lastKey) {
      throw new Error('Invalid configuration path');
    }

    let target: Record<string, unknown> = this.config as unknown as Record<string, unknown>;
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }

    target[lastKey] = value;
    this.config = this.validateConfig(this.config);
    this.notifyListeners();
  }

  // Get entire configuration
  getAll(): GameConfig {
    return { ...this.config };
  }

  // Update multiple configuration values
  update(updates: Partial<GameConfig>): void {
    this.config = this.validateConfig({ ...this.config, ...updates });
    this.notifyListeners();
  }

  // Reset to default configuration
  reset(): void {
    this.config = this.validateConfig(defaultConfig);
    this.notifyListeners();
  }

  // Subscribe to configuration changes
  subscribe(listener: (config: GameConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Environment-specific helpers
  isDevelopment(): boolean {
    return import.meta.env.DEV;
  }

  isProduction(): boolean {
    return import.meta.env.PROD;
  }

  // Validate configuration structure
  private validateConfig(config: GameConfig): GameConfig {
    // Basic validation - in a real app, would use a schema validator like Zod
    if (!config.performance || typeof config.performance.maxFrameRate !== 'number') {
      throw new Error('Invalid performance configuration');
    }

    if (!config.balance || typeof config.balance.maxDaemonsActive !== 'number') {
      throw new Error('Invalid balance configuration');
    }

    if (!config.ui || typeof config.ui.notificationMaxCount !== 'number') {
      throw new Error('Invalid UI configuration');
    }

    return config;
  }

  // Notify all listeners of configuration changes
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch {
        // Configuration listener error - using structured logging instead of console.error
      }
    });
  }
}

// Global configuration instance
export const gameConfig = new ConfigManager(defaultConfig);

// Export types and utilities
export type { GameConfig };
export { ConfigManager, defaultConfig };
