import React from "react";
import { useImageEditorContext } from "../../src/components/Epaper/Integrations/ImageEditor/ImageEditor";
export const EditorContext = React.createContext<any>(null);
export default function IntegrationModal({
  store,
  children,
  inline,
  onRequestCloseOverride,
}: any) {
  const context = useImageEditorContext();
  (window as any).editorContext = context;
  (window as any).editorStore = store;
  return (
    <EditorContext.Provider value={store}>
      <div style={{ width: 360 }}>
        {children}
        {!inline && (
          <button onClick={onRequestCloseOverride}>Close editor</button>
        )}
      </div>
    </EditorContext.Provider>
  );
}
