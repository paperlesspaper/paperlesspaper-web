// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("react-router-dom", () => ({ useParams: () => ({}) }));
vi.mock("../../src/helpers/useQs", () => ({ default: () => ({}) }));
import useSettingsForm from "../../src/helpers/useSettingsFormNew";

let query: any;
let entryId: string;
let store: ReturnType<typeof useSettingsForm>;
const api = {
  name: "accounts",
  useGetSingleAccountsQuery: () => query,
  useCreateSingleAccountsMutation: () => [vi.fn(), {}],
  useUpdateSingleAccountsMutation: () => [vi.fn(), {}],
  useDeleteSingleAccountsMutation: () => [vi.fn(), {}],
};
function Form() {
  store = useSettingsForm({
    api,
    id: entryId,
    preserveDirtyOnLoad: true,
    prepareFormEntry: (value: any) => value || {},
  });
  return (
    <>
      <input {...store.form.register("given_name")} />
      <input {...store.form.register("family_name")} />
    </>
  );
}
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  query = { isSuccess: false, data: undefined };
  entryId = "account";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Form />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
function enterName() {
  const input = container.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(input, "Updated");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function receiveAccount() {
  query = {
    isSuccess: true,
    data: { given_name: "Paperless", family_name: "Tester" },
  };
  act(() => root.render(<Form />));
}
it("preserves edits made before account data arrives and fills untouched fields", () => {
  enterName();
  receiveAccount();
  expect(store.form.getValues()).toMatchObject({
    given_name: "Updated",
    family_name: "Tester",
  });
  expect(container.querySelector("input")!.value).toBe("Updated");
});
it("still discards edits on an explicit reset", () => {
  enterName();
  receiveAccount();
  act(() => store.resetForm());
  expect(store.form.getValues()).toMatchObject({
    given_name: "Paperless",
    family_name: "Tester",
  });
  expect(store.form.formState.isDirty).toBe(false);
});
it("does not carry edits into another entry", () => {
  receiveAccount();
  enterName();
  entryId = "different-account";
  query = {
    isSuccess: true,
    data: { id: entryId, given_name: "Another", family_name: "Person" },
  };
  act(() => root.render(<Form />));
  expect(store.form.getValues()).toMatchObject({
    given_name: "Another",
    family_name: "Person",
  });
  expect(store.form.formState.isDirty).toBe(false);
});
