"use client";

export interface NativeConfiguration {
  apiUrl: string;
  powersyncUrl?: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  };
}

declare global {
  const __NOTED_CONFIG__: NativeConfiguration;
}

export const nativeConfiguration = __NOTED_CONFIG__;
