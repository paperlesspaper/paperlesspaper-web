import React, { createContext, useContext } from "react";
import type { FormState } from "react-hook-form";

export interface SettingsContentContextProps {
  afterContent?: any;
  children?: React.ReactNode;
  disableClosePrompt?: boolean;
  componentsOverride?: Record<string, any>;
  handleSubmit?: (...args: any[]) => any;
  customRedirectAfterSubmit?: (...args: any[]) => any;
  onSubmit?: (...args: any[]) => any;
  fullHeight?: boolean;
  idElement?: (data: any) => any;
  StatusBlockquote?: React.ComponentType<any>;
  fullWidth?: boolean;
  search?: any;
  hideMessages?: boolean;
  form?: { formState: FormState<any> };
  singleQuery?: any;
  showReturnDesktop?: boolean;
  mobileSubmitButtonTitle?: React.ReactNode;
  isDirtyAlt?: boolean;
  resultCreateSingle?: any;
  resultUpdateSingle?: any;
  latestCrudId?: any;
  entryDataId?: any;
  urlId?: any;
  url?: string;
  wrapperClasses?: string;
  [key: string]: any;
}

const SettingsContentContext = createContext<
  SettingsContentContextProps | undefined
>(undefined);

export const SettingsContentProvider = SettingsContentContext.Provider;

export function useSettingsContent(): SettingsContentContextProps {
  const context = useContext(SettingsContentContext);
  if (!context) {
    throw new Error(
      "useSettingsContent must be used within SettingsContentProvider",
    );
  }
  return context;
}
