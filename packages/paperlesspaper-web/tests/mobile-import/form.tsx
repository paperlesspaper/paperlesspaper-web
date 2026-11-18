import { useForm } from "react-hook-form";
export default function useIntegrationForm({ defaultValues }: any) {
  const form = useForm({
    defaultValues: {
      ...defaultValues,
      meta: { orientation: "landscape", ...defaultValues.meta },
    },
  });
  const orientation = form.watch("meta.orientation");
  return {
    form,
    reset: form.reset,
    urlId: "new",
    size:
      orientation === "portrait"
        ? { width: 480, height: 800 }
        : { width: 800, height: 480 },
  };
}
