import { useContext } from "react";
import { EditorContext } from "./Editor";
import { Rotation } from "./useRotationList";

export interface EditorContextType {
  form: any;
  rotationList: Record<string, Rotation>;
  modalOpen: boolean;
  setModalOpen: React.Dispatch<React.SetStateAction<boolean | string>>;
  darkMode?: boolean;

  // Add other properties if needed
}
export default function useEditor(): EditorContextType {
  const settings = useContext(EditorContext) || ({} as EditorContextType);
  return settings;
}
