import { createSlice } from "@reduxjs/toolkit";

import { useSelector } from "react-redux";

export default createSlice({
  name: "globalFormState",
  initialState: { isDirty: false },
  reducers: {
    addError: (state, action) => {
      state.isDirty = action.payload;
    },
  },
});

export const globalFormIsDirty = (state) => state.isDirty;

export function useGlobalFormIsDirty() {
  return useSelector((state: any) => state.isDirty);
}
