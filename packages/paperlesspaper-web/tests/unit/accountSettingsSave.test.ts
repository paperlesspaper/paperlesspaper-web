import { expect, it, vi } from "vitest";
vi.mock("helpers/crudGeneratorExtend", () => ({
  generateCrudApi: ({ endpoints }: any) =>
    endpoints({
      query: (value: any) => value,
      mutation: (value: any) => value,
    }),
}));
import { accountsApi } from "../../src/ducks/accounts";
const preferences = {
  low: { email: true, push: false },
  empty: { email: false, push: true },
};
const values = { given_name: "Paperless", batteryNotifications: preferences };
const save = (baseQuery: any, submitted = values) =>
  accountsApi.updateAccountSettings.queryFn(
    { id: "account", values: submitted },
    {},
    {},
    baseQuery
  );
it("saves profile and notification preferences through their respective endpoints", async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ data: { given_name: "Paperless" } })
    .mockResolvedValueOnce({ data: preferences });
  const result = await save(query);
  expect(query.mock.calls).toEqual([
    [
      {
        url: "accounts/account",
        method: "post",
        body: { given_name: "Paperless" },
      },
    ],
    [
      {
        url: "accounts/current/notifications/battery",
        method: "put",
        body: preferences,
      },
    ],
  ]);
  expect(result).toEqual({ data: { given_name: "Paperless" } });
});
it("does not save notifications if the account save fails", async () => {
  const error = { status: 500 };
  const query = vi.fn().mockResolvedValue({ error });
  expect(await save(query)).toEqual({ error });
  expect(query).toHaveBeenCalledOnce();
});
it("reports failure when the profile succeeds but notifications fail", async () => {
  const error = { status: "FETCH_ERROR" };
  const query = vi
    .fn()
    .mockResolvedValueOnce({ data: {} })
    .mockResolvedValueOnce({ error });
  expect(await save(query)).toEqual({ error });
});
it("waits for notification persistence before reporting success", async () => {
  let finish!: (value: unknown) => void;
  const query = vi
    .fn()
    .mockResolvedValueOnce({ data: { id: "account" } })
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
  let completed = false;
  const pending = save(query).then((result: any) => {
    completed = true;
    return result;
  });
  await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(2));
  expect(completed).toBe(false);
  finish({ data: preferences });
  expect(await pending).toEqual({ data: { id: "account" } });
});
it("leaves unavailable preferences untouched", async () => {
  const query = vi.fn().mockResolvedValue({ data: {} });
  await save(query, {
    given_name: "Paperless",
    batteryNotifications: undefined,
  } as any);
  expect(query).toHaveBeenCalledOnce();
  expect(query.mock.calls[0][0].body).toEqual({ given_name: "Paperless" });
});
