import { Dispatch, SetStateAction, useContext } from "react";
import { Rotation } from "./useRotationList";
import { EditorContext } from "../IntegrationModal";

export interface EditorContextType {
  form: any;
  reset?: (values?: any, keepStateOptions?: any) => void;
  rotationList: Record<string, Rotation>;
  modalOpen: boolean;
  setModalOpen: Dispatch<SetStateAction<boolean | string>>;
  darkMode?: boolean;
  isLoadingImageData: boolean;
  setIsLoadingImageData: Dispatch<SetStateAction<boolean>>;
  toggleDrawingMode?: () => void;
  disableDrawingMode?: () => void;
  activeObject?: any;
  isLoading: boolean;
  isDoneModal: boolean;
  setDoneModal: Dispatch<SetStateAction<boolean>>;
  done: boolean;
  setDone: Dispatch<SetStateAction<boolean>>;
  isFrameSelectionOpen: boolean;
  setFrameSelectionOpen: Dispatch<SetStateAction<boolean>>;
  selectedFrameId: string | null;
  setSelectedFrameId: Dispatch<SetStateAction<string | null>>;
  confirmFrameSelection: (onRequestSubmit?: () => void) => void;
  size?: Rotation;

  // Slideshow integration helpers (used when the selected frame currently displays a slideshow)
  slideshowTargetPaperId?: string | null;
  setSlideshowTargetPaperId?: Dispatch<SetStateAction<string | null>>;
  slideshowTargetPaperQuery?: any;

  // Add other properties if needed
}
export default function useEditor(): EditorContextType {
  const settings = useContext(EditorContext) || ({} as EditorContextType);
  return settings;
}
