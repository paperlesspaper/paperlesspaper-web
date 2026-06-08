import { Dispatch, ReactNode, SetStateAction, useContext } from "react";
import { Rotation } from "./useRotationList";
import { EditorContext } from "../IntegrationModal";

export interface EditorDetailsConfig {
  id: string;
  kind: "slider" | "modal";
  className?: string;
  modalHeading?: ReactNode;
  modalProps?: any;
  render: () => ReactNode;
  onRequestClose?: (...args: any[]) => void | Promise<void>;
  onRequestSubmit?: () => void | Promise<void>;
  onSecondarySubmit?: (...args: any[]) => void | Promise<void>;
}

export interface EditorContextType {
  form: any;
  reset?: (values?: any, keepStateOptions?: any) => void;
  rotationList: Record<string, Rotation>;
  modalOpen: boolean;
  setModalOpen: Dispatch<SetStateAction<boolean | string>>;
  editorDetails?: EditorDetailsConfig | null;
  setEditorDetails?: Dispatch<SetStateAction<EditorDetailsConfig | null>>;
  clearEditorDetails?: (id?: string) => void;
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
  selectedFrameIds?: string[];
  setSelectedFrameIds?: Dispatch<SetStateAction<string[]>>;
  selectedSlideshowIds?: string[];
  setSelectedSlideshowIds?: Dispatch<SetStateAction<string[]>>;
  selectedFrameKind?: string | null;
  confirmFrameSelection: (onRequestSubmit?: () => void) => void;
  size?: Rotation;
  overviewUrl?: string;
  params?: Record<string, string>;

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
