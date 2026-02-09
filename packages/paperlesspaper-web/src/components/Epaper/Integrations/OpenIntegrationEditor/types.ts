export type Orientation = "portrait" | "landscape";

export type OpenIntegrationManifest = {
  name: string;
  version: string;
  description?: string;
  icon?: string;

  nativeSettings?: Record<string, any>;
  formSchema?: OpenIntegrationJsonSchema;

  settingsPage?: string;
  renderPage?: string;
};

export type OpenIntegrationJsonSchema = {
  type: "object";
  properties?: Record<string, OpenIntegrationJsonSchemaProperty>;
  required?: string[];
};

export type OpenIntegrationJsonSchemaProperty = {
  type: "string" | "number" | "integer" | "boolean" | "array";
  description?: string;

  // non-standard (but used in your example)
  required?: boolean;

  // numbers
  minimum?: number;
  maximum?: number;
  default?: any;

  // strings
  enum?: string[];

  // arrays
  items?: { type: "string" };
};

export type OpenIntegrationAppToPluginMessage =
  | {
      source: "wirewire-app";
      type: "INIT";
      payload: {
        settings: Record<string, any>;
        nativeSettings: Record<string, any>;
        device: { deviceId?: string; kind?: string };
        app: { language?: string };
      };
    }
  | {
      source: "wirewire-app";
      type: "REDIRECT";
      payload: {
        redirectUrl: string;
        tempToken: string;
      };
    };

export type OpenIntegrationPluginToAppMessage =
  | {
      source: "wirewire-plugin";
      type: "UPDATE_SETTINGS";
      payload: Record<string, any>;
    }
  | {
      source: "wirewire-plugin";
      type: "SET_HEIGHT";
      payload: { height: number };
    }
  | {
      source: "wirewire-plugin";
      type: "INFO";
      payload: Record<string, any>;
    };
