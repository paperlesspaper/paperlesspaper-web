import React from "react";
export const state = {
  created: [] as any[],
  uploaded: [] as any[],
  attempts: [] as string[],
  navigations: 0,
  failName: "",
  failed: false,
};
export const device = { id: "test-frame", kind: "epd7" };
export const useActiveUserDevice = () => ({ data: device });
export const useDebug = () => false;
export const useParams = () => ({
  organization: "test",
  page: "calendar",
  entry: "test-frame",
  paper: "new",
});
export const useHistory = () => ({
  push: () => {
    state.navigations++;
  },
  replace: () => {},
});
export const useLocation = () => ({ search: "" });
export default function useQs() {
  return {};
}
export const useTranslation = () => ({ t: (s: string) => s });
export const Trans = ({ children }: any) => children;
export const devicesApi = { useGetAllDevicesQuery: () => ({ data: [device] }) };
const mutation = (run: (request: any) => any) => (request: any) => ({
  unwrap: async () => run(request),
});
export const papersApi = {
  useCreateSinglePapersMutation: () => [
    mutation(({ values }) => {
      const paper = { id: `paper-${state.created.length + 1}`, ...values };
      state.created.push(paper);
      return paper;
    }),
  ],
  useUpdateSinglePapersMutation: () => [mutation(() => ({}))],
  useUploadSingleImageMutation: () => [
    mutation(async ({ id, body }) => {
      const paper = state.created.find((paper) => paper.id === id);
      state.attempts.push(paper.name);
      if (paper.name === state.failName && !state.failed) {
        state.failed = true;
        throw new Error("Injected network failure");
      }
      const pictures = body.getAll("picture");
      if (pictures.length !== 2 || pictures.some((blob) => !blob.size))
        throw new Error("Missing exported image");
      const editable = JSON.parse(body.get("pictureEditable"));
      if (!editable.objects?.length) throw new Error("Blank canvas exported");
      state.uploaded.push({ id, name: paper.name, meta: paper.meta, editable });
      return {};
    }),
  ],
  useGenerateImageUrlAltMutation: () => [
    () => {
      throw new Error("Unexpected backend read");
    },
  ],
};
export const Button = ({ children, onClick, disabled }: any) => (
  <button onClick={onClick} disabled={disabled}>
    {children}
  </button>
);
export const Modal = ({
  children,
  onRequestSubmit,
  primaryButtonText,
  primaryButtonDisabled,
}: any) => (
  <section>
    {children}
    <button disabled={primaryButtonDisabled} onClick={onRequestSubmit}>
      {primaryButtonText}
    </button>
  </section>
);
export const Story = ({ children }: any) => <div>{children}</div>;
export const Callout = ({ title, children }: any) => (
  <div role="alert">
    <strong>{title}</strong>
    {children}
  </div>
);
export const Select = ({ children, ...props }: any) => (
  <select {...props}>{children}</select>
);
export const SelectItem = ({ text, value }: any) => (
  <option value={value}>{text}</option>
);
export const InlineLoading = ({ description }: any) => <div>{description}</div>;
